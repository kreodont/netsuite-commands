const path = require('path');
const { execSync } = require('child_process');

const currentDir = process.cwd();
const folderName = path.basename(currentDir);
const command = process.argv.slice(2).join(' ').replace(/__FOLDER_NAME__/g, folderName);

try {
    execSync(command, {
        stdio: 'inherit',
        shell: true,
        cwd: path.resolve(currentDir, '..')
    });
    
    // Display completion time in user's timezone
    const completionTime = new Date().toLocaleTimeString('en-US', {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    
    console.log(`\n✅ Script completed at: ${completionTime}`);
    
} catch (error) {
    process.exit(error.status || 1);
}