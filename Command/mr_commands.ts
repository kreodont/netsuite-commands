/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 * @NDeploy
 * @NName Map Reduce To Run several commands
 * @NDescription Parses commands and runs them
 */

import { EntryPoints } from "N/types";
import {createDebugLogger} from "./Logger";
import {getScriptParameter, generateRandomString} from "./CommonLib";
import {CommandHandlerForServerScripts} from "./CommandHandlerForServerScripts";
import { runtime, cache } from "N";
import {writeFile} from "./FileFunctions";

interface ToMapReduce {
    handlerStringified: string;
    totalNumberOfCommands: number;
    currentNumber: number;
}

interface FromMapReduce {
    handlerStringified: string;
    totalNumberOfCommands: number;
    currentNumber: number;
    result: string
    isSuccessful: boolean;
    startTime: Date
    endTime: Date
}

const CACHE_NAME = 'MAPREDUCE_STATUS';
const CACHE_TTL = 7200; // 2 hours TTL

function updateJobStatus(jobId: string, status: string, stage: string, processedRecords: number, totalRecords: number, currentCommand?: string, error?: string) {
    try {
        const statusCache = cache.getCache({
            name: CACHE_NAME,
            scope: cache.Scope.PUBLIC
        });
        
        // Get existing job keys
        const jobKeysJson = statusCache.get({
            key: 'JOB_KEYS'
        }) || '[]';
        const jobKeys: string[] = JSON.parse(jobKeysJson);
        
        // Add this job key if not already present
        if (!jobKeys.includes(jobId)) {
            jobKeys.push(jobId);
            statusCache.put({
                key: 'JOB_KEYS',
                value: JSON.stringify(jobKeys),
                ttl: CACHE_TTL
            });
        }
        
        // Update job status
        const jobData = {
            jobId: jobId,
            status: status,
            stage: stage,
            processedRecords: processedRecords,
            totalRecords: totalRecords,
            startTime: statusCache.get({ key: `${jobId}_START` }) || new Date().toISOString(),
            lastUpdate: new Date().toISOString(),
            currentCommand: currentCommand,
            error: error
        };
        
        // Store start time if this is the first update
        if (status === 'GETINPUTDATA') {
            statusCache.put({
                key: `${jobId}_START`,
                value: new Date().toISOString(),
                ttl: CACHE_TTL
            });
        }
        
        statusCache.put({
            key: jobId,
            value: JSON.stringify(jobData),
            ttl: CACHE_TTL
        });
    } catch (_) {
        // Silently fail - don't let cache errors break the main process
    }
}

function checkCancelFlag(jobId: string): boolean {
    try {
        const statusCache = cache.getCache({
            name: CACHE_NAME,
            scope: cache.Scope.PUBLIC
        });
        
        const cancelFlag = statusCache.get({
            key: `${jobId}_CANCEL`
        });
        
        return cancelFlag === 'true';
    } catch (_) {
        return false; // If we can't check, assume not cancelled
    }
}

export function getInputData(): ToMapReduce[] {
    const log = createDebugLogger({header: `getInputData`}, '');
    
    // Check for custom job ID parameter first
    const customJobId = getScriptParameter('custscript_custom_job_id');
    log(`Custom job ID parameter: ${customJobId}`);
    
    const jobId = customJobId || `MR_${runtime.getCurrentScript().id}_${runtime.getCurrentScript().deploymentId}`;
    
    log(`MapReduce started with job ID: ${jobId}`);
    
    // Clear any existing cache entries for this job to start fresh
    try {
        const statusCache = cache.getCache({
            name: CACHE_NAME,
            scope: cache.Scope.PUBLIC
        });
        
        // Clear command progress and history
        statusCache.remove({ key: `${jobId}_COMMAND_PROGRESS` });
        statusCache.remove({ key: `${jobId}_COMMAND_HISTORY` });
        log(`Cleared existing cache entries for job: ${jobId}`);
    } catch (error) {
        log(`Warning: Could not clear cache for job ${jobId}: ${error}`);
    }
    
    updateJobStatus(jobId, 'GETINPUTDATA', 'Loading commands', 0, 0);
    
    let fullText = ``;
    for (let i = 1; i <= 10; i++) {
        let part = getScriptParameter(`custscript_string_${i}`);
        if (!part || part.length === 0 || part === `null`) {
            part = ``;
        }
        fullText += part;
    }
    log(`Text of: ${fullText.length} chars received`);
    const ch = CommandHandlerForServerScripts.fromString(fullText);
    log(`${ch.commands.length} commands loaded`);
    
    // Store full command list for command details display
    try {
        const statusCache = cache.getCache({
            name: CACHE_NAME,
            scope: cache.Scope.PUBLIC
        });
        
        // Store total count
        statusCache.put({
            key: `${jobId}_TOTAL_COMMANDS`,
            value: String(ch.commands.length),
            ttl: 7200 // 2 hours TTL
        });
        
        // Store full command list with descriptions
        const commandList = ch.commands.map((cmd, index) => ({
            index: index + 1,
            description: cmd.shortDescribe(),
            status: 'pending'
        }));
        
        statusCache.put({
            key: `${jobId}_COMMAND_LIST`,
            value: JSON.stringify(commandList),
            ttl: 7200 // 2 hours TTL
        });
        
        log(`Stored command list with ${commandList.length} commands`);
    } catch (error) {
        log(`Warning: Could not store command list: ${error}`);
    }
    
    updateJobStatus(jobId, 'GETINPUTDATA', 'Grouping commands', 0, ch.commands.length);
    
    writeFile(`commands.json`, fullText);
    const handlersByGroup: {[group: string]: CommandHandlerForServerScripts} = {};
    for (const command of ch.commands) {
        const group = command.group ? command.group : generateRandomString(6); // if no group is specified, generate a random one since it means that this command should not be grouped at all
        if (!handlersByGroup[group]) {
            handlersByGroup[group] = new CommandHandlerForServerScripts();
        }
        handlersByGroup[group].commands.push(command);
    }
    log(`Grouped by ${Object.keys(handlersByGroup).length} groups`);
    
    const toMapReduce: ToMapReduce[] = [];
    for (const group in handlersByGroup) {
        toMapReduce.push({
            handlerStringified: handlersByGroup[group].toStr(),
            totalNumberOfCommands: Object.keys(handlersByGroup).length,
            currentNumber: toMapReduce.length,
        });
    }
    
    updateJobStatus(jobId, 'MAP', 'Ready to process', 0, toMapReduce.length);
    
    return toMapReduce;
}

export function map(context: EntryPoints.MapReduce.mapContext): void {
    const startTime = new Date();
    const toMapReduce = JSON.parse(context.value) as ToMapReduce;
    const handler = CommandHandlerForServerScripts.fromString(toMapReduce.handlerStringified);
    const log = createDebugLogger({header: `map ${toMapReduce.currentNumber + 1}/${toMapReduce.totalNumberOfCommands}`}, '');
    
    // Use the same consistent job ID (check for custom job ID)
    const customJobId = getScriptParameter('custscript_custom_job_id');
    const jobId = customJobId || `MR_${runtime.getCurrentScript().id}_${runtime.getCurrentScript().deploymentId}`;
    
    log(`Map ${toMapReduce.currentNumber + 1}/${toMapReduce.totalNumberOfCommands} started`);
    
    // Check for cancellation before processing
    if (checkCancelFlag(jobId)) {
        log(`Map ${toMapReduce.currentNumber + 1}/${toMapReduce.totalNumberOfCommands} cancelled`);
        updateJobStatus(
            jobId,
            'FAILED',
            'Cancelled by user',
            toMapReduce.currentNumber,
            toMapReduce.totalNumberOfCommands,
            undefined,
            'Job was cancelled by user'
        );
        
        const fromMapReduce: FromMapReduce = {
            handlerStringified: handler.toStr(),
            totalNumberOfCommands: toMapReduce.totalNumberOfCommands,
            currentNumber: toMapReduce.currentNumber,
            result: JSON.stringify([{result: 'Job cancelled', failed: true}]),
            isSuccessful: false,
            startTime: startTime,
            endTime: new Date(),
        };
        
        context.write({key: `r`, value: fromMapReduce});
        return; // Exit early without processing commands
    }
    
    // Update status with current command info
    const firstCommand = handler.commands[0];
    const commandDescription = firstCommand ? firstCommand.shortDescribe() : 'Processing commands';
    updateJobStatus(
        jobId, 
        'MAP', 
        `Processing group ${toMapReduce.currentNumber + 1}/${toMapReduce.totalNumberOfCommands}`,
        toMapReduce.currentNumber,
        toMapReduce.totalNumberOfCommands,
        commandDescription
    );
    
    log(handler.toStr());
    const result = handler.executeCommands(log, false, {}, jobId);
    log(`Map ${toMapReduce.currentNumber + 1}/${toMapReduce.totalNumberOfCommands} finished`);
    
    const fromMapReduce: FromMapReduce = {
        handlerStringified: handler.toStr(),
        totalNumberOfCommands: toMapReduce.totalNumberOfCommands,
        currentNumber: toMapReduce.currentNumber,
        result: JSON.stringify(result),
        isSuccessful: !result[result.length - 1].failed,
        startTime: startTime,
        endTime: new Date(),
    };
    
    // Update status after completion
    if (!result[result.length - 1].failed) {
        updateJobStatus(
            jobId,
            'MAP',
            `Completed group ${toMapReduce.currentNumber + 1}/${toMapReduce.totalNumberOfCommands}`,
            toMapReduce.currentNumber + 1,
            toMapReduce.totalNumberOfCommands
        );
    } else {
        updateJobStatus(
            jobId,
            'MAP',
            `Failed group ${toMapReduce.currentNumber + 1}/${toMapReduce.totalNumberOfCommands}`,
            toMapReduce.currentNumber,
            toMapReduce.totalNumberOfCommands,
            undefined,
            result[result.length - 1].result || 'Command execution failed'
        );
    }
    
    context.write({key: `r`, value: fromMapReduce});
}

export function summarize(context: EntryPoints.MapReduce.summarizeContext): void {
    const log = createDebugLogger({header: `summarize`}, '');
    
    // Use the same consistent job ID (check for custom job ID)
    const customJobId = getScriptParameter('custscript_custom_job_id');
    const jobId = customJobId || `MR_${runtime.getCurrentScript().id}_${runtime.getCurrentScript().deploymentId}`;
    
    updateJobStatus(jobId, 'SUMMARIZE', 'Processing results', 0, 0);
    
    let successCount = 0;
    let failCount = 0;
    let totalProcessed = 0;
    
    try {
        context.output.iterator().each(function (_, value) {
            const fromMapReduce = JSON.parse(value) as FromMapReduce;
            fromMapReduce.endTime = new Date(fromMapReduce.endTime);
            fromMapReduce.startTime = new Date(fromMapReduce.startTime);
            totalProcessed++;
            
            if (fromMapReduce.isSuccessful) {
                successCount++;
            }
            else {
                failCount++;
            }
            return true;
        });
        
        // Update final status
        const finalStatus = failCount > 0 ? 'FAILED' : 'COMPLETE';
        const finalMessage = `Completed: ${successCount} successful, ${failCount} failed`;
        updateJobStatus(
            jobId,
            finalStatus,
            finalMessage,
            totalProcessed,
            totalProcessed,
            undefined,
            failCount > 0 ? `${failCount} groups failed` : undefined
        );
        
    }
    catch (e) {
        log(`Error: ${e}`);
        updateJobStatus(
            jobId,
            'FAILED',
            'Error in summarize',
            0,
            0,
            undefined,
            JSON.stringify(e)
        );
    }
}
