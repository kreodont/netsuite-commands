import {Command} from "./Command";
import {FieldValue, Type} from "N/record";
import {record} from "N";
import {EmptyCommand} from "./EmptyCommand";
import {CommandContext} from "./CommandContext";


interface CommandSetFieldsValuesWithoutLoadingRecordInterface {
    details: string
    targetObjectType: Type | string
    targetObjectId: string
    targetFieldNameToValue: {[key: string]: FieldValue}
    previousFieldNameToValue?: {[key: string]: FieldValue} | null
    group?: string
}

export class CommandSetFieldsValuesWithoutLoadingRecord implements Command {
    details: string;
    targetObjectType: Type | string; // string for custom records
    targetObjectId: string;
    group: string = ``;
    type: string = `CommandSetFieldsValuesWithoutLoadingRecord`;
    targetFieldNameToValue: {[key: string]: FieldValue};
    previousFieldNameToValue: {[key: string]: FieldValue};
    [key: string]: unknown;
    constructor(args: CommandSetFieldsValuesWithoutLoadingRecordInterface) {
        this.details = args.details;
        this.targetObjectType = args.targetObjectType;
        this.targetObjectId = args.targetObjectId;
        this.targetFieldNameToValue = args.targetFieldNameToValue;
        this.previousFieldNameToValue = args.previousFieldNameToValue ? args.previousFieldNameToValue : {};
        this.group = args.group ? args.group : ``;
    }

    aftermathToStop(context: CommandContext): CommandContext {
        return context;
    }

    conditionsToSkip(context: CommandContext): CommandContext {
        return context;
    }

    conditionsToStop(context: CommandContext): CommandContext {
        return context;
    }

    shortDescribe(): string {
        const fieldValues = Object.entries(this.targetFieldNameToValue)
            .map(([key, value]) => {
                let output = `${key} to ${JSON.stringify(value)}`;
                if (this.previousFieldNameToValue && Object.prototype.hasOwnProperty.call(this.previousFieldNameToValue, key)) {
                    output = `${key} from ${JSON.stringify(this.previousFieldNameToValue[key])} to ${JSON.stringify(value)}`;
                }
                return output;
            })
            .join(`, `);

        return `${this.type} sets ${this.targetObjectType} ${this.targetObjectId} ${fieldValues}`;
    }

    execute(context: CommandContext): CommandContext {
        try {
            record.submitFields({
                id: this.targetObjectId,
                type: this.targetObjectType,
                values: this.targetFieldNameToValue,
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                }
            });
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
        if (Object.keys(this.previousFieldNameToValue).length === 0) {
            return [new EmptyCommand(`No previous values to fallback`)];
        }
        return [new CommandSetFieldsValuesWithoutLoadingRecord({
            details: this.details,
            targetObjectType: this.targetObjectType,
            targetObjectId: this.targetObjectId,
            targetFieldNameToValue: this.previousFieldNameToValue,
            previousFieldNameToValue: this.targetFieldNameToValue,
            group: this.group,
        })];
    }

    toStr(): string {
        return JSON.stringify(this);
    }

    undo(context: CommandContext, log?: (s: string) => void): CommandContext {
        log?.(`Doing nothing, because this is a command that cannot be undone`);
        return context;
    }

    static fromString(s: string): Command {
        const obj = JSON.parse(s) as CommandSetFieldsValuesWithoutLoadingRecord;
        for (const key in obj.targetFieldNameToValue) {
            const value = obj.targetFieldNameToValue[key];
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)) {
                obj.targetFieldNameToValue[key] = new Date(value);
            }
        }

        return new CommandSetFieldsValuesWithoutLoadingRecord({
            details: obj.details,
            targetObjectType: obj.targetObjectType,
            targetObjectId: obj.targetObjectId,
            targetFieldNameToValue: obj.targetFieldNameToValue,
            previousFieldNameToValue: obj.previousFieldNameToValue,
            group: obj.group,
        });
    }

}