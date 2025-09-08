import {Command} from "./Command";
import {record} from "N";
import {findLineNumberWithUniqueId} from "./CommandSetValueOnLoadedRecord";
import {CommandContext} from "./CommandContext";


interface CommandDeleteLineInterface {
    details: string
    targetObjectType: string
    targetObjectId: string
    sublistId: string
    sublistLineStartingFrom1: number
    sublistLineUniqueId: number | null // null in Create mode
    group: string
}

export class CommandDeleteLine implements Command {
    details: string;
    targetObjectType: string;
    targetObjectId: string;
    sublistId: string;
    sublistLineStartingFrom1: number;
    sublistLineUniqueId: number | null; // null in Create mode
    group: string;
    type: string = `CommandDeleteLine`;
    [key: string]: unknown;
    constructor(args: CommandDeleteLineInterface) {
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
        * For CommandDeleteLine context must present and contain loaded record
         */
        if (!context) {
            return {result: `For CommandDeleteLine context must present and contain loaded record`, failed: true};
        }
        if (!context.loadedClientRecords && !context.loadedRecords) {
            context.result = `For CommandDeleteLine context must contain loaded record`;
            context.failed = true;
            return context;
        }
        if (context.loadedClientRecords && !context.loadedClientRecords[this.targetObjectId] && context.loadedRecords && !context.loadedRecords[this.targetObjectId]) {
            context.result = `For CommandDeleteLine context must contain loaded record with the same id as targetObjectId: "${this.targetObjectId}"`;
            context.failed = true;
            return context;
        }
        return context;
    }

    shortDescribe(): string {
        if (this.sublistLineUniqueId) {
            return `${this.type} deletes line with unique id ${this.sublistLineUniqueId} from ${this.targetObjectType} ${this.targetObjectId} sublist ${this.sublistId}`;
        }
        return `${this.type} deletes line ${this.sublistLineStartingFrom1} from ${this.targetObjectType} ${this.targetObjectId} sublist ${this.sublistId}`;
    }

    execute(context: CommandContext, log?: (s: string) => void): CommandContext {
        try {
            let lineNumber = this.sublistLineStartingFrom1 - 1;
            const loadedRecord = context.loadedClientRecords
                ? (context.loadedClientRecords as {[key: string]: record.ClientCurrentRecord})[this.targetObjectId]
                : (context.loadedRecords as {[key: string]: record.Record})[this.targetObjectId]; // can be sure it's not null since it's been checked in conditionsToStop
            if (this.sublistLineUniqueId !== null) { // when setting by line unique id, need to find the line number first
                lineNumber = findLineNumberWithUniqueId(
                    loadedRecord,
                    this.sublistId as `item` | `addressbook`,
                    this.sublistLineUniqueId.toString()
                ) as number;
                if (lineNumber === null) { // couldn't find line with unique id
                    if (!context) {
                        context = {};
                    }
                    context.failed = true;
                    context.result = `${this.shortDescribe()} failed: line with unique id "${this.sublistLineUniqueId}" not found`;
                    return context;
                }
            }

            loadedRecord.removeLine({sublistId: this.sublistId, line: lineNumber});
        }
        catch (e) {
            if (!context) {
                context = {};
            }
            log?.(`Error in CommandDeleteLine: ${JSON.stringify(e)}`);
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
        const obj = JSON.parse(s) as CommandDeleteLine;
        return new CommandDeleteLine({
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