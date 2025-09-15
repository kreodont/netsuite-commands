#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function removeDirectory(dirPath) {
    if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
        console.log(`🗑️  Removed: ${dirPath}`);
    }
}

function createProject(projectName) {
    if (!projectName) {
        console.error('❌ Please provide a project name');
        console.log('Usage: node create-project.js ProjectName');
        process.exit(1);
    }

    console.log(`🚀 Creating NetSuite SDF project: ${projectName}`);

    try {
        // Run SuiteCloud CLI to create the project
        console.log('📦 Running suitecloud project:create...');
        execSync(`suitecloud project:create --type ACCOUNTCUSTOMIZATION --projectname ${projectName}`, {
            stdio: 'inherit'
        });

        // Remove unnecessary folders
        console.log('\n🧹 Cleaning up unnecessary folders...');
        const foldersToRemove = [
            path.join(projectName, 'src', 'AccountConfiguration'),
            path.join(projectName, 'src', 'FileCabinet', 'Templates'),
            path.join(projectName, 'src', 'FileCabinet', 'Web Site Hosting Files'),
            path.join(projectName, 'src', 'Translations')
        ];

        foldersToRemove.forEach(removeDirectory);

        // Create __tests__ folder and sample test
        console.log('\n📝 Setting up testing structure...');
        const testsDir = path.join(projectName, '__tests__');
        fs.mkdirSync(testsDir, { recursive: true });
        
        const sampleTestContent = `describe(\`Basic test with simple assert\`, () => {
    test(\`should assert strings are equal\`, () => {
        const a = \`foobar\`;
        const b = \`foobar\`;
        expect(a).toMatch(b);
    });
});
`;
        
        const sampleTestPath = path.join(testsDir, 'sample-test.ts');
        fs.writeFileSync(sampleTestPath, sampleTestContent);
        console.log(`✅ Created ${sampleTestPath}`);

        // Create package.json for the project
        const packageJson = {
            private: true,
            scripts: {
                build: `node ../run-with-folder.js "node build.js __FOLDER_NAME__"`,
                lint: "eslint . --ext .ts",
                test: "jest -c ../jest.config.js",
                "test:coverage": "jest -c ../jest.config.js --coverage",
                deploy: "npm run build && npm run lint && npm test && node ../run-with-folder.js \"node generate-script-xml.js __FOLDER_NAME__\" && suitecloud account:setup && suitecloud project:deploy",
                upload_files: "node ../run-with-folder.js \"node upload-files.js __FOLDER_NAME__\""
            }
        };

        const packageJsonPath = path.join(projectName, 'package.json');
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        console.log(`✅ Added ${packageJsonPath} with build and test scripts`);

        console.log(`\n🎉 Project '${projectName}' created successfully!`);
        
    } catch (error) {
        console.error(`\n❌ Error creating project: ${error.message}`);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    const projectName = process.argv[2];
    createProject(projectName);
}

module.exports = { createProject };