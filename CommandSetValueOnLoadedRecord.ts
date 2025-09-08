import {Command} from "./Command";
import {FieldValue, Type} from "N/record";
import {record} from "N";
import {CommandContext} from "./CommandContext";



interface CommandSetValueOnLoadedRecordInterface {
    details: string
    targetObjectType: Type | string
    targetObjectId: string
    previousValue: FieldValue
    valueToSet: FieldValue
    field: string
    sublistId: string | null
    sublistLineStartingFrom1: number
    sublistLineUniqueId: number | null // null in Create mode
    group: string
    needToWaitForSourcing?: boolean
    notYetCommit?: boolean
}

function needToWaitForFieldSourcing(args:{fieldId: string, sublistId: string | null}): boolean {
    return args.sublistId === `item` && args.fieldId === `item`; // if we're setting item field on item sublist, we need to wait for sourcing


}

export function findLineNumberWithUniqueId(record: record.Record | record.ClientCurrentRecord, sublistId: `item` | `addressbook`, uniqueId: string, log?: (s: string) => void): number | null {
    const lineCount = record.getLineCount({sublistId});
    const fieldName = `item` === sublistId ? `lineuniquekey` : `id`; // for item lines it's lineuniquekey, for addressbook it's id
    for (let i = 0; i < lineCount; i++) {
        const lineUniqueId = record.getSublistValue({sublistId, fieldId: fieldName, line: i});
        log?.(`Checking line ${i + 1} with unique id ${lineUniqueId}. Expected ${uniqueId}`);
        if (String(lineUniqueId) === String(uniqueId)) {
            return i;
        }
    }
    return null;
}

export class CommandSetValueOnLoadedRecord implements Command {
    details: string;
    targetObjectType: Type | string;
    targetObjectId: string;
    group: string;
    type: string = `CommandSetValueOnLoadedRecord`;
    previousValue: FieldValue;
    valueToSet: FieldValue;
    field: string;
    sublistId: string | null;
    sublistLineStartingFrom1: number; // 0 for body fields
    sublistLineUniqueId: number | null;
    needToWaitForSourcing?: boolean;
    notYetCommit?: boolean; // if true, then command will not commit the line
    [key: string]: unknown;
    constructor(args: CommandSetValueOnLoadedRecordInterface) {
        this.details = args.details;
        this.targetObjectType = args.targetObjectType;
        this.targetObjectId = args.targetObjectId;
        this.previousValue = args.previousValue;
        
        // Convert ISO date strings to Date objects for date fields
        if (typeof args.valueToSet === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(args.valueToSet)) {
            this.valueToSet = new Date(args.valueToSet);
        } else {
            this.valueToSet = args.valueToSet;
        }
        
        this.field = args.field;
        this.sublistId = args.sublistId;
        this.sublistLineStartingFrom1 = args.sublistLineStartingFrom1;
        this.sublistLineUniqueId = args.sublistLineUniqueId;
        this.group = args.group;
        this.needToWaitForSourcing = args.needToWaitForSourcing === undefined ? false : args.needToWaitForSourcing;
        this.notYetCommit = args.notYetCommit === undefined ? false : args.notYetCommit;
    }

    aftermathToStop(context: CommandContext): CommandContext {
        return context;
    }

    conditionsToSkip(context: CommandContext): CommandContext {
        return context;
    }

    conditionsToStop(context: CommandContext): CommandContext {
        if (!context || !context.loadedRecords || !context.loadedRecords[this.targetObjectId]) {
            // trying to load record that is not loaded
            if (!context) {
                context = {};
            }
            if (!context.loadedRecords) {
                context.loadedRecords = {};
            }
            try {
                const loaded  = record.load({
                    type: this.targetObjectType,
                    id: this.targetObjectId,
                    isDynamic: true
                });
                context.loadedRecords[this.targetObjectId] = loaded;
                if (!context.automaticallyLoadedRecords) {
                    context.automaticallyLoadedRecords = [];
                }
                context.automaticallyLoadedRecords.push(loaded);
                return context;
            }
            catch (e) {
                context.failed = true;
                context.result = `For CommandSetValueOnLoadedRecord context must contain loaded record with the same id as targetObjectId: "${this.targetObjectId}" (error: ${JSON.stringify(e)})`;
                return context;
            }
        }
        return context;
    }


    shortDescribe(): string {
        if (this.sublistId) {
            return `${this.type} sets ${this.targetObjectType} ${this.targetObjectId} ${this.sublistId} sublist line ${this.sublistLineStartingFrom1 ? Number(this.sublistLineStartingFrom1) : 0} ${this.field} from ${this.previousValue} to ${this.valueToSet}`;
        }
        return `${this.type} sets ${this.targetObjectType} ${this.targetObjectId} ${this.field} from ${this.previousValue} to ${this.valueToSet}`;
    }

    execute(context: CommandContext, log?: (s: string) => void): CommandContext {
        try {
            const loadedRecord = (context.loadedRecords as {[key: string]: record.Record})[this.targetObjectId]; // can be sure it's not null since it's been checked in conditionsToStop
            let lineNumber = this.sublistLineStartingFrom1 ? this.sublistLineStartingFrom1 - 1 : 0;
            if (this.sublistId) { // means we are setting sublist value, not body value
                if (this.sublistLineUniqueId) { // when setting by line unique id, need to find the line number first
                    lineNumber = findLineNumberWithUniqueId(
                        loadedRecord,
                        this.sublistId as `item` | `addressbook`,
                        this.sublistLineUniqueId.toString(),
                        log
                    ) as number;
                    log?.(`Found line number ${lineNumber + 1} for unique id ${this.sublistLineUniqueId}`);
                    if (lineNumber === null || isNaN(lineNumber)) { // couldn't find line with unique id
                        if (!context) {
                            context = {};
                        }
                        context.failed = true;
                        context.result = `${this.shortDescribe()} failed: line with unique id "${this.sublistLineUniqueId}" not found`;
                        return context;
                    }
                }
                if (loadedRecord.isDynamic) { // for dynamic record we need to select line before setting sublist value and then commit it
                    log?.(`Selecting line ${lineNumber} sublist "${this.sublistId}"`);
                    loadedRecord.selectLine({
                        sublistId: this.sublistId,
                        line: lineNumber
                    });
                    log?.(`Setting ${this.field} to ${this.valueToSet} (type ${typeof this.valueToSet}) on ${this.targetObjectType} ${this.targetObjectId} sublist ${this.sublistId} line ${lineNumber}`);
                    loadedRecord.setCurrentSublistValue({
                        sublistId: this.sublistId,
                        fieldId: this.field,
                        value: this.valueToSet,
                        fireSlavingSync: this.needToWaitForSourcing || needToWaitForFieldSourcing({fieldId: this.field, sublistId: this.sublistId})
                    });
                    if (!this.notYetCommit) { // if not yet commit, then we don't commit the line
                        log?.(`Committing line ${lineNumber} sublist "${this.sublistId}"`);
                        loadedRecord.commitLine({sublistId: this.sublistId});
                    }

                }
                else { // for standard mode we can set sublist value directly
                    log?.(`Setting ${this.field} to ${this.valueToSet} STANDARD MODE (type ${typeof this.valueToSet}) on ${this.targetObjectType} ${this.targetObjectId} sublist ${this.sublistId} line ${lineNumber}`);
                    loadedRecord.setSublistValue({
                        sublistId: this.sublistId,
                        fieldId: this.field,
                        line: lineNumber,
                        value: this.valueToSet,
                        fireSlavingSync: this.needToWaitForSourcing || needToWaitForFieldSourcing({fieldId: this.field, sublistId: this.sublistId})
                    });
                }

            }
            else { // setting body field value
                log?.(`Setting ${this.field} to ${this.valueToSet} (type ${typeof this.valueToSet}) on ${this.targetObjectType} ${this.targetObjectId}`);
                loadedRecord.setValue({
                    fieldId: this.field,
                    value: this.valueToSet,
                    fireSlavingSync: this.needToWaitForSourcing || needToWaitForFieldSourcing({fieldId: this.field, sublistId: this.sublistId})
                });
            }
        }
        catch (e) {
            if (!context) {
                context = {};
            }
            context.failed = true;
            context.result = `${this.shortDescribe()} failed: ${JSON.stringify(e)}`;
        }
        return context;
    }

    fallBack(): Command[] {
        return [];
    }

    toStr(): string {
        return JSON.stringify(this);
    }

    undo(context: CommandContext, log?: (s: string) => void): CommandContext {
        log?.(`Doing nothing, because this is a command that cannot be undone`);
        return context;
    }

    static fromString(s: string): Command {
        const obj = JSON.parse(s) as CommandSetValueOnLoadedRecord;
        const value = obj.valueToSet;
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)) {
            obj.valueToSet = new Date(value);
        }
        return new CommandSetValueOnLoadedRecord({
            details: obj.details,
            targetObjectType: obj.targetObjectType,
            targetObjectId: obj.targetObjectId,
            previousValue: obj.previousValue,
            valueToSet: obj.valueToSet,
            field: obj.field,
            sublistId: obj.sublistId,
            sublistLineStartingFrom1: obj.sublistLineStartingFrom1,
            sublistLineUniqueId: obj.sublistLineUniqueId,
            group: obj.group,
            needToWaitForSourcing: obj.needToWaitForSourcing,
            notYetCommit: obj.notYetCommit === undefined ? false : obj.notYetCommit as boolean
        });
    }

}