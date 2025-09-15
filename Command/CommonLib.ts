import {runtime} from "N";

export function chunks<T>(inputArray: Array<T>, chunkSize: number): Array<T>[] {
    /*
    Splits an array to chunks of fixed length. For a string split, use string.split('')
     */
    if (chunkSize === 0) {
        return [];
    }
    const outputArray: Array<T>[] = [];
    for (let i = 0; i < inputArray.length; i += chunkSize) {
        outputArray.push(inputArray.slice(i, i + chunkSize));
    }
    return outputArray;
}

export function generateRandomString(length: number) {
    const characters = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789`;
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

export function getScriptParameter(parameterId: string): string {
    /*
    Fetches script parameter value by its id
     */
    const currentScript = runtime.getCurrentScript();
    return String(currentScript.getParameter({ name: parameterId }));
}