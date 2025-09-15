const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findTsFiles(projectDir) {
    const tsFiles = [];

    function searchDir(dir) {
        const items = fs.readdirSync(dir);

        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                // Skip src directory, node_modules, __tests__, and __mocks__ directories
                if (item !== 'src' && item !== 'node_modules' && item !== '__tests__' && item !== '__mocks__') {
                    searchDir(fullPath);
                }
            } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
                tsFiles.push(fullPath);
            }
        }
    }

    if (fs.existsSync(projectDir)) {
        searchDir(projectDir);
    }

    return tsFiles;
}

function fixAmdImportPaths(filePath) {
    // Fix AMD module paths in compiled JavaScript
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace sweetalert2 import with the correct NetSuite path
    // The pattern matches define([...]) at the start of the file
    content = content.replace(
        /define\(\[([^\]]*)"sweetalert2"([^\]]*)\]/g,
        (match, before, after) => {
            // Replace sweetalert2 with the correct relative path
            return `define([${before}"../netsuite-libs/sweetalert2"${after}]`;
        }
    );
    
    // Replace dayjs import with the correct NetSuite path
    content = content.replace(
        /define\(\[([^\]]*)"dayjs"([^\]]*)\]/g,
        (match, before, after) => {
            // Replace dayjs with the correct relative path
            return `define([${before}"../netsuite-libs/dayjs"${after}]`;
        }
    );
    
    // You can add more replacements here for other libraries if needed
    
    fs.writeFileSync(filePath, content);
}

function buildProject(projectName) {
    console.log(`🔨 Building project: ${projectName}`);

    // Check if project directory exists
    if (!fs.existsSync(projectName)) {
        console.error(`❌ Project directory '${projectName}' not found`);
        process.exit(1);
    }

    // Find all TypeScript files in the project
    const tsFiles = findTsFiles(projectName);

    if (tsFiles.length === 0) {
        console.warn(`⚠️  No TypeScript files found in project '${projectName}'`);
        return;
    }

    console.log(`📋 Found ${tsFiles.length} TypeScript file(s):`);
    tsFiles.forEach(file => console.log(`   - ${file}`));

    // Create a temporary tsconfig for this project
    const tempTsConfig = {
        extends: "./tsconfig.json",
        include: tsFiles,
        exclude: ["node_modules", "dist", "**/__tests__/**"]
    };

    const tempConfigPath = `tsconfig.${projectName}.json`;
    fs.writeFileSync(tempConfigPath, JSON.stringify(tempTsConfig, null, 2));

    try {
        // Compile using the project-specific config
        console.log('🔨 Compiling TypeScript...');
        execSync(`tsc -p ${tempConfigPath}`, { stdio: 'inherit' });
    } finally {
        // Clean up temporary config
        fs.unlinkSync(tempConfigPath);
    }

    console.log('📁 Copying files to NetSuite locations...');

    // Clear and recreate the destination directory
    const destDir = path.join(projectName, 'src', 'FileCabinet', 'SuiteScripts', projectName);
    if (fs.existsSync(destDir)) {
        fs.rmSync(destDir, { recursive: true, force: true });
        console.log(`🧹 Cleared output directory: ${destDir}`);
    }
    fs.mkdirSync(destDir, { recursive: true });

    // Copy each compiled file to its NetSuite destination
    let copiedCount = 0;

    tsFiles.forEach(tsFile => {
        const jsFile = tsFile.replace('.ts', '.js');
        const distSourcePath = path.join('dist', jsFile);

        if (fs.existsSync(distSourcePath)) {
            // Create destination path: ProjectName/src/FileCabinet/SuiteScripts/ProjectName/filename.js
            const fileName = path.basename(jsFile);
            const destPath = path.join(destDir, fileName);

            // Copy the file
            fs.copyFileSync(distSourcePath, destPath);
            
            // Fix AMD import paths in the copied file
            fixAmdImportPaths(destPath);
            
            console.log(`✅ ${jsFile} → ${destPath}`);
            copiedCount++;
        } else {
            console.warn(`⚠️  Compiled file not found: ${distSourcePath}`);
        }
    });

    console.log(`🎉 Build complete! Processed ${copiedCount} file(s) for project '${projectName}'`);
}

function buildAll() {
    console.log('🔨 Building all projects...');

    // Find all project directories (directories that don't start with . and aren't node_modules, dist, etc.)
    const items = fs.readdirSync('.');
    const projectDirs = items.filter(item => {
        const stat = fs.statSync(item);
        return stat.isDirectory() &&
            !item.startsWith('.') &&
            !['node_modules', 'dist', 'netsuite-libs'].includes(item);
    });

    if (projectDirs.length === 0) {
        console.warn('⚠️  No project directories found');
        return;
    }

    console.log(`📋 Found ${projectDirs.length} project(s):`);
    projectDirs.forEach(dir => console.log(`   - ${dir}`));

    // Build each project
    projectDirs.forEach(buildProject);
}

function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        buildAll();
    } else {
        const projectName = args[0];
        buildProject(projectName);
    }
}

if (require.main === module) {
    main();
}

module.exports = { buildProject, buildAll, findTsFiles };