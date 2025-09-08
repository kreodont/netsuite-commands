import {Command} from "./Command";
import {Type} from "N/record";
import {record} from "N";
import {CommandContext} from "./CommandContext";


interface CommandSelectLineInterface {
    details: string
    targetObjectType: Type
    targetObjectId: string
    sublistId: string
    sublistLineStartingFrom1: number
    sublistLineUniqueId: number | null // null in Create mode
    group: string
}

export class CommandSelectLine implements Command {
    details: string;
    targetObjectType: Type;
    targetObjectId: string;
    sublistId: string;
    sublistLineStartingFrom1: number;
    sublistLineUniqueId: number | null; // null in Create mode
    group: string;
    type: string = `CommandSelectLine`;
    [key: string]: unknown;
    constructor(args: CommandSelectLineInterface) {
        this.details = args.details;
        this.targetObjectType = args.targetObjectType;
        this.targetObjectId = args.targetObjectId;
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
        * For CommandSelectLine context must present and contain loaded record
         */
        if (!context) {
            return {result: `For CommandSelectLine context must present and contain loaded record`, failed: true};
        }
        if (!context.loadedClientRecords && !context.loadedRecords) {
            context.result = `For CommandSelectLine context must contain loaded record`;
            context.failed = true;
            return context;
        }
        if (context.loadedClientRecords && !context.loadedClientRecords[this.targetObjectId] && context.loadedRecords && !context.loadedRecords[this.targetObjectId]) {
            context.result = `For CommandSelectLine context must contain loaded record with the same id as targetObjectId: "${this.targetObjectId}"`;
            context.failed = true;
            return context;
        }
        return context;
    }

    shortDescribe(): string {
        if (this.sublistLineUniqueId) {
            return `${this.type} selects line with unique id ${this.sublistLineUniqueId} in ${this.targetObjectType} ${this.targetObjectId} sublist ${this.sublistId}`;
        }
        return `${this.type} selects line ${this.sublistLineStartingFrom1} in ${this.targetObjectType} ${this.targetObjectId} sublist ${this.sublistId}`;
    }

    execute(context: CommandContext, log?: (s: string) => void): CommandContext {
        try {
            const loadedRecord = context.loadedClientRecords
                ? (context.loadedClientRecords as {[key: string]: record.ClientCurrentRecord})[this.targetObjectId]
                : (context.loadedRecords as {[key: string]: record.Record})[this.targetObjectId]; // can be sure it's not null since it's been checked in conditionsToStop
            loadedRecord.selectLine({sublistId: this.sublistId, line: this.sublistLineStartingFrom1 - 1});
        }
        catch (e) {
            if (!context) {
                context = {};
            }
            log?.(`Error in CommandSelectLine: ${JSON.stringify(e)}`);
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
        const obj = JSON.parse(s) as CommandSelectLine;
        return new CommandSelectLine({
            details: obj.details,
            targetObjectType: obj.targetObjectType,
            targetObjectId: obj.targetObjectId,
            sublistId: obj.sublistId,
            sublistLineStartingFrom1: obj.sublistLineStartingFrom1,
            sublistLineUniqueId: obj.sublistLineUniqueId,
            group: obj.group
        });
    }

}