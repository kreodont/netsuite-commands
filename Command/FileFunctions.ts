import {fetchOneValue} from "./SuiteQLLibs";
import file from "N/file";
import {record, runtime} from "N";

export function getFileId(params: {fileName: string, parentFolderId: number}): number | null {
    const sql = `SELECT File.id FROM  File WHERE ( File.Folder = ${params.parentFolderId} AND File.Name = '${params.fileName}' )`
    const result = fetchOneValue(sql)
    return result ? Number(result) : null
}

export function writeStrToFile(fileObj: file.File, message: string): boolean {
    try {
        fileObj.appendLine({value: message})
        fileObj.save();
        return true;
    }
    catch (_) {
        return false;
    }
}

export function getFolderId(params: {folderName: string, parentFolderId: number}): number | null {
    const sql = `SELECT MediaItemFolder.id FROM  MediaItemFolder WHERE ( MediaItemFolder.Parent = ${params.parentFolderId} AND MediaItemFolder.Name = '${params.folderName}')`
    const result = fetchOneValue(sql)
    return result ? Number(result) : null
}

export function createFolder(params: {folderName: string, parentFolderId: number}): number | null {
    try {
        const newFolder = record.create({
            type: record.Type.FOLDER
        });
        newFolder.setValue({fieldId: 'name', value: params.folderName})
        newFolder.setValue({fieldId: 'parent', value: params.parentFolderId})

        return newFolder.save();
    } catch (_) {
        return null
    }
}

export function writeFile(
    desiredOutputFileName: string,
    fileContent: string,
    directoryName?: string, // If not specified, current script directory is used
    log?: (s: string) => void,
): number[] {
    function stringChunks(initialString: string): string[] {
        const strings = initialString.split('\n');
        const outputStrings: string[] = [];
        let i: number;
        let j: number;
        const chunkSize = 100000;
        for (i = 0, j = strings.length; i < j; i += chunkSize) {
            outputStrings.push(strings.slice(i, i + chunkSize).join('\n'));
        }
        return outputStrings;
    }
    const createdFilesIds: number[] = [];
    let folderId: string | null
    if (!directoryName) {
        const sql = `select folder from file where name = '${runtime.getCurrentScript().id.replace('customscript_', '')}.js'`;
        log?.(sql);
        folderId = fetchOneValue(sql);
    }
    else {
        const sql = `SELECT id FROM mediaitemfolder WHERE appfolder = '${directoryName}'`;
        log?.(sql);
        folderId = fetchOneValue(sql);
    }
    if (!folderId) {
        log?.(`Folder not found`)
        return createdFilesIds;
    }
    log?.(`Folder id is ${folderId}`);
    const dataChunks = stringChunks(fileContent);
    log?.(`There are ${dataChunks.length} chunks`);
    if (dataChunks.length < 1) {
        return createdFilesIds;
    }
    for (let chunkNumber = 0; chunkNumber < dataChunks.length; chunkNumber++) {
        const outputFileName =
            chunkNumber < 1
                ? `${desiredOutputFileName.replace('.txt', '')}.txt`
                : `${desiredOutputFileName.replace('.txt', '')}_${chunkNumber}.txt`;
        const fileObj = file.create({
            name: outputFileName,
            fileType: file.Type.CSV,
            contents: dataChunks[chunkNumber],
        });
        log?.(`Saving file ${outputFileName}`);
        fileObj.folder = Number(folderId);
        createdFilesIds.push(fileObj.save());
        log?.('File saved');
    }
    log?.(`Files created: ${JSON.stringify(createdFilesIds)}`);
    return createdFilesIds;
}