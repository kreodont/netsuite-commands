import {Command} from "./Command";
import {record} from "N";
import {CommandContext} from "./CommandContext";


interface CommandLockUnlockFieldInterface {
    details: string
    field: string
    lockOrUnlock: `lock` | `unlock`
    group: string
}


export class CommandLockUnlockField implements Command {
    details: string;
    group: string;
    type: string = `CommandLockUnlockField`;
    field: string;
    lockOrUnlock: `lock` | `unlock`;
    [key: string]: unknown;
    constructor(args: CommandLockUnlockFieldInterface) {
        this.details = args.details;
        this.field = args.field;
        this.lockOrUnlock = args.lockOrUnlock;
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
        * For CommandLockUnlockField context must present and contain loaded record
         */
        if (!context) {
            return {result: `For CommandLockUnlockField context must present and contain loaded record`, failed: true};
        }
        if (!context.loadedClientRecords) {
            context.result = `For CommandLockUnlockField context must contain loaded current record`;
            context.failed = true;
            return context;
        }
        if (!context.loadedClientRecords[this.group]) {
            context.result = `For CommandLockUnlockField context must contain loaded current record with the same id as group: "${this.group}"`;
            context.failed = true;
            return context;
        }
        return context;
    }

    shortDescribe(): string {
        return `${this.type} ${this.lockOrUnlock}s ${this.field} on ${this.group}`;
    }

    execute(context: CommandContext): CommandContext {
        try {
            const loadedRecord = (context.loadedClientRecords as {[key: string]: record.ClientCurrentRecord})[this.group]; // can be sure it's not null since it's been checked in conditionsToStop
            const field = loadedRecord.getField({fieldId: this.field});
            if (!field) {
                context.failed = true;
                context.result = `Cannot find field ${this.field} on form`;
                return context;
            }
            field.isDisabled = this.lockOrUnlock === `lock`;
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
        return JSON.parse(s) as CommandLockUnlockField;
    }

}