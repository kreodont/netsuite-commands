import {Command} from "./Command";
import {CommandContext} from "./CommandContext";

export class CommandThrowException implements Command {
    type: string = `CommandThrowException`;
    group: string = `CommandThrowException`;
    details: string;
    [key: string]: unknown;
    execute(context: CommandContext): CommandContext {
        return context; // the real exception will be raised in CommandHandler execute commands
    }
    undo(context: CommandContext): CommandContext{
        return context;
    }
    fallBack(): Command[]{
        return [];
    }
    shortDescribe(): string {
        return `Throw exception: ${this.details}`;
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
        const obj = JSON.parse(s) as CommandThrowException;
        return new CommandThrowException(obj.details);
    }
}
