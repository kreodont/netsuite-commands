/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 * @NName Commands client script
 * @NDescription Handles users interaction with Suitelets
 * @NDeploy Suitelet
 */


import {currentRecord, https} from "N";
import {resolveScript} from "N/url";
import Swal from "sweetalert2";
import { CommandResult, CommandResultsToString, CommandHandler } from "./CommandHandler";


export function runButtonClicked(): void {
    const form = currentRecord.get();
    const parsedCommands = form.getValue({fieldId: `custpage_parsed_commands`});
    if (String(parsedCommands).length === 0) {
        alert(`No commands found. You must parse commands first`);
        return;
    }
    try {
        // Using restlet to actually run the commands
        const restletURL = resolveScript({scriptId: `customscript_rest_run_commands`, deploymentId: `customdeploy_rest_run_commands1`, returnExternalUrl: false});
        void Swal.fire({
            title: `Processing`,
            text: `The request is being processed. Please wait...`,
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen() {
                Swal.showLoading(null);
            }
        });

        // Call the Restlet
        https.post.promise({
            url: restletURL,
            body: {
                commands: String(form.getValue({fieldId: `custpage_input_commands_text`})),
            }
        })
            .then(function(response) {
                // Handle the response from the Restlet
                Swal.close();
                const results = response.body;
                try {
                    const parsedResults = JSON.parse(results) as CommandResult[];
                    const lastResult = parsedResults[parsedResults.length - 1];
                    if (lastResult.failed) {
                        void Swal.fire({
                            icon: `error`,
                            title: `Error`,
                            text: `An error occurred while processing the request. Results: ${CommandResultsToString(parsedResults)}`
                        });
                        return;
                    }
                    void Swal.fire({
                        icon: `success`,
                        title: `Success`,
                        text: `Commands have been processed successfully. Results: ${CommandResultsToString(parsedResults)}`
                    });
                }
                catch (e) {
                    void Swal.fire({
                        icon: `error`,
                        title: `Error`,
                        text: `An error occurred while processing the request: ${JSON.stringify(e)}`
                    });
                    return;
                }
            })
            .catch(function(error: Error) {
                // Handle any errors
                Swal.close();
                void Swal.fire({
                    icon: `error`,
                    title: `Error`,
                    text: `An error occurred while processing the request: ${error.message}`
                });
            }).finally(function() {});

        // form.setValue({fieldId: `custpage_commands_output`, value: output});
        form.setValue({fieldId: `custpage_parsed_commands`, value: ``});
        const runButton = form.getField({fieldId: `custpage_run_button`});
        if (runButton) {
            runButton.isDisabled = true;

        }
    }
    catch (e) {
        alert(`Failed to run command: ${e}`);
    }
}

export function parseButtonClicked(): void {
    const form = currentRecord.get();
    const commandsString = String(form.getValue({fieldId: `custpage_input_commands_text`}));
    if (commandsString.length === 0) {
        alert(`No commands found. You must enter commands first`);
        return;
    }
    const commandsHandler = CommandHandler.fromString(commandsString);
    if (commandsHandler.commands.length === 0) {
        return;
    }
    form.setValue({fieldId: `custpage_parsed_commands`, value: commandsHandler.commands.map(command => command.shortDescribe()).join(`<br>`)});
    form.setValue({fieldId: `custpage_commands_output`, value: ``});
    const runButton = form.getField({fieldId: `custpage_run_button`});
    if (runButton) {
        runButton.isDisabled = false;

    }

}

export function pageInit(): void {
    window.onbeforeunload = function() {
        // To avoid a warning message
    };
}
