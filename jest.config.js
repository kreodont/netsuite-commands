const path = require('path');

const currentDir = process.cwd();
const rootDir = currentDir.endsWith('sdfProjects') ? currentDir : path.resolve(currentDir, '..');

module.exports = {
  "preset": "ts-jest",
  "testEnvironment": "node",
  "rootDir": currentDir,
  "transform": {
    "^.+\\.ts$": ["ts-jest", {
      "tsconfig": {
        "module": "commonjs",
        "target": "es2017",
        "moduleResolution": "node",
        "esModuleInterop": true,
        "allowSyntheticDefaultImports": true,
        "skipLibCheck": true
      }
    }]
  },
  "transformIgnorePatterns": [
    "node_modules/(?!(@babel)/)"
  ],
  "testMatch": [
    "**/__tests__/**/*.ts"
  ],
  "collectCoverageFrom": [
    "**/*.ts",
    "!**/__tests__/**",
    "!**/node_modules/**",
    "!**/src/**"
  ],
  "moduleNameMapper": {
    "^N/(.*)$": `${rootDir}/__mocks__/N/$1.js`,
    "^N$": `${rootDir}/__mocks__/N.js`
  }
};