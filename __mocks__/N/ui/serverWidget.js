// Mock for N/ui/serverWidget module

const FieldType = {
    TEXT: 'text',
    SELECT: 'select',
    LONGTEXT: 'longtext',
    CHECKBOX: 'checkbox',
    DATE: 'date',
    INTEGER: 'integer',
    FLOAT: 'float'
};

const SublistType = {
    LIST: 'list',
    STATICLIST: 'staticlist'
};

const FieldDisplayType = {
    NORMAL: 'normal',
    INLINE: 'inline',
    HIDDEN: 'hidden',
    READONLY: 'readonly'
};

const FieldLayoutType = {
    NORMAL: 'normal',
    STARTROW: 'startrow',
    MIDROW: 'midrow',
    ENDROW: 'endrow'
};

class MockField {
    constructor(options) {
        this.id = options.id;
        this.type = options.type;
        this.label = options.label;
        this.source = options.source;
        this.defaultValue = '';
    }

    updateDisplayType(options) {
        this.displayType = options.displayType;
    }

    updateLayoutType(options) {
        this.layoutType = options.layoutType;
    }
}

class MockSublist {
    constructor(options) {
        this.id = options.id;
        this.label = options.label;
        this.type = options.type;
        this.fields = [];
        this.values = {};
    }

    addField(options) {
        const field = new MockField(options);
        this.fields.push(field);
        return field;
    }

    setSublistValue(options) {
        const key = `${options.id}_${options.line}`;
        this.values[key] = options.value;
    }

    getSublistValue(options) {
        const key = `${options.id}_${options.line}`;
        return this.values[key];
    }
}

class MockForm {
    constructor(options) {
        this.title = options.title;
        this.fields = [];
        this.sublists = [];
        this.clientScriptModulePath = '';
    }

    addField(options) {
        const field = new MockField(options);
        this.fields.push(field);
        return field;
    }

    addSublist(options) {
        const sublist = new MockSublist(options);
        this.sublists.push(sublist);
        return sublist;
    }

    getSublist(options) {
        return this.sublists.find(sublist => sublist.id === options.id);
    }

    getField(options) {
        return this.fields.find(field => field.id === options.id);
    }
}

function createForm(options) {
    return new MockForm(options);
}

module.exports = {
    createForm,
    FieldType,
    SublistType,
    FieldDisplayType,
    FieldLayoutType
};