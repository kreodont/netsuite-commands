import {Command} from "./Command";
import {record} from "N";
import {FieldValue} from "N/record";
import {CommandContext} from "./CommandContext";


interface CommandAddAddressInterface {
    details: string
    addressFields: {[fieldName: string]: FieldValue}
    targetObjectId: string;
    targetObjectType: string;
    group?: string;
}

export class CommandAddAddress implements Command {
    details: string;
    addressFields: {[fieldName: string]: FieldValue};
    targetObjectId: string;
    targetObjectType: string;
    type: string = `CommandAddAddress`;
    group: string;
    [key: string]: unknown;
    constructor(args: CommandAddAddressInterface) {
        this.details = args.details;
        this.addressFields = args.addressFields;
        this.group = args.group ? args.group : ``;
        this.targetObjectId = args.targetObjectId;
        this.targetObjectType = args.targetObjectType;
    }

    aftermathToStop(context: CommandContext): CommandContext {
        return context;
    }

    conditionsToSkip(context: CommandContext): CommandContext {
        return context;
    }

    conditionsToStop(context: CommandContext): CommandContext {
        /*
        * For CommandAddAddress context must present and contain loaded record
         */
        if (!context) {
            return {result: `For CommandAddAddress context must present and contain loaded record`, failed: true};
        }
        if (!context.loadedRecords) {
            context.result = `For CommandAddAddress context must contain loaded record`;
            context.failed = true;
            return context;
        }
        if (!context.loadedRecords[this.targetObjectId]) {
            context.result = `For CommandAddAddress context must contain loaded record with the same id as targetObjectId: "${this.targetObjectId}"`;
            context.failed = true;
            return context;
        }
        return context;
    }

    shortDescribe(): string {
        return `${this.type} adds new address to ${this.targetObjectType} ${this.targetObjectId}`;
    }

    execute(context: CommandContext): CommandContext {
        try {
            const loadedRecord = (context.loadedRecords as {[key: string]: record.Record})[this.targetObjectId]; // can be sure it's not null since it's been checked in conditionsToStop
            loadedRecord.selectNewLine({ sublistId: `addressbook` });
            const addressSubRecord = loadedRecord.getCurrentSublistSubrecord({
                fieldId: `addressbookaddress`,
                sublistId: `addressbook`,
            });
            for (const fields in this.addressFields) {
                addressSubRecord.setValue({
                    fieldId: fields,
                    value: this.addressFields[fields], // always set the value as string
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
            context.result = `${this.shortDescribe()} failed. Exception: ${JSON.stringify(e)}`;
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
        const obj = JSON.parse(s) as CommandAddAddressInterface;
        return new CommandAddAddress({
            details: obj.details,
            targetObjectType: obj.targetObjectType,
            targetObjectId: obj.targetObjectId,
            addressFields: obj.addressFields,
            group: obj.group,
        });
    }

}