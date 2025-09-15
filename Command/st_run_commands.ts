/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 * @NDeploy
 * @NName Run commands Suitelet
 * @NDescription Parse and run one or several commands
 */


import {EntryPoints} from "N/types";
import {createForm, FieldDisplayType, FieldType, Form} from "N/ui/serverWidget";


function makeForm(): Form {
    const form = createForm({
        title: `Command`,
    });
    form.addField({
        id: `custpage_input_commands_text`,
        type: FieldType.LONGTEXT,
        label: `Command(s) text`
    });

    const parsedCommandsField = form.addField({
        id: `custpage_parsed_commands`,
        type: FieldType.INLINEHTML,
        label: `command(s)`
    });
    parsedCommandsField.updateDisplayType({ displayType: FieldDisplayType.INLINE });

    const commandsOutput = form.addField({
        id: `custpage_commands_output`,
        type: FieldType.INLINEHTML,
        label: `Logs`
    });
    commandsOutput.updateDisplayType({ displayType: FieldDisplayType.INLINE });

    form.addButton({label: `Parse`, id: `custpage_parse_button`, functionName: `parseButtonClicked`});
    form.addButton({label: `Run`, id: `custpage_run_button`, functionName: `runButtonClicked`}).isDisabled = true;
    form.clientScriptModulePath = `./cl_commands`;
    return form;
}
export function onRequest(context: EntryPoints.Suitelet.onRequestContext) {
    context.response.writePage(makeForm());
}