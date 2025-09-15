import {Command} from "./Command";
import {FieldValue, Type} from "N/record";
import {record} from "N";
import {CommandContext} from "./CommandContext";


interface CommandSetValueOnCurrentRecordInterface {
    details: string
    targetObjectType: Type | string
    targetObjectId: string
    previousValue: FieldValue
    valueToSet: FieldValue
    field: string
    sublistId: string | null
    sublistLineUniqueId: number | null // null in Create mode
    group: string
}

function needToWaitForFieldSourcing(args:{fieldId: string, sublistId: string | null}): boolean {
    return args.sublistId === `item` && args.fieldId === `item`;

}

export class CommandSetValueOnCurrentRecord implements Command {
    details: string;
    targetObjectType: Type | string;
    targetObjectId: string;
    group: string;
    type: string = `CommandSetValueOnCurrentRecord`;
    previousValue: FieldValue;
    valueToSet: FieldValue;
    field: string;
    sublistId: string | null;
    // sublistLineStartingFrom1: number; // 0 for body fields
    sublistLineUniqueId: number | null;
    [key: string]: unknown;
    constructor(args: CommandSetValueOnCurrentRecordInterface) {
        this.details = args.details;
        this.targetObjectType = args.targetObjectType;
        this.targetObjectId = args.targetObjectId;
        this.previousValue = args.previousValue;
        this.valueToSet = args.valueToSet;
        this.field = args.field;
        this.sublistId = args.sublistId;
        // this.sublistLineStartingFrom1 = args.sublistLineStartingFrom1;
        this.sublistLineUniqueId = args.sublistLineUniqueId;
        this.group = args.group;
    }

    aftermathToStop(context: CommandContext): CommandContext {
        return context;
    }

    conditionsToSkip(context: CommandContext): CommandContext {
        return context;
    }

    conditionsToStop(context: CommandContext): CommandContext {
        if (!context || !context.loadedClientRecords || !context.loadedClientRecords[this.targetObjectId]) {
            // trying to load record that is not loaded
            if (!context) {
                context = {};
            }
            if (!context.loadedClientRecords) {
                context.loadedClientRecords = {};
            }
            try {
                const loaded = record.load({
                    type: this.targetObjectType,
                    id: this.targetObjectId,
                    isDynamic: true
                });
                context.loadedClientRecords[this.targetObjectId] = loaded;
                context.automaticallyLoadedRecords ??= [];
                context.automaticallyLoadedRecords.push(loaded);
                return context;
            }
            catch (e) {
                context.failed = true;
                context.result = `For CommandSetValueOnCurrentRecord context must contain loaded current record with the same id as targetObjectId: "${this.targetObjectId}" (error: ${JSON.stringify(e)})`;
                return context;
            }
        }
        return context;
    }

    shortDescribe(): string {
        if (this.sublistId) {
            return `${this.type} sets ${this.targetObjectType} ${this.targetObjectId} ${this.sublistId} sublist current line ${this.field} from ${this.previousValue} to ${this.valueToSet}`;
        }
        return `${this.type} sets ${this.targetObjectType} ${this.targetObjectId} ${this.field} from ${this.previousValue} to ${this.valueToSet}`;
    }

    execute(context: CommandContext, log?: (s: string) => void): CommandContext {
        try {
            const loadedRecord = (context.loadedClientRecords as {[key: string]: record.ClientCurrentRecord})[this.targetObjectId]; // can be sure it's not null since it's been checked in conditionsToStop
            if (this.sublistId) {
                log?.(`Setting ${this.field} to ${this.valueToSet} (type ${typeof this.valueToSet}) on ${this.targetObjectType} ${this.targetObjectId} sublist ${this.sublistId} current line`);
                loadedRecord.setCurrentSublistValue({
                    sublistId: this.sublistId,
                    fieldId: this.field,
                    value: this.valueToSet,
                    fireSlavingSync: needToWaitForFieldSourcing({fieldId: this.field, sublistId: this.sublistId}),
                });
            }
            else {
                log?.(`Setting ${this.field} to ${this.valueToSet} (type ${typeof this.valueToSet}) on ${this.targetObjectType} ${this.targetObjectId}`);
                loadedRecord.setValue({
                    fieldId: this.field,
                    value: this.valueToSet
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
        const obj = JSON.parse(s) as CommandSetValueOnCurrentRecord;
        const value = obj.valueToSet;
        if (typeof value === `string` && value.endsWith(`.000Z`)) { // date is parsed as a string, need to convert it back to Date
            obj.valueToSet = new Date(value);
        }
        return new CommandSetValueOnCurrentRecord({
            details: obj.details,
            targetObjectType: obj.targetObjectType,
            targetObjectId: obj.targetObjectId,
            previousValue: obj.previousValue,
            valueToSet: obj.valueToSet,
            field: obj.field,
            sublistId: obj.sublistId,
            // sublistLineStartingFrom1: obj.sublistLineStartingFrom1,
            sublistLineUniqueId: obj.sublistLineUniqueId,
            group: obj.group
        });
    }

}