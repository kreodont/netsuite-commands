import {Command} from "./Command";
import {record} from "N";
import {CommandRecordAttachInterface} from "./CommandRecordAttach";
import {CommandContext} from "./CommandContext";


export class CommandRecordDetach implements Command, CommandRecordAttachInterface {
    type: string = `CommandRecordDetach`;
    group: string = ``;
    details: string;
    attachableRecordId: number;
    attachableRecordType: record.Type | string;
    targetRecordId: number;
    targetRecordType: record.Type | string;
    optional?: boolean;
    [key: string]: unknown;
    execute(context: CommandContext): CommandContext {
        record.detach({
            record: {
                type: this.attachableRecordType,
                id: this.attachableRecordId,
            },
            from: { type: this.targetRecordType, id: this.targetRecordId },
        });
        return context;
    }
    undo(context: CommandContext): CommandContext{
        return context;
    }
    fallBack(): Command[]{
        return [];
    }
    shortDescribe(): string {
        return `Detach record ${this.attachableRecordType} ${this.attachableRecordId} from ${this.targetRecordType} ${this.targetRecordId}`;
    }
    conditionsToSkip(context: CommandContext): CommandContext {
        return context;
    }
    conditionsToStop(context: CommandContext): CommandContext {
        return context;
    }
    aftermathToStop(context: CommandContext): CommandContext {
        return context;
    }
    toStr(): string {
        return JSON.stringify(this);
    }
    constructor(args: CommandRecordAttachInterface) {
        this.details = args.details;
        this.targetRecordId = args.targetRecordId;
        this.targetRecordType = args.targetRecordType;
        this.attachableRecordId = args.attachableRecordId;
        this.attachableRecordType = args.attachableRecordType;
        this.optional = args.optional;
        this.group = args.group;

    }
    static fromString(s: string): Command {
        const obj = JSON.parse(s) as CommandRecordAttachInterface;
        return new CommandRecordDetach(obj);
    }
}
