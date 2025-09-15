import {CommandSetFieldsValuesWithoutLoadingRecord} from "../CommandSetValuesWithoutLoadingRecord";
import {Type} from "./TypesForTests";


describe("CommandSetFieldsValuesWithoutLoadingRecord specific tests", () => {
    test("Function describe", () => {
        const c = new CommandSetFieldsValuesWithoutLoadingRecord({
            details: `First Command`,
            targetObjectType: Type.INVOICE,
            targetObjectId: `456`,
            targetFieldNameToValue: {
                "field1": `value1`,
                "field2": 18
            },
            group: `group1`
        });
        // using 0 instead of invoice. In real NetSuite environment, it would be Type.INVOICE (invoice)
        expect(c.shortDescribe()).toEqual(`CommandSetFieldsValuesWithoutLoadingRecord sets invoice 456 field1 to "value1", field2 to 18`);
        const c2 = new CommandSetFieldsValuesWithoutLoadingRecord({
            details: `Second Command`,
            targetObjectType: Type.CUSTOMER,
            targetObjectId: `789`,
            targetFieldNameToValue: {},
            group: `group1`
        });
        // second command field targetFieldNameToValue is empty, that's why it doesn't set anything
        expect(c2.shortDescribe()).toEqual(`CommandSetFieldsValuesWithoutLoadingRecord sets customer 789 `);
    })

    test(`Function describe when previousFieldNameToValue is not null must write FROM and TO`, () => {
        const c = new CommandSetFieldsValuesWithoutLoadingRecord({
            details: `First Command`,
            targetObjectType: Type.INVOICE,
            targetObjectId: `456`,
            targetFieldNameToValue: {
                "field1": `cat`,
            },
            previousFieldNameToValue: {
                "field1": `dog`,
            },
            group: `group1`
        });
        expect(c.shortDescribe()).toEqual(`CommandSetFieldsValuesWithoutLoadingRecord sets invoice 456 field1 from "dog" to "cat"`);
    });

    test(`When previousFieldNameToValue is null, fallback is empty command, but if not, it can restore the previous value`, () => {
        const commandWithoutPreviousValue = new CommandSetFieldsValuesWithoutLoadingRecord({
            details: `First Command`,
            targetObjectType: Type.INVOICE,
            targetObjectId: `456`,
            targetFieldNameToValue: {
                "field1": `cat`,
            },
            group: `group1`
        });
        const fallBackCommand = commandWithoutPreviousValue.fallBack();
        expect(fallBackCommand[0].shortDescribe()).toEqual(`Empty Command`);

        const commandWithPreviousValue = new CommandSetFieldsValuesWithoutLoadingRecord({
            details: `First Command`,
            targetObjectType: Type.INVOICE,
            targetObjectId: `456`,
            targetFieldNameToValue: {
                "field1": `cat`,
            },
            previousFieldNameToValue: {
                "field1": `dog`,
            },
            group: `group1`
        });
        const fallBackCommand2 = commandWithPreviousValue.fallBack();
        expect(fallBackCommand2[0].shortDescribe()).toEqual(`CommandSetFieldsValuesWithoutLoadingRecord sets invoice 456 field1 from "cat" to "dog"`);

    })
});