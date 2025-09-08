import {Command} from "./Command";
import {record} from "N";
import {CommandContext} from "./CommandContext";


interface CommandDeleteRecordInterface {
    details: string
    targetObjectType: string
    id: string
    group: string

}

export class CommandDeleteRecord implements Command {
    details: string;
    targetObjectType: string;
    id: string;
    group: string = ``;
    type: string = `CommandDeleteRecord`;
    [key: string]: unknown;
    constructor(args: CommandDeleteRecordInterface) {
        this.details = args.details;
        this.targetObjectType = args.targetObjectType;
        this.group = args.group;
        this.id = args.id;
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
        return `Deleting record "${this.targetObjectType}" with id "${this.id}"`;
    }

    execute(context: CommandContext): CommandContext {
        try {
            record.delete({id: this.id, type: this.targetObjectType});
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
        const obj = JSON.parse(s) as CommandDeleteRecordInterface;
        return new CommandDeleteRecord({
            details: obj.details,
            targetObjectType: obj.targetObjectType,
            id: obj.id,
            group: obj.group
        });
    }

}