import {Command} from "./Command";
import {record} from "N";
import {CommandContext} from "./CommandContext";


interface CommandTransformRecordInterface {
    details: string
    fromType: string
    fromId: string
    toType: string
    group: string
    keepId?: string
}

export class CommandTransformRecord implements Command {
    details: string;
    fromType: string;
    fromId: string;
    toType: string;
    group: string = ``;
    keepId?: string;
    type: string = `CommandTransformRecord`;
    [key: string]: unknown;
    
    constructor(args: CommandTransformRecordInterface) {
        this.details = args.details;
        this.fromType = args.fromType;
        this.fromId = args.fromId;
        this.toType = args.toType;
        this.group = args.group;
        this.keepId = args.keepId;
    }

    aftermathToStop(context: CommandContext): CommandContext {
        return context;
    }

    conditionsToSkip(context: CommandContext): CommandContext {
        return context;
    }

    conditionsToStop(context: CommandContext): CommandContext {
        /*
        * For CommandTransformRecord no conditions to stop
        */
        return context;
    }

    shortDescribe(): string {
        return `Transforming ${this.fromType} ${this.fromId} to ${this.toType}`;
    }

    execute(context: CommandContext): CommandContext {
        try {
            const transformedRecord = record.transform({
                fromType: this.fromType,
                fromId: Number(this.fromId),
                toType: this.toType,
                isDynamic: true,
            });
            
            if (!context) {
                context = {};
            }
            if (!context.loadedRecords) {
                context.loadedRecords = {};
            }
            if (!context.output) {
                context.output = {};
            }
            
            // Store the transformed record in loadedRecords
            // Use a unique key to identify this transformed record
            const recordKey = this.keepId || this.group || `transformed_${Date.now()}`;
            context.loadedRecords[recordKey] = transformedRecord;
            
            // Store the key in output for template substitution
            if (this.keepId) {
                context.output[this.keepId] = recordKey;
            } else {
                context.output[this.group] = recordKey;
            }
            
            context.failed = false;
            context.result = `Successfully transformed ${this.fromType} ${this.fromId} to ${this.toType}`;
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
        const obj = JSON.parse(s) as CommandTransformRecordInterface;
        return new CommandTransformRecord({
            details: obj.details,
            fromType: obj.fromType,
            fromId: obj.fromId,
            toType: obj.toType,
            group: obj.group,
            keepId: obj.keepId
        });
    }
}