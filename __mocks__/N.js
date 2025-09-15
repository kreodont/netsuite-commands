// Mock for NetSuite N module
const recordModule = require('./N/record');

module.exports = {
  record: recordModule,
  currentRecord: {
    get: jest.fn(() => ({
      getValue: jest.fn(),
      setValue: jest.fn(),
      getField: jest.fn(() => ({
        isDisabled: false
      }))
    }))
  },
  https: {
    post: {
      promise: jest.fn(() => Promise.resolve({ body: '[]' }))
    }
  }
};