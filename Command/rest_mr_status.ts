/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 * @NDeploy
 * @NName MapReduce Status API
 * @NDescription RESTlet to fetch MapReduce job status from cache
 */


import * as cache from "N/cache";


const CACHE_NAME = 'MAPREDUCE_STATUS';
// const CACHE_TTL = 300; // 5 minutes TTL

interface MapReduceJob {
    jobId: string;
    status: 'PENDING' | 'GETINPUTDATA' | 'MAP' | 'REDUCE' | 'SUMMARIZE' | 'COMPLETE' | 'FAILED' | 'CANCELLED';
    stage: string;
    processedRecords: number;
    totalRecords: number;
    startTime: string;
    lastUpdate: string;
    currentCommand?: string;
    error?: string;
}


export function get(requestParams: {jobId?: string, test?: string, commandHistory?: string} = {}) {
    try {
        
        // Simple test response to verify RESTlet is working
        if (requestParams.test === 'true') {
            return JSON.stringify({
                success: true,
                message: 'RESTlet is working',
                timestamp: new Date().toISOString()
            });
        }
        
        // If commandHistory is requested, return detailed command history
        if (requestParams.commandHistory === 'true' && requestParams.jobId) {
            const statusCache = cache.getCache({
                name: CACHE_NAME,
                scope: cache.Scope.PUBLIC
            });
            
            const historyJson = statusCache.get({
                key: `${requestParams.jobId}_COMMAND_HISTORY`
            });
            
            const totalCommandsStr = statusCache.get({
                key: `${requestParams.jobId}_TOTAL_COMMANDS`
            });
            
            const commandListJson = statusCache.get({
                key: `${requestParams.jobId}_COMMAND_LIST`
            });
            
            const totalCommands = totalCommandsStr ? parseInt(totalCommandsStr) : 0;
            const commandList = commandListJson ? JSON.parse(commandListJson) : [];
            
            return {
                jobId: requestParams.jobId,
                commandHistory: historyJson ? JSON.parse(historyJson) : [],
                commandList: commandList,
                totalCommands: totalCommands,
                timestamp: new Date().toISOString()
            };
        }
        
        // Get or create cache
        const statusCache = cache.getCache({
            name: CACHE_NAME,
            scope: cache.Scope.PUBLIC
        });
        
        // Get all job keys from the cache
        const jobKeysJson = statusCache.get({
            key: 'JOB_KEYS'
        });
        
        const jobs: MapReduceJob[] = [];
        
        if (jobKeysJson) {
            const jobKeys: string[] = JSON.parse(jobKeysJson);
            
            // Filter job keys if jobId parameter is provided
            const filteredJobKeys = requestParams?.jobId 
                ? jobKeys.filter(key => key === requestParams.jobId)
                : jobKeys;
            
            // If a specific jobId was requested but not found, return empty result immediately
            if (requestParams?.jobId && filteredJobKeys.length === 0) {
                return {
                    jobs: [],
                    timestamp: new Date().toISOString()
                };
            }
            
            // Fetch each job's status
            for (const jobKey of filteredJobKeys) {
                const jobDataJson = statusCache.get({
                    key: jobKey
                });
                
                if (jobDataJson) {
                    try {
                        const jobData = JSON.parse(jobDataJson) as MapReduceJob;
                        
                        // Check if job is still active (updated within last 2 hours)
                        const lastUpdateTime = new Date(jobData.lastUpdate);
                        const now = new Date();
                        const minutesSinceUpdate = (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60);
                        
                        if (minutesSinceUpdate < 120 || jobData.status === 'COMPLETE' || jobData.status === 'FAILED') {
                            // Try to fetch command progress details
                            const commandProgressJson = statusCache.get({
                                key: `${jobKey}_COMMAND_PROGRESS`
                            });
                            
                            if (commandProgressJson) {
                                try {
                                    const commandProgress = JSON.parse(commandProgressJson);
                                    jobData.currentCommand = `${commandProgress.currentCommand} (${commandProgress.commandIndex}/${commandProgress.totalCommands})`;
                                    if (commandProgress.result && commandProgress.result !== 'OK') {
                                        jobData.currentCommand += ` - ${commandProgress.result}`;
                                    }
                                } catch (_) {
                                    // If parsing fails, keep original currentCommand
                                }
                            }
                            
                            jobs.push(jobData);
                        }
                    } catch (_) {
                        // Skip invalid job data
                    }
                }
            }
        }
        
        // Sort jobs by last update time (most recent first)
        jobs.sort((a, b) => {
            const dateA = new Date(a.lastUpdate);
            const dateB = new Date(b.lastUpdate);
            return dateB.getTime() - dateA.getTime();
        });
        
        return {
            jobs: jobs,
            timestamp: new Date().toISOString()
        };
        
    } catch (_) {
        return {
            jobs: [],
            timestamp: new Date().toISOString()
        };
    }
}

export function post(requestBody: {action: string, jobId?: string}): {success: boolean, message: string} {
    const statusCache = cache.getCache({
        name: CACHE_NAME,
        scope: cache.Scope.PUBLIC
    });
    
    if (requestBody.action === 'clear') {
        const jobKeysJson = statusCache.get({
            key: 'JOB_KEYS'
        });
        
        if (jobKeysJson) {
            const jobKeys: string[] = JSON.parse(jobKeysJson);
            for (const jobKey of jobKeys) {
                statusCache.remove({
                    key: jobKey
                });
            }
            statusCache.remove({
                key: 'JOB_KEYS'
            });
        }
        
        return { success: true, message: 'Cache cleared' };
    }
    
    if (requestBody.action === 'cancel' && requestBody.jobId) {
        try {
            // Set cancel flag for the specific job
            statusCache.put({
                key: `${requestBody.jobId}_CANCEL`,
                value: 'true',
                ttl: 300 // 5 minutes TTL
            });
            
            // Update job status to show cancellation requested
            const jobDataJson = statusCache.get({
                key: requestBody.jobId
            });
            
            if (jobDataJson) {
                const jobData = JSON.parse(jobDataJson) as MapReduceJob;
                jobData.status = 'PENDING'; // Will be updated to CANCELLED by the MapReduce script
                jobData.stage = 'Cancellation requested';
                jobData.lastUpdate = new Date().toISOString();
                
                statusCache.put({
                    key: requestBody.jobId,
                    value: JSON.stringify(jobData),
                    ttl: 300
                });
            }
            
            return { success: true, message: 'Job cancellation requested' };
        } catch (error) {
            return { success: false, message: 'Failed to set cancel flag: ' + error };
        }
    }
    
    return { success: false, message: 'Unknown action' };
}