import {Command} from "./Command";
import {Record, Type} from "N/record";
import {CommandContext} from "./CommandContext";


interface CommandSaveRecordInterface {
    details: string
    targetObjectType: Type | string // string for custom records
    targetObjectId: string
    group: string
    ignoreMandatoryFields?: boolean
    enableSourcing?: boolean
    keepId?: string

}

export class CommandSaveRecord implements Command {
    details: string;
    targetObjectType: Type | string;
    targetObjectId: string;
    group: string = ``;
    ignoreMandatoryFields?: boolean = true;
    enableSourcing?: boolean = false;
    keepId?: string; // if set, the id of the saved record will be stored in context.output[keepId]
    type: string = `CommandSaveRecord`;
    [key: string]: unknown;
    constructor(args: CommandSaveRecordInterface) {
        this.details = args.details;
        this.targetObjectType = args.targetObjectType;
        this.targetObjectId = args.targetObjectId;
        this.ignoreMandatoryFields = args.ignoreMandatoryFields;
        this.enableSourcing = args.enableSourcing;
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
        * For CommandSaveRecord context must present and contain loaded record
         */
        if (!context) {
            context = {result: `For CommandSaveRecord context must present and contain loaded record`, failed: true};
            return context;
        }
        if (!context.loadedRecords) {
            context.result = `For CommandSaveRecord context must contain loaded record`;
            context.failed = true;
            return context;
        }
        if (!context.loadedRecords[this.targetObjectId]) {
            context.result = `For CommandSaveRecord context must contain loaded record with the same id as targetObjectId`;
            context.failed = true;
            return context;
        }
        return context;
    }

    shortDescribe(): string {
        return `Saving record ${this.targetObjectType} ${this.targetObjectId}`;
    }

    execute(context: CommandContext): CommandContext {
        try {
            const loadedRecord = (context.loadedRecords as {[key: string]: Record})[this.targetObjectId]; // can be sure it's not null since it's been checked in conditionsToStop
            const recordId = loadedRecord.save({ignoreMandatoryFields: true, enableSourcing: false});
            if (!context) {
                context = {};
            }
            if (!recordId) {
                context.result = `Record ${this.targetObjectType} ${this.targetObjectId} not saved`;
                context.failed = true;
                return context;
            }
            context.result = `Record ${this.targetObjectType} ${recordId} saved`;
            if (!context.output) {
                context.output = {};
            }

            if (this.keepId) {
                context.output[this.keepId as string] = String(recordId);
            }
            else {
                context.output[this.group] = String(recordId);
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

    undo(context: CommandContext, log?: (s: string) => void): CommandContext {
        log?.(`Doing nothing, because this is a command that cannot be undone`);
        return context;
    }

    static fromString(s: string): Command {
        const obj = JSON.parse(s) as CommandSaveRecordInterface;
        return new CommandSaveRecord({
            details: obj.details,
            targetObjectType: obj.targetObjectType,
            targetObjectId: obj.targetObjectId,
            group: obj.group,
            ignoreMandatoryFields: obj.ignoreMandatoryFields,
            enableSourcing: obj.enableSourcing,
            keepId: obj.keepId,
        });
    }

}