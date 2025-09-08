 import {Command} from "./Command";
import {CommandSetFieldsValuesWithoutLoadingRecord} from "./CommandSetValuesWithoutLoadingRecord";
import {task} from "N";
import {chunks} from "../netsuite-libs/Helpers";
import { CommandSaveRecord } from "./CommandSaveRecord";
import { CommandCreateRecord } from "./CommandCreateRecord";
import { CommandLoadRecord } from "./CommandLoadRecord";
import { CommandSetValueOnLoadedRecord } from "./CommandSetValueOnLoadedRecord";
import { CommandDeleteRecord } from "./CommandDeleteRecord";
import {CommandAddAddress} from "./CommandAddAddress";
import {CommandSetAddressFieldOnLoadedRecord} from "./CommandSetAddressFieldOnLoadedRecord";
import {EmptyCommand} from "./EmptyCommand";
import {CommandThrowException} from "./CommandThrowException";
import {CommandRecordAttach} from "./CommandRecordAttach";
import {CommandRecordDetach} from "./CommandRecordDetach";
import {CommandDeleteLine} from "./CommandDeleteLine";
import {CommandLockUnlockField} from "./CommandLockUnlockField";
import {FieldValue} from "N/record";
import {CommandSetMultiSelectValueOnLoadedRecord} from "./CommandSetMultiSelectValueOnLoadedRecord";
import {CommandCommitCurrentLine} from "./CommandCommitCurrentLine";
import {CommandContext} from "./CommandContext";
import {CommandAddLineDynamicMode} from "./CommandAddLineDynamicMode";
import {CommandSetTextOnLoadedRecord} from "./CommandSetTextOnLoadedRecord";

export interface CommandResult {
    shortDescribe: string;
    result: string;
    failed: boolean;
}

export function CommandResultsToString(results: CommandResult[]): string {
    let output = ``;
    for (const result of results) {
        output += `${result.shortDescribe}: ${result.result}___________________`;
    }
    return output;
}

function substituteTemplatesInValuesDict(values: {[key: string]: FieldValue}, replacements: {[key: string]: string}): {[key: string]: FieldValue} {
    /*
    * This function substitutes templates in values with values from context.output
    * If there "field_name": "<44395>" in the field values, and there is context.output["44395"] = "some value"
     */
    const result: {[key: string]: FieldValue} = {};
    for (const [key, value] of Object.entries(values)) {
        if (/^<\d+>$/.test(String(value))) {
            const templateName = String(value).slice(1, -1);
            if (replacements[templateName]) {
                result[key] = replacements[templateName];
            }
        }
        else {
            result[key] = value;
        }
    }
    return result;
}


function substituteTemplatesInString(s: string, context: CommandContext): string {
    /*
    * This function substitutes templates in string with values from context.output
    * If there "<44395>" in the string, and there is context.output["44395"] = "some value"
     */
    if (/^<\d+>$/.test(String(s))) {
        const t = s.slice(1, -1);
        if (context.output && context.output[t]) {
            return context.output[t];
        }
        else {
            return ``;
        }
    }
    return s;

}

export class CommandHandler {
    commands: Command[] = [];
    result?: string;

    executeCommands(log?: (s: string) => void, stopOnFail?: boolean, context?: CommandContext): CommandResult[] {
        context = context ? context : {};
        const results: CommandResult[] = [];
        const exceptionsToRaise: string[] = [];
        for (const command of this.commands) {
            if (command.type !== `EmptyCommand`) {
                log?.(command.toStr());
            }

            // Substitute templates in values
            for (const field of Object.keys(command)) {
                if (command[field] && typeof command[field] === `object` && command[field] !== null && !(command[field] instanceof Date)) {
                    command[field] = substituteTemplatesInValuesDict(command[field] as {
                        [key: string]: FieldValue
                    }, context.output ? context.output : {});
                } else if (typeof command[field] === `string`) {
                    command[field] = substituteTemplatesInString(String(command[field]), context);
                }
            }

            context = command.conditionsToSkip(context, log);
            if (context && context.skip) {
                log?.(`Command ${command.type} (${command.details}) skipped`);
                results.push({
                    shortDescribe: command.shortDescribe(),
                    result: `Skipped`,
                    failed: false,
                });
                continue;
            }

            context = command.conditionsToStop(context, log);
            if (context && context.failed) {
                log?.(`${command.details} stopped: ${context.result}`);
                results.push({
                    shortDescribe: command.shortDescribe(),
                    result: context.result ? context.result : `No explanation why stopped`,
                    failed: true,
                });
                if (stopOnFail) {
                    return results;
                }
                break;
            }
            if (command.optional) {
                try {
                    context = command.execute(context, log);
                }
                catch (e) {
                    log?.(`Command ${command.type} (${command.details}) failed: ${e}, but it's optional so continuing`);
                }
            }
            else {
                context = command.execute(context, log);
            }

            if (command.type === `CommandThrowException`) {
                exceptionsToRaise.push(command.details);
            }
            if (context && context.failed && command.optional) {
                log?.(`Command failed: ${context.result}`);
                log?.(`Command ${command.type} (${command.details}) is optional, continuing`);
                results.push({
                    shortDescribe: command.shortDescribe(),
                    result: context.result ? context.result : `Failed`,
                    failed: true,
                });
                continue;
            }
            if (context && context.failed) {
                log?.(`Command failed: ${context.result}`);
                log?.(`Command ${command.type} (${command.details}) trying fallback`);
                if (!context.fallbacks) {
                    context.fallbacks = [];
                }
                context.fallbacks.push(...command.fallBack());
                if (context && context.fallbackFailed) {
                    log?.(`Command ${command.type} (${command.details}) fallback failed`);
                    break;
                }
                results.push({
                    shortDescribe: command.shortDescribe(),
                    result: context.result ? context.result : `Failed`,
                    failed: true,
                });
                if (stopOnFail) {
                    break;
                }
            }

            context = command.aftermathToStop(context, log);
            if (context && context.stop) {
                log?.(`Command ${command.type} (${command.details}) stopped after execution: ${context.result}`);
                break;
            }
            results.push({
                shortDescribe: command.shortDescribe(),
                result: context.result ? context.result : `OK`,
                failed: false,
            });
            if (command.type !== `EmptyCommand`) {
                log?.(`Command ${command.type} (${command.details}) executed`);
            }
        }
        if (context.automaticallyLoadedRecords && context.automaticallyLoadedRecords.length > 0) {
            for (const recordToSave of context.automaticallyLoadedRecords) {
                try {
                    recordToSave.save({
                        ignoreMandatoryFields: true,
                        enableSourcing: false,
                    });
                }
                catch (e) {
                    exceptionsToRaise.push(`Failed to save record ${recordToSave.type} ${recordToSave.id}: ${e}`);
                }
            }
        }
        if (exceptionsToRaise.length > 0) {
            throw Error(exceptionsToRaise.join(`\n`));
        }
        if (results.length > 0) {
            this.result = results[results.length - 1].result;
        }
        return results;

    }

    sendCommandsToMapReduce(log?:(message: string) => void): string {
        /*
        This function sends commands to Map/Reduce script to run them
        In case of success, it returns an empty string
         */
        if (this.commands.length === 0) {
            return `No command to run`;
        }
        const parametersVariablesNumber = 10;
        const deploymentNumbers = 10;
        const commandsStr = this.toStr();
        if (commandsStr.length > 1000000 * parametersVariablesNumber) {
            return `Commands are too long ${commandsStr.length} characters, max is ${1000000 * parametersVariablesNumber} characters`;
        }
        log?.(`Commands length: ${commandsStr.length} sending to map/reduce script`);
        const commandsChunks = chunks(commandsStr.split(``), 1000000);

        for (let deploymentNumber = 0; deploymentNumber < deploymentNumbers; deploymentNumber++) {
            log?.(`Trying deployment number ${deploymentNumber + 1}`);
            const objTask = task.create({ taskType: task.TaskType.MAP_REDUCE });
            objTask.scriptId = `customscript_mr_commands`;
            objTask.deploymentId = `customdeploy_mr_commands${deploymentNumber + 1}`;
            objTask.params = {
                custscript_string_1: commandsChunks[0] ? commandsChunks[0].join(``) : ``,
                custscript_string_2: commandsChunks[1] ? commandsChunks[1].join(``) : ``,
                custscript_string_3: commandsChunks[2] ? commandsChunks[2].join(``) : ``,
                custscript_string_4: commandsChunks[3] ? commandsChunks[3].join(``) : ``,
                custscript_string_5: commandsChunks[4] ? commandsChunks[4].join(``) : ``,
                custscript_string_6: commandsChunks[5] ? commandsChunks[5].join(``) : ``,
                custscript_string_7: commandsChunks[6] ? commandsChunks[6].join(``) : ``,
                custscript_string_8: commandsChunks[7] ? commandsChunks[7].join(``) : ``,
                custscript_string_9: commandsChunks[8] ? commandsChunks[8].join(``) : ``,
                custscript_string_10: commandsChunks[9] ? commandsChunks[9].join(``) : ``,
            };
            try {
                objTask.submit();
                log?.(`Sent to deployment number ${deploymentNumber + 1} successfully`);
            } catch (e) {
                log?.(`Deployment number ${deploymentNumber + 1} failed: ${e}`);
                continue;
            }
            return ``;
        }
        return `All ${deploymentNumbers} deployments are busy`;
    }

    static commandFromString(s: string, log?: (s: string) => void): Command | undefined {
        log?.(`Parsing command: "${s}"`);
        const obj = JSON.parse(s) as Command;
        if (obj.type === `CommandSetFieldsValuesWithoutLoadingRecord`) {
            return CommandSetFieldsValuesWithoutLoadingRecord.fromString(s);
        }
        else if (obj.type === `CommandSaveRecord`) {
            return CommandSaveRecord.fromString(s);
        }
        else if (obj.type === `CommandCreateRecord`) {
            return CommandCreateRecord.fromString(s);
        }
        else if (obj.type === `CommandLoadRecord`) {
            return CommandLoadRecord.fromString(s);
        }
        else if (obj.type === `CommandDeleteRecord`) {
            return CommandDeleteRecord.fromString(s);
        }
        else if (obj.type === `CommandSetValueOnLoadedRecord`) {
            return CommandSetValueOnLoadedRecord.fromString(s);
        }
        else if (obj.type === `CommandAddAddress`) {
            return CommandAddAddress.fromString(s);
        }
        else if (obj.type === `CommandSetAddressFieldOnLoadedRecord`) {
            return CommandSetAddressFieldOnLoadedRecord.fromString(s);
        }
        else if (obj.type === `EmptyCommand`) {
            return EmptyCommand.fromString(s);
        }
        else if (obj.type === `CommandThrowException`) {
            return CommandThrowException.fromString(s);
        }
        else if (obj.type === `CommandRecordAttach`) {
            return CommandRecordAttach.fromString(s);
        }
        else if (obj.type === `CommandRecordDetach`) {
            return CommandRecordDetach.fromString(s);
        }
        else if (obj.type === `CommandDeleteLine`) {
            return CommandDeleteLine.fromString(s);
        }
        else if (obj.type === `CommandLockUnlockField`) {
            return CommandLockUnlockField.fromString(s);
        }
        else if (obj.type === `CommandSetMultiSelectValueOnLoadedRecord`) {
            return CommandSetMultiSelectValueOnLoadedRecord.fromString(s);
        }
        else if (obj.type === `CommandCommitCurrentLine`) {
            return CommandCommitCurrentLine.fromString(s);
        }
        else if (obj.type === `CommandAddLineDynamicMode`) {
            return CommandAddLineDynamicMode.fromString(s);
        }
        else if (obj.type === `CommandSetTextOnLoadedRecord`) {
            return CommandSetTextOnLoadedRecord.fromString(s);
        }
    }

    toStr(): string {
        return JSON.stringify(this.commands);
    }

    constructor(commands?: Command[]) {
        if (commands) {
            this.commands = commands;
        }
    }

    static fromString(s: string, log?: (s: string) => void): CommandHandler {
        const handler = new CommandHandler();
        if (!s || s.length < 10) { // Commands cannot be that short
            return handler;
        }

        const rawCommands = JSON.parse(s) as Command[];
        for (const rawCommand of rawCommands) {
            const parsedCommand = CommandHandler.commandFromString(JSON.stringify(rawCommand), log);
            if (parsedCommand) {
                handler.commands.push(parsedCommand);
            }
        }
        log?.(`Loaded ${handler.commands.length} commands`);
        return handler;
    }
}