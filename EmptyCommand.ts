import {Command} from "./Command";
import {CommandContext} from "./CommandContext";

export class EmptyCommand implements Command {
    type: string = `EmptyCommand`;
    group: string = `EmptyGroup`;
    details: string;
    [key: string]: unknown;
    execute(context: CommandContext): CommandContext {
        return context;
    }
    undo(context: CommandContext): CommandContext{
        return context;
    }
    fallBack(): Command[]{
        return [];
    }
    shortDescribe(): string {
        return `Empty Command`;
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
    constructor(details: string) {
        this.details = details;
    }
    static fromString(s: string): Command {
        const obj = JSON.parse(s) as EmptyCommand;
        return new EmptyCommand(obj.details);
    }
}
