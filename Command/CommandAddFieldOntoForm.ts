import {Command} from "./Command";
import {CommandContextServer} from "./CommandContextServer";
import {FieldType, Form, FieldDisplayType} from "N/ui/serverWidget";


interface CommandAddFieldOntoFormInterface {
    details: string
    fieldName: string,
    fieldType: FieldType,
    formId: string,
    hidden?: boolean,
    inline?: boolean,
    inactive?: boolean,
    group: string
}

export class CommandAddFieldOntoForm implements Command {
    details: string;
    fieldName: string;
    fieldType: FieldType;
    formId: string;
    hidden?: boolean;
    inline?: boolean;
    inactive?: boolean;
    group: string;
    type: string = `CommandAddFieldOntoForm`;
    [key: string]: unknown; // to make it possible to iterate over properties
    constructor(args: CommandAddFieldOntoFormInterface) {
        this.details = args.details;
        this.fieldName = args.fieldName;
        this.fieldType = args.fieldType;
        this.formId = args.formId;
        this.hidden = args.hidden === undefined ? false : args.hidden;
        this.inline = args.inline === undefined ? false : args.inline;
        this.inactive = args.inactive === undefined ? false : args.inactive;
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
            context.result = `For CommandAddFieldOntoForm context must contain form with id ${this.formId}`;
            return context;
        }
        return context;
    }

    shortDescribe(): string {
        return `${this.type} sets ${this.targetObjectType} ${this.targetObjectId} ${this.field} from ${this.previousValue} to ${this.valueToSet}`;
    }

    execute(context: CommandContextServer): CommandContextServer {
        try {
            const form = (context.forms as {[key: string]: Form})[this.formId]; // can be sure it's not null since it's been checked in conditionsToStop
            const field = form.addField({
                id: this.fieldName,
                type: this.fieldType,
                label: this.fieldName
            });
            if (this.inline) {
                field.updateDisplayType({
                    displayType: FieldDisplayType.INLINE
                });
            }
            if (this.inactive) {
                field.updateDisplayType({
                    displayType: FieldDisplayType.DISABLED
                });
            }
            if (this.hidden) {
                field.updateDisplayType({
                    displayType: FieldDisplayType.HIDDEN
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

    undo(context: CommandContextServer, log?: (s: string) => void): CommandContextServer {
        log?.(`Doing nothing, because this is a command that cannot be undone`);
        return context;
    }

    static fromString(s: string): Command {
        const obj = JSON.parse(s) as CommandAddFieldOntoForm;
        return new CommandAddFieldOntoForm({
            formId: obj.formId,
            details: obj.details,
            fieldName: obj.fieldName,
            fieldType: obj.fieldType,
            hidden: obj.hidden,
            inline: obj.inline,
            inactive: obj.inactive,
            group: obj.group
        });
    }

}