import { debug } from 'N/log';
import file from "N/file";
import {chunks, generateRandomString} from "./CommonLib";
import {fetchOneValue} from "./SuiteQLLibs";
import {runtime} from "N";
import {createFolder, getFolderId, writeStrToFile} from "./FileFunctions";

const messages: string[] = []
let logFile: file.File | null = null

interface DebugLogger {
    header: string,
    runBy?: string,
    executionContext?: string,
    scriptContext?: 'create' | 'delete' | 'edit',
    recordType?: string,
    recordId?: string,
    writeToFile?: boolean
}

function writeLogMessageToNS(message: string, header: string): void {
    for (const chunk of chunks(message.split(''), 3950)) { // to make sure that the message is not too long
        debug({ title: header, details: chunk.join('') });
    }
}

function pushMessagesToNS(header: string): void {
    for (const message of messages) {
        writeLogMessageToNS(message, header)
    }
}

function getBaseURL(): string {
    const companyId = runtime.accountId.toLowerCase().replace(/_/g, `-`);
    return `https://${companyId}.app.netsuite.com`;
}

export function createDebugLogger(args: DebugLogger, currentUserName: string): (message: string) => void {
    let scriptLogFolderId = null
    let scriptLogFile = null
    const startTimestamp = getLoggerStartTimestamp()
    const logFileName = `${startTimestamp}_${currentUserName}_${generateRandomString(4)}.txt`

    if (args.runBy) {
        debug({ title: args.header, details: `Script run by: ${args.runBy}` });
    }
    if (args.executionContext) {
        debug({ title: args.header, details: `Execution context: ${args.executionContext}` });
    }
    if (args.scriptContext) {
        debug({ title: args.header, details: `Script context: ${args.scriptContext}` });
    }
    if (args.recordType) {
        debug({ title: args.header, details: `Record type: ${args.recordType}` });
    }
    if (args.recordId) {
        debug({ title: args.header, details: `Record id: ${args.recordId}` });
    }
    if (args.writeToFile) {
        // check/create folders required for writing the log files
        scriptLogFolderId = checkLogsFolders(args.header)
        if (scriptLogFolderId) {
            scriptLogFile = getFile(logFileName, scriptLogFolderId)
            if (scriptLogFile) {
                logFile = scriptLogFile;
                debug({ title: args.header, details: `${getBaseURL()}${scriptLogFile.url}`});
            }

        }
    }
    return (message: string) => {
        if (args.writeToFile) {
            messages.push(`${getMessageTimestamp()}  ${message}`);
        }
        else {
            messages.push(addDateToString(message, new Date()));
        }

        if (!args.writeToFile) {
            writeLogMessageToNS(message, args.header)
        }
    };
}

export function flushLogs(): void {
    if (!logFile) {
        pushMessagesToNS(``)
        messages.length = 0;
        return;
    }
    const fullText = messages.join(`\n`);
    let allMessagesSaved = true;
    for (const chunk of chunks(fullText.split(''), 10000000)) {
        const messagesSaved = writeStrToFile(logFile, chunk.join(''));
        if (!messagesSaved) {
            allMessagesSaved = false;
            break;
        }
    }
    if (allMessagesSaved) {
        messages.length = 0;
    }
}

export function checkLogsFolders(title: string) {
    const datetime = new Date();
    const dateStr = datetime.toISOString().split('T')[0]
    const scriptName = runtime.getCurrentScript().id.replace('customscript_', '')
    let path = `FileCabinet/SuiteScripts`
    let parentFolderId = -15
    const foldersToCheck = [`LogsByDate`, dateStr, scriptName]

    for (const folder of foldersToCheck) {
        if (!getFolderId({folderName: folder, parentFolderId: parentFolderId})) {
            createFolder({folderName: folder, parentFolderId: parentFolderId})
        }
        const folderId = getFolderId({folderName: folder, parentFolderId: parentFolderId})
        path += `/${folder}`
        if (!folderId) {
            debug({ title: title, details: `Unable to find "${path}" folder` });
            return null;
        }
        parentFolderId = folderId

    }

    return parentFolderId

}

function getLoggerStartTimestamp(): string {
    const datetime = new Date();
    const tokens = datetime.toISOString().split(`T`)
    const date = tokens[0].replace(/-/g, ``)
    const time = tokens[1].replace(/:/g, ``).replace(`.`, `_`).replace(`Z`, ``)
    // yyyymmdd_hhmmss_zzz
    return `${date}_${time}`

}

function getMessageTimestamp(): string {
    const datetime = new Date();
    const tokens = datetime.toISOString().split(`T`)
    const timeTokens = tokens[1].split(`.`)
    // yyyy-mm-dd hh:mm:ss
    return `${tokens[0]} ${timeTokens[0]}`
}

export function getLoggedMessages(): string[] {
    /* Returns all messages that were logged by createDebugLogger function*/
    return messages;
}

function addDateToString(initialString: string, d: Date): string {
    return `${d.toISOString()} - ${initialString}`;
}

export function getFileId(params: {fileName: string, parentFolderId: number}): number | null {
    const sql = `SELECT File.id FROM  File WHERE ( File.Folder = ${params.parentFolderId} AND File.Name = '${params.fileName}' )`
    const result = fetchOneValue(sql)
    return result ? Number(result) : null
}

function getFile(fileName: string, folderId: number): file.File | null {
    // Creates file with name fileName under folder folderId if it doesn't exist
    // file.File object loaded and returned then
    if (!getFileId({fileName: fileName, parentFolderId: folderId})) {
        const fileObj = file.create({
            name: fileName,
            fileType: file.Type.PLAINTEXT,
            folder: folderId
        });
        fileObj.save()
    }
    const fileId = getFileId({fileName: fileName, parentFolderId: folderId})
    if (!fileId) {
        return null
    }
    return file.load({id: fileId})
}


