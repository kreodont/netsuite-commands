import {Command} from "./Command";
import {record} from "N";
import {CommandContext} from "./CommandContext";


interface CommandLoadRecordInterface {
    details: string
    targetObjectType: string
    targetObjectId: string
    group: string

}

export class CommandLoadRecord implements Command {
    details: string;
    targetObjectType: string;
    targetObjectId: string;
    group: string = ``;
    type: string = `CommandLoadRecord`;
    [key: string]: unknown;
    constructor(args: CommandLoadRecordInterface) {
        this.details = args.details;
        this.targetObjectType = args.targetObjectType;
        this.targetObjectId = args.targetObjectId;
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
        * For CommandLoadRecord no conditions to stop
        */
        return context;
    }

    shortDescribe(): string {
        return `Loading record ${this.targetObjectType} ${this.targetObjectId}`;
    }

    execute(context: CommandContext): CommandContext {
        try {
            const loadedRecord = record.load({
                type: this.targetObjectType,
                id: this.targetObjectId,
                isDynamic: true,
            });
            if (!context) {
                context = {};
            }
            if (!context.loadedRecords) {
                context.loadedRecords = {};
            }
            context.loadedRecords[String(loadedRecord.id)] = loadedRecord;
            context.failed = false;
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
        const obj = JSON.parse(s) as CommandLoadRecordInterface;
        return new CommandLoadRecord({
            details: obj.details,
            targetObjectType: obj.targetObjectType,
            targetObjectId: obj.targetObjectId,
            group: obj.group
        });
    }

}