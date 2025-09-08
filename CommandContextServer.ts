import {CommandContext} from "./CommandContext";
import {Form} from "N/ui/serverWidget";

export interface CommandContextServer extends CommandContext {
    forms?: {[key: string]: Form};
}