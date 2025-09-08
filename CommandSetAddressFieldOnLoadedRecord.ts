import {Command} from "./Command";
import {FieldValue, Type} from "N/record";
import {record} from "N";
import {CommandContext} from "./CommandContext";


interface CommandSetAddressFieldOnLoadedRecordInterface {
    details: string
    targetObjectType: Type
    targetObjectId: string
    previousValue: FieldValue
    valueToSet: FieldValue
    field: string
    sublistLineStartingFrom1: number
    group?: string;
}

export class CommandSetAddressFieldOnLoadedRecord implements Command {
    details: string;
    targetObjectType: Type;
    targetObjectId: string;
    group: string;
    type: string = `CommandSetAddressFieldOnLoadedRecord`;
    previousValue: FieldValue;
    valueToSet: FieldValue;
    field: string;
    sublistLineStartingFrom1: number;
    [key: string]: unknown;
    constructor(args: CommandSetAddressFieldOnLoadedRecordInterface) {
        this.details = args.details;
        this.targetObjectType = args.targetObjectType;
        this.targetObjectId = args.targetObjectId;
        this.previousValue = args.previousValue;
        this.valueToSet = args.valueToSet;
        this.field = args.field;
        this.sublistLineStartingFrom1 = args.sublistLineStartingFrom1;
        this.group = args.group ? args.group : ``;
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
                const loaded = record.load({
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
        return `${this.type} updates address ${this.targetObjectType} ${this.targetObjectId} in line ${this.sublistLineStartingFrom1} ${this.field} from ${this.previousValue} to ${this.valueToSet}`;
    }

    execute(context: CommandContext): CommandContext {
        try {
            const loadedRecord = (context.loadedRecords as {[key: string]: record.Record})[this.targetObjectId]; // can be sure it's not null since it's been checked in conditionsToStop
            loadedRecord.selectLine({ sublistId: `addressbook`, line: this.sublistLineStartingFrom1 - 1 });
            if ([`defaultshipping`, `defaultbilling`].includes(this.field)) {
                loadedRecord.setCurrentSublistValue({
                    sublistId: `addressbook`,
                    fieldId: this.field,
                    value: this.valueToSet as boolean,
                });
            }
            else {
                const addressSubRecord = loadedRecord.getCurrentSublistSubrecord({
                    fieldId: `addressbookaddress`,
                    sublistId: `addressbook`,
                });
                addressSubRecord.setValue({
                    fieldId: this.field,
                    value: this.valueToSet,
                });
            }
            loadedRecord.commitLine({ sublistId: `addressbook` });
            context.result = `Address added to ${this.targetObjectType} ${this.targetObjectId}`;
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
        const obj = JSON.parse(s) as CommandSetAddressFieldOnLoadedRecord;
        const value = obj.valueToSet;
        if (typeof value === `string` && value.endsWith(`.000Z`)) { // date is parsed as a string, need to convert it back to Date
            obj.valueToSet = new Date(value);
        }
        return new CommandSetAddressFieldOnLoadedRecord({
            details: obj.details,
            targetObjectType: obj.targetObjectType,
            targetObjectId: obj.targetObjectId,
            previousValue: obj.previousValue,
            valueToSet: obj.valueToSet,
            field: obj.field,
            sublistLineStartingFrom1: obj.sublistLineStartingFrom1,
            group: obj.group,
        });
    }

}