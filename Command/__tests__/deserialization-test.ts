import {CommandHandler} from "../CommandHandler";
import {CommandSetFieldsValuesWithoutLoadingRecord} from "../CommandSetValuesWithoutLoadingRecord";
import {Type} from "../TypesForTests";


/*
Example of a serialized CommandHandler (can be used in a Suitelet https://928018.app.netsuite.com/app/site/hosting/scriptlet.nl?script=1543&deploy=1&compid=928018&script=1543&deploy=1):
[{"details":"Test command","targetObjectType":"customer","targetObjectId":"58813","type":"CommandSetFieldsValuesWithoutLoadingRecord","targetFieldNameToValue":{"custentity_firstyearcoterm":false},"previousFieldNameToValue":null}]
 */

describe("Check if Command Handler can be de-serialized", () => {
    test("Serialization empty command handler returns empty commands", () => {
        const commandHandler = new CommandHandler();
        const commandHandlerString = commandHandler.toStr();
        expect(commandHandlerString).toEqual(`[]`);
        expect(CommandHandler.fromString(commandHandlerString)).toMatchObject(commandHandler);
    });

    test("De-serialization command handler with several commands", () => {
        const commandHandler = new CommandHandler();
        commandHandler.commands.push(new CommandSetFieldsValuesWithoutLoadingRecord({
            details: `First Command`,
            targetObjectType: Type.INVOICE,
            targetObjectId: `456`,
            targetFieldNameToValue: {
                "field1": `value1`,
                "field2": 18
            },
            group: `group1`
        }));
        commandHandler.commands.push(new CommandSetFieldsValuesWithoutLoadingRecord({
            details: `Another one`,
            targetObjectType: Type.CUSTOMER,
            targetObjectId: `457`,
            targetFieldNameToValue: {
                "field1": `value2`,
                "field2": 19
            },
            previousFieldNameToValue: {
                "field1": `value1`,
                "field2": 18

            },
            group: `group1`
        }));
        const commandHandlerString = commandHandler.toStr();
        expect(CommandHandler.fromString(commandHandlerString)).toMatchObject(commandHandler);
    })

});
