import {CommandHandler, CommandResult} from "./CommandHandler";
import {Command} from "./Command";
import {CommandAddFieldOntoForm} from "./CommandAddFieldOntoForm";
import {CommandSetValueOnForm} from "./CommandSetValueOnForm";
import {CommandContextServer} from "./CommandContextServer";
import * as cache from "N/cache";
import {FieldValue} from "N/record";

function substituteTemplatesInValuesDict(values: {[key: string]: FieldValue}, replacements: {[key: string]: string}): {[key: string]: FieldValue} {
    /*
    * This function substitutes templates in values with values from context.output
    * If there "field_name": "<44395>" in the field values, and there is context.output["44395"] = "some value"
     */
    const result: {[key: string]: FieldValue} = {};
    for (const [key, value] of Object.entries(values)) {
        if (String(value).startsWith(`<`) && String(value).endsWith(`>`)) {
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

function substituteTemplatesInString(s: string, context: CommandContextServer): string {
    /*
    * This function substitutes templates in string with values from context.output
    * If there "<44395>" in the string, and there is context.output["44395"] = "some value"
     */
    if (s.startsWith(`<`) && s.endsWith(`>`)) {
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

function writeCommandResultToCache(cacheId: string, commandIndex: number, totalCommands: number, result: CommandResult): void {
    try {
        const statusCache = cache.getCache({
            name: 'MAPREDUCE_STATUS',
            scope: cache.Scope.PUBLIC
        });
        
        const commandProgress = {
            commandIndex: commandIndex + 1, // 1-based for display
            totalCommands: totalCommands,
            currentCommand: result.shortDescribe,
            result: result.result,
            failed: result.failed,
            timestamp: new Date().toISOString()
        };
        
        statusCache.put({
            key: `${cacheId}_COMMAND_PROGRESS`,
            value: JSON.stringify(commandProgress),
            ttl: 7200 // 2 hours TTL to match job cache
        });
        
        // Also append to command history
        const historyKey = `${cacheId}_COMMAND_HISTORY`;
        const existingHistoryJson = statusCache.get({ key: historyKey });
        const history = existingHistoryJson ? JSON.parse(existingHistoryJson) : [];
        history.push(commandProgress);
        
        statusCache.put({
            key: historyKey,
            value: JSON.stringify(history),
            ttl: 7200 // 2 hours TTL
        });
    } catch (error) {
        // Don't let cache errors break command execution
    }
}

export class CommandHandlerForServerScripts extends CommandHandler {
    static fromString(s: string, log?: (s: string) => void): CommandHandlerForServerScripts {
        const handler = new CommandHandlerForServerScripts();
        if (!s || s.length < 10) { // Commands cannot be that short
            return handler;
        }

        const rawCommands = JSON.parse(s) as Command[];
        for (const rawCommand of rawCommands) {
            const parsedCommand = CommandHandlerForServerScripts.commandFromString(JSON.stringify(rawCommand), log);
            if (parsedCommand) {
                handler.commands.push(parsedCommand);
            }
        }
        log?.(`Loaded ${handler.commands.length} commands`);
        return handler;
    }
    
    static commandFromString(s: string, log?: (s: string) => void): Command | undefined {
        const command: Command | undefined = CommandHandler.commandFromString(s, log);
        if (command) {
            return command;
        }
        const obj = JSON.parse(s) as Command;
        if (obj.type === `CommandAddFieldOntoForm`) {
            return CommandAddFieldOntoForm.fromString(s);
        }
        else if (obj.type === `CommandSetValueOnForm`) {
            return CommandSetValueOnForm.fromString(s);
        }
    }
    executeCommands(log?: (s: string) => void, stopOnFail?: boolean, context?: CommandContextServer, cacheId?: string): CommandResult[] {
        context = context ? context : {};
        const results: CommandResult[] = [];
        const exceptionsToRaise: string[] = [];
        const totalCommands = this.commands.length;
        
        for (let i = 0; i < this.commands.length; i++) {
            const command = this.commands[i];
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
                const result = {
                    shortDescribe: command.shortDescribe(),
                    result: `Skipped`,
                    failed: false,
                };
                results.push(result);
                
                // Write to cache if cacheId provided
                if (cacheId) {
                    writeCommandResultToCache(cacheId, i, totalCommands, result);
                }
                continue;
            }

            context = command.conditionsToStop(context, log);
            if (context && context.failed) {
                log?.(`${command.details} stopped: ${context.result}`);
                const result = {
                    shortDescribe: command.shortDescribe(),
                    result: context.result ? context.result : `No explanation why stopped`,
                    failed: true,
                };
                results.push(result);
                
                // Write to cache if cacheId provided
                if (cacheId) {
                    writeCommandResultToCache(cacheId, i, totalCommands, result);
                }
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
                const result = {
                    shortDescribe: command.shortDescribe(),
                    result: context.result ? context.result : `Failed`,
                    failed: true,
                };
                results.push(result);
                
                // Write to cache if cacheId provided
                if (cacheId) {
                    writeCommandResultToCache(cacheId, i, totalCommands, result);
                }
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
                const result = {
                    shortDescribe: command.shortDescribe(),
                    result: context.result ? context.result : `Failed`,
                    failed: true,
                };
                results.push(result);
                
                // Write to cache if cacheId provided
                if (cacheId) {
                    writeCommandResultToCache(cacheId, i, totalCommands, result);
                }
                if (stopOnFail) {
                    break;
                }
            }

            context = command.aftermathToStop(context, log);
            if (context && context.stop) {
                log?.(`Command ${command.type} (${command.details}) stopped after execution: ${context.result}`);
                break;
            }
            const result = {
                shortDescribe: command.shortDescribe(),
                result: context.result ? context.result : `OK`,
                failed: false,
            };
            results.push(result);
            
            // Write to cache if cacheId provided
            if (cacheId) {
                writeCommandResultToCache(cacheId, i, totalCommands, result);
            }
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
}