// Mock for N/cache module

class MockCache {
    constructor(options) {
        this.name = options.name;
        this.scope = options.scope;
        this.storage = new Map();
    }

    get(key) {
        const value = this.storage.get(key);
        return value !== undefined ? value : null;
    }

    put(key, value) {
        this.storage.set(key, value);
        // In a real implementation, ttl would be used to expire entries
        // For mocking purposes, we'll ignore ttl
    }

    remove(key) {
        this.storage.delete(key);
    }
}

const Scope = {
    GLOBAL: 'GLOBAL',
    PROTECTED: 'PROTECTED',
    PRIVATE: 'PRIVATE'
};

function getCache(options) {
    return new MockCache(options);
}

module.exports = {
    getCache,
    Scope
};