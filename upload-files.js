#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function uploadFiles() {
    const projectFolder = process.argv[2];

    if (!projectFolder) {
        console.error('❌ Project folder not specified');
        process.exit(1);
    }

    // We're being called from parent directory via run-with-folder.js
    const projectPath = path.join(process.cwd(), projectFolder);
    
    // First, build the TypeScript files
    console.log('🔨 Building TypeScript files...');
    try {
        execSync('npm run build', { 
            stdio: 'inherit',
            cwd: projectPath
        });
        console.log('✅ Build completed successfully!\n');
    } catch (error) {
        console.error('❌ Build failed:', error.message);
        process.exit(1);
    }
    
    const jsFilesPath = path.join(projectPath, 'src/FileCabinet/SuiteScripts', projectFolder);
    
    if (!fs.existsSync(jsFilesPath)) {
        console.log('⚠️  No JS files found in src/FileCabinet/SuiteScripts/' + projectFolder);
        process.exit(1);
    }
    
    const files = fs.readdirSync(jsFilesPath).filter(f => f.endsWith('.js'));
    
    if (files.length === 0) {
        console.log('⚠️  No JS files found to upload');
        process.exit(1);
    }
    
    console.log('📤 Uploading JS files:');
    files.forEach(file => console.log(`   - /SuiteScripts/${projectFolder}/${file}`));
    
    try {
        // Change to project directory for suitecloud command
        process.chdir(projectPath);
        
        const uploadPaths = files.map(file => `"/SuiteScripts/${projectFolder}/${file}"`).join(' ');
        const command = `suitecloud file:upload --paths ${uploadPaths}`;
        console.log(`\n🚀 Running: ${command}`);
        execSync(command, { stdio: 'inherit' });
        console.log('✅ Files uploaded successfully!');
    } catch (error) {
        console.error('❌ Upload failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    uploadFiles();
}

module.exports = { uploadFiles };