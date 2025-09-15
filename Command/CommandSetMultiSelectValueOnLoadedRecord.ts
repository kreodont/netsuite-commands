import {Command} from "./Command";
import {Type} from "N/record";
import {record} from "N";
import {CommandContext} from "./CommandContext";


interface CommandSetMultiSelectValueOnLoadedRecordInterface {
    details: string
    targetObjectType: Type | string
    targetObjectId: string
    previousValue: string[] | null
    valueToSet: string[]
    field: string
    sublistId: string | null
    sublistLineStartingFrom1: number
    sublistLineUniqueId: number | null // null in Create mode
    group: string
}

export class CommandSetMultiSelectValueOnLoadedRecord implements Command {
    details: string;
    targetObjectType: Type | string;
    targetObjectId: string;
    group: string; // for CommandSetMultiSelectValueOnLoadedRecord group is mandatory
    type: string = `CommandSetMultiSelectValueOnLoadedRecord`;
    previousValue: string[] | null;
    valueToSet: string[];
    field: string;
    sublistId: string | null;
    sublistLineStartingFrom1: number; // 0 for body fields
    sublistLineUniqueId: number | null;
    [key: string]: unknown;
    constructor(args: CommandSetMultiSelectValueOnLoadedRecordInterface) {
        this.details = args.details;
        this.targetObjectType = args.targetObjectType;
        this.targetObjectId = args.targetObjectId;
        this.previousValue = args.previousValue;
        this.valueToSet = args.valueToSet;
        this.field = args.field;
        this.sublistId = args.sublistId;
        this.sublistLineStartingFrom1 = args.sublistLineStartingFrom1;
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
        /*
        * For CommandSetValueOnLoadedRecord context must present and contain loaded record
         */
        if (!context) {
            return {result: `For CommandSetValueOnLoadedRecord context must present and contain loaded record`, failed: true};
        }
        if (!context.loadedRecords) {
            context.result = `For CommandSetValueOnLoadedRecord context must contain loaded record`;
            context.failed = true;
            return context;
        }
        if (!context.loadedRecords[this.targetObjectId]) {
            context.result = `For CommandSetValueOnLoadedRecord context must contain loaded record with the same id as targetObjectId: "${this.targetObjectId}"`;
            context.failed = true;
            return context;
        }
        return context;
    }

    shortDescribe(): string {
        if (this.sublistId) {
            return `${this.type} sets ${this.targetObjectType} ${this.targetObjectId} ${this.sublistId} sublist line ${this.sublistLineStartingFrom1} ${this.field} from ${this.previousValue} to ${this.valueToSet}`;
        }
        return `${this.type} sets ${this.targetObjectType} ${this.targetObjectId} ${this.field} from ${this.previousValue} to ${JSON.stringify(this.valueToSet)}`;
    }

    execute(context: CommandContext, log?: (s: string) => void): CommandContext {
        try {
            const loadedRecord = (context.loadedRecords as {[key: string]: record.Record})[this.targetObjectId]; // can be sure it's not null since it's been checked in conditionsToStop
            if (this.sublistId) {
                log?.(`Setting ${this.field} to ${this.valueToSet} (type ${typeof this.valueToSet}) on ${this.targetObjectType} ${this.targetObjectId} sublist ${this.sublistId} line ${this.sublistLineStartingFrom1}`);
                loadedRecord.selectLine({
                    sublistId: this.sublistId,
                    line: this.sublistLineStartingFrom1 - 1,
                });
                loadedRecord.setCurrentSublistValue({
                    sublistId: this.sublistId,
                    fieldId: this.field,
                    value: this.valueToSet
                });
                loadedRecord.commitLine({
                    sublistId: this.sublistId
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
        const obj = JSON.parse(s) as CommandSetMultiSelectValueOnLoadedRecord;
        return new CommandSetMultiSelectValueOnLoadedRecord({
            details: obj.details,
            targetObjectType: obj.targetObjectType,
            targetObjectId: obj.targetObjectId,
            previousValue: obj.previousValue,
            valueToSet: obj.valueToSet,
            field: obj.field,
            sublistId: obj.sublistId,
            sublistLineStartingFrom1: obj.sublistLineStartingFrom1,
            sublistLineUniqueId: obj.sublistLineUniqueId,
            group: obj.group
        });
    }

}