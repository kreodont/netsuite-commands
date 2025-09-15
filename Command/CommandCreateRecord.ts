import {Command} from "./Command";
import {record} from "N";
import {CommandContext} from "./CommandContext";


interface CommandCreateRecordInterface {
    details: string
    targetObjectType: string
    temporaryId: string // This is a temporary id that will be used to identify the record
    group: string

}

export class CommandCreateRecord implements Command {
    details: string;
    targetObjectType: string;
    temporaryId: string;
    group: string = ``;
    type: string = `CommandCreateRecord`;
    [key: string]: unknown;
    constructor(args: CommandCreateRecordInterface) {
        this.details = args.details;
        this.targetObjectType = args.targetObjectType;
        this.temporaryId = args.temporaryId;
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
        return `Creating record "${this.targetObjectType}" with temporary id "${this.temporaryId}"`;
    }

    execute(context: CommandContext): CommandContext {
        try {
            const createdRecord = record.create({
                type: this.targetObjectType,
                isDynamic: true
            });
            if (!context) {
                context = {};
            }
            if (!context.loadedRecords) {
                context.loadedRecords = {};
            }
            context.loadedRecords[this.temporaryId] = createdRecord; // since the record is not saved yet, we use the temporary id
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
        const obj = JSON.parse(s) as CommandCreateRecordInterface;
        return new CommandCreateRecord({
            details: obj.details,
            targetObjectType: obj.targetObjectType,
            temporaryId: obj.temporaryId,
            group: obj.group
        });
    }

}