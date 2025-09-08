import {record} from "N";
import {Command} from "./Command";

export interface CommandContext {
    stop?: string;
    skip?: string;
    loadedRecords?: {[key: string]: record.Record};
    loadedClientRecords?: {[key: string]: record.ClientCurrentRecord};
    failed?: boolean;
    fallbacks?: Command[];
    result?: string;
    fallbackFailed?: string;
    output?: {[key: string]: string};
    automaticallyLoadedRecords?: record.Record[] // this is for CommandHandler, it means these records need to be saved after all commands are executed
}