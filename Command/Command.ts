import {CommandContext} from "./CommandContext";


export interface Command {
    type: string;
    details: string;
    group: string; // to have the ability to split commands to different MapReduce jobs
    optional?: boolean; // if true, the command can be skipped on fail
    execute(context?: CommandContext, log?: (s: string) => void): CommandContext;
    undo(context?: CommandContext, log?: (s: string) => void): CommandContext;
    fallBack(context?: CommandContext, log?: (s: string) => void): Command[]; // don't run immediately, just create another command (or several) to run
    shortDescribe(): string; // for using in lists
    conditionsToSkip(context?: CommandContext, log?: (s: string) => void): CommandContext;
    conditionsToStop(context?: CommandContext, log?: (s: string) => void): CommandContext;
    aftermathToStop(context?: CommandContext, log?: (s: string) => void): CommandContext;
    toStr(): string; // serialize to string
    [key: string]: unknown; // to make it possible to iterate over all properties
}

export function listOfCommandsToString(commands: Command[]): string {
    return commands.map(command => command.toStr()).join(`,,,`);
}
