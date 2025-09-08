import {Command} from "./Command";
import {CommandContextServer} from './CommandContextServer';
import {FieldValue} from "N/record";
import {Form} from "N/ui/serverWidget";


interface CommandSetValueOnFormInterface {
    details: string
    formId: string
    previousValue: FieldValue
    valueToSet: FieldValue
    field: string
    sublistId: string | null
    sublistLineUniqueId: number | null // null in Create mode
    sublistLineStartingFrom1: number // 0 for body fields
    group: string
}

export class CommandSetValueOnForm implements Command {
    details: string;
    formId: string;
    group: string;
    type: string = `CommandSetValueOnForm`;
    previousValue: FieldValue;
    valueToSet: FieldValue;
    field: string;
    sublistId: string | null;
    sublistLineStartingFrom1: number; // 0 for body fields
    sublistLineUniqueId: number | null;
    [key: string]: unknown;
    constructor(args: CommandSetValueOnFormInterface) {
        this.details = args.details;
        this.formId = args.formId;
        this.previousValue = args.previousValue;
        this.valueToSet = args.valueToSet;
        this.field = args.field;
        this.sublistId = args.sublistId;
        this.sublistLineStartingFrom1 = args.sublistLineStartingFrom1;
        this.sublistLineUniqueId = args.sublistLineUniqueId;
        this.group = args.group;
    }

    aftermathToStop(context: CommandContextServer): CommandContextServer {
        return context;
    }

    conditionsToSkip(context: CommandContextServer): CommandContextServer {
        return context;
    }

    conditionsToStop(context: CommandContextServer): CommandContextServer {
        if (!context || !context.forms || !context.forms[this.formId]) {
            context.failed = true;
            context.result = `For CommandSetValueOnForm context must contain form with id ${this.formId}`;
            return context;
        }
        return context;
    }

    shortDescribe(): string {
        if (this.sublistId) {
            return `${this.type} sets on form ${this.sublistId} sublist current line ${this.field} from ${this.previousValue} to ${this.valueToSet}`;
        }
        return `${this.type} sets on form ${this.field} from ${this.previousValue} to ${this.valueToSet}`;
    }

    execute(context: CommandContextServer, log?: (s: string) => void): CommandContextServer {
        try {
            const form = (context.forms as {[key: string]: Form})[this.formId]; // can be sure it's not null since it's been checked in conditionsToStop
            if (this.sublistId) {
                log?.(`Setting ${this.field} to ${this.valueToSet} (type ${typeof this.valueToSet}) on ${this.targetObjectType} ${this.targetObjectId} sublist ${this.sublistId} current line`);
                const sublist = form.getSublist({
                    id: this.sublistId
                });
                sublist.setSublistValue({
                    id: this.field,
                    line: this.sublistLineStartingFrom1 - 1,
                    value: this.valueToSet ? String(this.valueToSet) : ` `
                });
            }
            else {
                log?.(`Setting ${this.field} to ${this.valueToSet} (type ${typeof this.valueToSet}) on ${this.targetObjectType} ${this.targetObjectId}`);
                const field = form.getField({
                    id: this.field
                });
                field.defaultValue = this.valueToSet ? String(this.valueToSet) : ` `;
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

    undo(context: CommandContextServer, log?: (s: string) => void): CommandContextServer {
        log?.(`Doing nothing, because this is a command that cannot be undone`);
        return context;
    }

    static fromString(s: string): Command {
        const obj = JSON.parse(s) as CommandSetValueOnForm;
        const value = obj.valueToSet;
        if (typeof value === `string` && value.endsWith(`.000Z`)) { // date is parsed as a string, need to convert it back to Date
            obj.valueToSet = new Date(value);
        }
        return new CommandSetValueOnForm({
            details: obj.details,
            formId: obj.formId,
            previousValue: obj.previousValue,
            valueToSet: obj.valueToSet,
            field: obj.field,
            sublistId: obj.sublistId,
            sublistLineUniqueId: obj.sublistLineUniqueId,
            group: obj.group,
            sublistLineStartingFrom1: obj.sublistLineStartingFrom1
        });
    }

}