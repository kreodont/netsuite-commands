import {Command} from "./Command";
import {record} from "N";
import {CommandContext} from "./CommandContext";

export interface CommandRecordAttachInterface{
    group: string;
    details: string;
    attachableRecordId: number;
    attachableRecordType: record.Type | string;
    targetRecordId: number;
    targetRecordType: record.Type | string;
    optional?: boolean;
}

export class CommandRecordAttach implements Command, CommandRecordAttachInterface {
    type: string = `CommandRecordAttach`;
    group: string = ``;
    details: string;
    attachableRecordId: number;
    attachableRecordType: record.Type | string;
    targetRecordId: number;
    targetRecordType: record.Type | string;
    optional?: boolean;
    [key: string]: unknown;
    execute(context: CommandContext): CommandContext {
        record.attach({
            record: {
                type: this.attachableRecordType,
                id: this.attachableRecordId,
            },
            to: { type: this.targetRecordType, id: this.targetRecordId },
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
        return `Attach record ${this.attachableRecordType} ${this.attachableRecordId} to ${this.targetRecordType} ${this.targetRecordId}`;
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
        return new CommandRecordAttach(obj);
    }
}
