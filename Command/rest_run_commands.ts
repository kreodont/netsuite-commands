/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 * @NDeploy
 * @NName Run Commands RESTLet
 * @NDescription Parse and run one or several commands
 */



import {CommandHandlerForServerScripts} from "./CommandHandlerForServerScripts";
import {createDebugLogger} from "./Logger";
import {task} from "N";

export function post(context: Record<`commands` | `onError` | `useMapReduce` | `customJobId` | `cacheId`, string>): string {
    /*
    Runs one or several commands provided in the "commands" parameter as a text.
    If useMapReduce is "true", submits commands to MapReduce for batch processing.
    Otherwise, executes commands directly and returns results.
    If any of the commands fails, the rest of the commands are not run by default.
    This can be changed by setting the "onError" parameter to "continue".
     */
    const log = createDebugLogger({header: `POST`}, '');
    if (!context || !context.commands) {
        log(`Parameters must include "commands". Current context: ${JSON.stringify(context)}`);
        return JSON.stringify({success: false, message: `Parameters must include "commands"`});
    }

    if (context.commands.length === 0) {
        return JSON.stringify({success: false, message: `Parameter "commands" must not be empty`});
    }

    log(`Incoming Commands: ${context.commands}`);
    
    // Check if MapReduce should be used
    if (context.useMapReduce === `true`) {
        return submitToMapReduce(context.commands, log, context.customJobId);
    } else {
        // Execute commands directly (existing behavior)
        const commandsHandler = CommandHandlerForServerScripts.fromString(context.commands);
        const results = commandsHandler.executeCommands(log, context.onError !== `continue`, {}, context.cacheId);
        log(`Results: ${JSON.stringify(results)}`);
        return JSON.stringify(results);
    }

}

function submitToMapReduce(commands: string, log: (message: string) => void, customJobId?: string): string {
    try {
        log(`Submitting commands to MapReduce`);
        
        // Split commands into chunks for script parameters (NetSuite has parameter size limits)
        const commandChunks = chunkString(commands, 3900); // Leave some buffer for NetSuite limits
        
        // Create script parameters object
        const scriptParams: Record<string, string> = {};
        for (let i = 0; i < commandChunks.length && i < 10; i++) {
            scriptParams[`custscript_string_${i + 1}`] = commandChunks[i];
        }
        
        // Add custom job ID parameter if provided
        if (customJobId) {
            scriptParams['custscript_custom_job_id'] = customJobId;
        }
        
        // Create MapReduce task
        const mapReduceTask = task.create({
            taskType: task.TaskType.MAP_REDUCE,
            scriptId: 'customscript_mr_commands',
            deploymentId: 'customdeploy_mr_commands1',
            params: scriptParams
        });
        
        // Submit the task
        const taskId = mapReduceTask.submit();
        
        // Use custom job ID if provided, otherwise fall back to default
        const jobId = customJobId || `MR_customscript_mr_commands_customdeploy_mr_commands1`;
        
        log(`MapReduce task submitted with ID: ${taskId}, Job ID: ${jobId}`);
        
        return JSON.stringify({
            success: true,
            taskId: taskId,
            jobId: jobId,
            message: `MapReduce task submitted successfully`
        });
        
    } catch (error) {
        log(`Error submitting to MapReduce: ${error}`);
        return JSON.stringify({
            success: false,
            message: `Failed to submit to MapReduce: ${error}`
        });
    }
}

function chunkString(str: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < str.length; i += chunkSize) {
        chunks.push(str.slice(i, i + chunkSize));
    }
    return chunks;
}

export function get() {
    return `This RESTLet only supports POST requests.`;
}