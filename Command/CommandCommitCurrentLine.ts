import {Command} from "./Command";
import {record} from "N";
import {CommandContext} from "./CommandContext";


interface CommandCommitCurrentLineInterface {
    details: string
    targetObjectType: string
    targetObjectId: string
    sublistId: string
    group: string
}

export class CommandCommitCurrentLine implements Command {
    details: string;
    targetObjectType: string;
    targetObjectId: string;
    sublistId: string;
    group: string;
    type: string = `CommandCommitCurrentLine`;
    [key: string]: unknown;
    constructor(args: CommandCommitCurrentLineInterface) {
        this.details = args.details;
        this.targetObjectType = args.targetObjectType;
        this.targetObjectId = args.targetObjectId;
        this.sublistId = args.sublistId;
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
        * For CommandCommitCurrentLine context must present and contain loaded record
         */
        if (!context) {
            return {result: `For CommandCommitCurrentLine context must present and contain loaded record`, failed: true};
        }
        if (!context.loadedClientRecords && !context.loadedRecords) {
            context.result = `For CommandCommitCurrentLine context must contain loaded record`;
            context.failed = true;
            return context;
        }
        if (context.loadedClientRecords && !context.loadedClientRecords[this.targetObjectId] && context.loadedRecords && !context.loadedRecords[this.targetObjectId]) {
            context.result = `For CommandCommitCurrentLine context must contain loaded record with the same id as targetObjectId: "${this.targetObjectId}"`;
            context.failed = true;
            return context;
        }
        return context;
    }

    shortDescribe(): string {
        return `${this.type} commits new line in ${this.targetObjectType} ${this.targetObjectId} sublist ${this.sublistId}`;
    }

    execute(context: CommandContext, log?: (s: string) => void): CommandContext {
        try {
            const loadedRecord = context.loadedClientRecords
                ? (context.loadedClientRecords as {[key: string]: record.ClientCurrentRecord})[this.targetObjectId]
                : (context.loadedRecords as {[key: string]: record.Record})[this.targetObjectId]; // can be sure it's not null since it's been checked in conditionsToStop
            loadedRecord.commitLine({sublistId: this.sublistId});
        }
        catch (e) {
            if (!context) {
                context = {};
            }
            log?.(`Error in CommandCommitCurrentLine: ${JSON.stringify(e)}`);
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
        const obj = JSON.parse(s) as CommandCommitCurrentLine;
        return new CommandCommitCurrentLine({
            details: obj.details,
            targetObjectType: obj.targetObjectType,
            targetObjectId: obj.targetObjectId,
            sublistId: obj.sublistId,
            group: obj.group
        });
    }

}