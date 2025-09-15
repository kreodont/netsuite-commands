#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Convert record type to NetSuite format
function formatRecordType(recordType) {
    const trimmed = recordType.trim();

    // If it's a custom record, use scriptid format
    if (trimmed.toLowerCase().startsWith('customrecord')) {
        return `[scriptid=${trimmed}]`;
    }

    // Otherwise, remove spaces and convert to uppercase
    return trimmed.replace(/\s+/g, '').toUpperCase();
}

function parseScriptHeader(input) {
    let content;

    // If input is a file path, read the file
    if (typeof input === 'string' && (input.endsWith('.ts') || input.endsWith('.js'))) {
        content = fs.readFileSync(input, 'utf8');
    } else {
        // Otherwise treat input as header text directly
        content = input;
    }

    // Find the script header comment block
    const headerMatch = content.match(/\/\*\*\s*([\s\S]*?)\*\//);
    if (!headerMatch) {
        return null;
    }

    const header = headerMatch[1];
    const annotations = {};

    // Parse @annotations - match each line separately
    const lines = header.split('\n');

    for (const line of lines) {
        const annotationMatch = line.match(/\*\s*@(\w+)(?:\s+(.+))?/);
        if (annotationMatch) {
            const [, key, value] = annotationMatch;
            annotations[key] = value ? value.trim() : '';
        }
    }

    return annotations;
}

function truncateId(id, maxLength = 38) {
    if (id.length <= maxLength) {
        return id;
    }

    // Extract trailing numbers if any
    const match = id.match(/^(.+?)(\d*)$/);
    const baseId = match[1];
    const numbers = match[2];

    // Calculate available space for base (total - numbers length)
    const availableLength = maxLength - numbers.length;

    if (availableLength <= 0) {
        // If numbers alone exceed limit, just truncate the whole thing
        return id.substring(0, maxLength).replace(/_+$/, '');
    }

    // Truncate base and append numbers, then remove any trailing underscores
    const truncated = baseId.substring(0, availableLength) + numbers;
    return truncated.replace(/_+$/, '');
}

function generateScriptId(fileName, scriptType) {
    // Remove file extension and convert to script ID format
    const baseName = path.basename(fileName, '.ts').replace(/[^a-zA-Z0-9_]/g, '_');

    // If the file name already starts with a type prefix, don't add another one
    const typePrefix = {
        'MapReduceScript': 'mr',
        'UserEventScript': 'ue',
        'ScheduledScript': 'sc',
        'Suitelet': ['sl', 'st'],  // Suitelet can use sl_ or st_ prefix
        'ClientScript': ['cs', 'cl'],  // ClientScript can use cs_ or cl_ prefix
        'MassUpdateScript': 'mu',
        'Restlet': 'rl',
        'WorkflowActionScript': 'wa'
    };

    const prefix = typePrefix[scriptType];

    let scriptId;
    // Check if baseName already starts with any acceptable prefix for this script type
    if (prefix) {
        const prefixes = Array.isArray(prefix) ? prefix : [prefix];
        const hasPrefix = prefixes.some(p => baseName.startsWith(p + '_'));

        if (hasPrefix) {
            scriptId = `customscript_${baseName}`;
        } else {
            // Use the first prefix in the array as default
            const defaultPrefix = Array.isArray(prefix) ? prefix[0] : prefix;
            scriptId = `customscript_${defaultPrefix}_${baseName}`;
        }
    } else {
        scriptId = `customscript_script_${baseName}`;
    }

    // Remove trailing underscores before truncation
    scriptId = scriptId.replace(/_+$/, '');

    return truncateId(scriptId);
}

function generateMapReduceXML(annotations, scriptId, fileName, projectName) {
    const deployCount = parseInt(annotations.NDeploy) || 10;
    const name = annotations.NName || 'Unnamed Script';
    const description = annotations.NDescription || '';
    const scriptPath = `/SuiteScripts/${projectName}/${path.basename(fileName, '.ts')}.js`;

    let deployments = '';
    for (let i = 1; i <= deployCount; i++) {
        const deployId = truncateId(`customdeploy_${scriptId.replace('customscript_', '')}${i}`);
        deployments += `\t\t<scriptdeployment scriptid="${deployId}">
\t\t    <status>TESTING</status>
\t\t    <title>${deployId}</title>
\t\t    <isdeployed>T</isdeployed>
\t\t    <loglevel>DEBUG</loglevel>
\t\t    <runasrole>ADMINISTRATOR</runasrole>
\t\t</scriptdeployment>\n`;
    }

    return `<mapreducescript scriptid="${scriptId}">
    <name>${name}</name>
    <notifyowner>T</notifyowner>
    <description>${description}</description>
    <scriptfile>[${scriptPath}]</scriptfile>
\t<scriptdeployments>
${deployments}\t</scriptdeployments>
</mapreducescript>`;
}

function generateUserEventXML(annotations, scriptId, fileName, projectName) {
    if (!annotations.NDeploy) {
        throw new Error('UserEventScript requires @NDeploy annotation with record types');
    }
    const recordTypes = annotations.NDeploy.split(',').map(s => s.trim());
    const name = annotations.NName || 'Unnamed Script';
    const description = annotations.NDescription || '';
    const scriptPath = `/SuiteScripts/${projectName}/${path.basename(fileName, '.ts')}.js`;

    let deployments = '';
    recordTypes.forEach((recordType, index) => {
        const nsRecordType = formatRecordType(recordType);
        const deployId = truncateId(`customdeploy_${scriptId.replace('customscript_', '')}${index + 1}`);

        deployments += `\t\t<scriptdeployment scriptid="${deployId}">
\t\t    <status>RELEASED</status>
\t\t    <isdeployed>T</isdeployed>
\t\t    <loglevel>DEBUG</loglevel>
\t\t    <allroles>T</allroles>
\t\t    <runasrole>ADMINISTRATOR</runasrole>
\t\t    <executioncontext>ACTION|ADVANCEDREVREC|BANKCONNECTIVITY|BANKSTATEMENTPARSER|BUNDLEINSTALLATION|CLIENT|CONSOLRATEADJUSTOR|CSVIMPORT|CUSTOMGLLINES|CUSTOMMASSUPDATE|DATASETBUILDER|DEBUGGER|EMAILCAPTURE|FICONNECTIVITY|FIPARSER|MAPREDUCE|OCRPLUGIN|OTHER|PAYMENTGATEWAY|PAYMENTPOSTBACK|PLATFORMEXTENSION|PORTLET|PROMOTIONS|RECORDACTION|RESTLET|RESTWEBSERVICES|SCHEDULED|SDFINSTALLATION|SHIPPINGPARTNERS|SUITELET|TAXCALCULATION|USEREVENT|USERINTERFACE|WEBAPPLICATION|WEBSERVICES|WEBSTORE|WORKBOOKBUILDER|WORKFLOW</executioncontext>
\t\t    <recordtype>${nsRecordType}</recordtype>
\t\t</scriptdeployment>\n`;
    });

    return `<usereventscript scriptid="${scriptId}">
    <name>${name}</name>
    <notifyowner>T</notifyowner>
    <description>${description}</description>
    <scriptfile>[${scriptPath}]</scriptfile>
\t<scriptdeployments>
${deployments}\t</scriptdeployments>
</usereventscript>`;
}

function generateScheduledScriptXML(annotations, scriptId, fileName, projectName) {
    const deployCount = parseInt(annotations.NDeploy) || 10;
    const name = annotations.NName || 'Unnamed Script';
    const description = annotations.NDescription || '';
    const scriptPath = `/SuiteScripts/${projectName}/${path.basename(fileName, '.ts')}.js`;

    let deployments = '';
    for (let i = 1; i <= deployCount; i++) {
        const deployId = truncateId(`customdeploy_${scriptId.replace('customscript_', '')}${i}`);
        deployments += `\t\t<scriptdeployment scriptid="${deployId}">
\t\t    <status>TESTING</status>
\t\t    <title>${deployId}</title>
\t\t    <isdeployed>T</isdeployed>
\t\t    <loglevel>DEBUG</loglevel>
\t\t    <allroles>T</allroles>
\t\t    <audslctrole>T</audslctrole>

\t\t    <runasrole>ADMINISTRATOR</runasrole>
\t\t</scriptdeployment>\n`;
    }

    return `<scheduledscript scriptid="${scriptId}">
    <name>${name}</name>
    <notifyowner>T</notifyowner>
    <description>${description}</description>
    <scriptfile>[${scriptPath}]</scriptfile>
\t<scriptdeployments>
${deployments}\t</scriptdeployments>
</scheduledscript>`;
}

function generateSuiteletXML(annotations, scriptId, fileName, projectName) {
    const name = annotations.NName || 'Unnamed Script';
    const description = annotations.NDescription || '';
    const scriptPath = `/SuiteScripts/${projectName}/${path.basename(fileName, '.ts')}.js`;
    const deployId = truncateId(`customdeploy_${scriptId.replace('customscript_', '')}1`);

    return `<suitelet scriptid="${scriptId}">
    <name>${name}</name>
    <notifyowner>T</notifyowner>
    <description>${description}</description>
    <scriptfile>[${scriptPath}]</scriptfile>
\t<scriptdeployments>
\t\t<scriptdeployment scriptid="${deployId}">
\t\t    <status>RELEASED</status>
\t\t    <title>${deployId}</title>
\t\t    <isdeployed>T</isdeployed>
\t\t    <loglevel>DEBUG</loglevel>
\t\t    <allroles>T</allroles>
\t\t    <runasrole>ADMINISTRATOR</runasrole>
\t\t</scriptdeployment>
\t</scriptdeployments>
</suitelet>`;
}

function generateClientScriptXML(annotations, scriptId, fileName, projectName) {
    if (!annotations.NDeploy) {
        throw new Error('ClientScript requires @NDeploy annotation with record types or "Suitelet"');
    }

    // Special case: ClientScript deployed to Suitelet doesn't need XML generation
    if (annotations.NDeploy.trim() === 'Suitelet') {
        return null; // Return null to indicate no XML should be generated
    }

    const recordTypes = annotations.NDeploy.split(',').map(s => s.trim());
    const name = annotations.NName || 'Unnamed Script';
    const description = annotations.NDescription || '';
    const scriptPath = `/SuiteScripts/${projectName}/${path.basename(fileName, '.ts')}.js`;

    let deployments = '';
    recordTypes.forEach((recordType, index) => {
        const nsRecordType = formatRecordType(recordType);
        const deployId = truncateId(`customdeploy_${scriptId.replace('customscript_', '')}${index + 1}`);

        deployments += `\t\t<scriptdeployment scriptid="${deployId}">
\t\t    <status>RELEASED</status>
\t\t    <isdeployed>T</isdeployed>
\t\t    <loglevel>DEBUG</loglevel>
\t\t    <allroles>T</allroles>
\t\t    <executioncontext>USERINTERFACE</executioncontext>
\t\t    <recordtype>${nsRecordType}</recordtype>
\t\t</scriptdeployment>\n`;
    });

    return `<clientscript scriptid="${scriptId}">
    <name>${name}</name>
    <notifyowner>T</notifyowner>
    <description>${description}</description>
    <scriptfile>[${scriptPath}]</scriptfile>
\t<scriptdeployments>
${deployments}\t</scriptdeployments>
</clientscript>`;
}

function generateRestletXML(annotations, scriptId, fileName, projectName) {
    const deployCount = parseInt(annotations.NDeploy) || 1;
    const name = annotations.NName || 'Unnamed Script';
    const description = annotations.NDescription || '';
    const scriptPath = `/SuiteScripts/${projectName}/${path.basename(fileName, '.ts')}.js`;

    let deployments = '';
    for (let i = 1; i <= deployCount; i++) {
        const deployId = truncateId(`customdeploy_${scriptId.replace('customscript_', '')}${i}`);
        deployments += `\t\t<scriptdeployment scriptid="${deployId}">
\t\t    <status>RELEASED</status>
\t\t    <title>${deployId}</title>
\t\t    <isdeployed>T</isdeployed>
\t\t    <loglevel>DEBUG</loglevel>
\t\t    <allroles>T</allroles>
\t\t    <runasrole>ADMINISTRATOR</runasrole>
\t\t</scriptdeployment>\n`;
    }

    return `<restlet scriptid="${scriptId}">
    <name>${name}</name>
    <notifyowner>T</notifyowner>
    <description>${description}</description>
    <scriptfile>[${scriptPath}]</scriptfile>
\t<scriptdeployments>
${deployments}\t</scriptdeployments>
</restlet>`;
}

function generateWorkflowActionScriptXML(annotations, scriptId, fileName, projectName) {
    const name = annotations.NName || 'Unnamed Script';
    const description = annotations.NDescription || '';
    const scriptPath = `/SuiteScripts/${projectName}/${path.basename(fileName, '.ts')}.js`;

    // WorkflowActionScript doesn't use deployments, it's attached to workflows directly
    return `<workflowactionscript scriptid="${scriptId}">
    <name>${name}</name>
    <description>${description}</description>
    <scriptfile>[${scriptPath}]</scriptfile>
    <notifyowner>T</notifyowner>
    <isinactive>F</isinactive>
</workflowactionscript>`;
}

function generateScriptXML(annotations, fileName, projectName) {
    const scriptType = annotations.NScriptType;
    const scriptId = generateScriptId(fileName, scriptType);

    let xml;
    switch (scriptType) {
        case 'MapReduceScript':
            xml = generateMapReduceXML(annotations, scriptId, fileName, projectName);
            break;
        case 'UserEventScript':
            xml = generateUserEventXML(annotations, scriptId, fileName, projectName);
            break;
        case 'ScheduledScript':
            xml = generateScheduledScriptXML(annotations, scriptId, fileName, projectName);
            break;
        case 'Suitelet':
            xml = generateSuiteletXML(annotations, scriptId, fileName, projectName);
            break;
        case 'ClientScript':
            xml = generateClientScriptXML(annotations, scriptId, fileName, projectName);
            break;
        case 'Restlet':
            xml = generateRestletXML(annotations, scriptId, fileName, projectName);
            break;
        case 'WorkflowActionScript':
            xml = generateWorkflowActionScriptXML(annotations, scriptId, fileName, projectName);
            break;
        default:
            throw new Error(`Unsupported script type: ${scriptType}`);
    }

    return {xml, scriptId};
}

function isSuiteScriptFile(fileName) {
    try {
        // Read the file content
        const fileContent = fs.readFileSync(fileName, 'utf8');

        // Parse the script header to check for @NScriptType annotation
        const annotations = parseScriptHeader(fileContent);

        // Return true if the file has a valid @NScriptType annotation
        if (annotations && annotations.NScriptType) {
            const validScriptTypes = [
                'UserEventScript',
                'ClientScript',
                'Suitelet',
                'MapReduceScript',
                'ScheduledScript',
                'MassUpdateScript',
                'Restlet',
                'WorkflowActionScript'
            ];

            return validScriptTypes.includes(annotations.NScriptType);
        }

        return false;
    } catch (error) {
        // If file can't be read or parsed, assume it's not a SuiteScript file
        console.log(`     ⚠️  Could not read/parse ${fileName}: ${error.message}`);
        return false;
    }
}

function findScriptFiles(projectDir) {
    const scriptFiles = [];

    function searchDir(dir) {
        if (!fs.existsSync(dir)) return;

        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                if (item !== 'src' && item !== 'node_modules' && item !== '__tests__' && item !== 'dist') {
                    searchDir(fullPath);
                }
            } else if (item.endsWith('.ts') && !item.endsWith('.d.ts') && !item.includes('.test.') && !item.includes('.spec.')) {
                scriptFiles.push(fullPath);
            }
        }
    }

    searchDir(projectDir);
    return scriptFiles;
}

function getCustomObjectNames(text) {
    // Find all custom object references in the code
    // Note: We exclude 'custrecord' from general search because those are usually fields
    // We only want custom record TYPES, not their fields
    const prefixes = ['custbody', 'custentity', 'custitem', 'custcol', 'custitemnumber'];
    const regex = new RegExp(`\\b(${prefixes.join('|')})\\w*\\b`, 'g');
    const matches = text.match(regex) || [];

    // Look for custom record TYPE definitions (not fields)
    // These typically appear in type declarations or @NDeploy annotations
    const customRecordTypeRegex = /(?:type\s*:\s*['"`]|@NDeploy\s+.*?)(\bcustomrecord_\w+)\b/gi;
    let recordMatch;
    while ((recordMatch = customRecordTypeRegex.exec(text)) !== null) {
        matches.push(recordMatch[1].toLowerCase());
    }

    // Also check for custom records in @NDeploy annotations specifically
    const deployMatch = text.match(/@NDeploy\s+(.+)/);
    if (deployMatch) {
        const deployTargets = deployMatch[1].split(',').map(s => s.trim());
        for (const target of deployTargets) {
            // Check if it's a custom record
            if (target.toLowerCase().startsWith('customrecord')) {
                // Convert spaces to underscores for custom record IDs
                const customRecordId = target.replace(/\s+/g, '_').toLowerCase();
                matches.push(customRecordId);
            }
        }
    }

    // Filter out any custrecord_ items that are clearly fields (contain multiple underscores after custrecord_)
    // Keep only custom record types like customrecord_cotermination_history
    const filtered = matches.filter(item => {
        if (item.startsWith('custrecord_')) {
            // This is likely a field, not a record type - exclude it
            return false;
        }
        // For customrecord_ items, keep them (they're record types)
        return true;
    });

    return Array.from(new Set(filtered)).sort();
}

function updateManifestWithCustomObjects(projectName, customObjects) {
    const manifestPath = path.join(projectName, 'src', 'manifest.xml');

    if (!fs.existsSync(manifestPath)) {
        console.log(`     ⚠️  manifest.xml not found, skipping custom object check`);
        return;
    }

    let manifestContent = fs.readFileSync(manifestPath, 'utf8');

    // Extract existing objects from manifest
    const existingObjects = [];
    const objectRegex = /<object>(.*?)<\/object>/g;
    let match;
    while ((match = objectRegex.exec(manifestContent)) !== null) {
        existingObjects.push(match[1]);
    }

    // Combine and deduplicate
    const allObjects = Array.from(new Set([...existingObjects, ...customObjects])).sort();

    if (allObjects.length === 0) {
        return;
    }

    // Create objects XML string
    const objectsString = allObjects.map(obj => `\t\t<object>${obj}</object>`).join('\n');

    // Check if <objects> section exists
    if (!manifestContent.includes('<objects>')) {
        // Add objects section before closing </dependencies>
        manifestContent = manifestContent.replace(
            '</dependencies>',
            `\t<objects>\n${objectsString}\n\t</objects>\n</dependencies>`
        );
    } else {
        // Replace existing objects section
        manifestContent = manifestContent.replace(
            /(<objects>)[\s\S]*?(<\/objects>)/,
            `$1\n${objectsString}\n\t$2`
        );
    }

    // Write updated manifest
    fs.writeFileSync(manifestPath, manifestContent);
    console.log(`     ✅ Updated manifest.xml with ${allObjects.length} custom object(s)`);
}

function updateManifestWithFeatures(projectName, requiredFeatures) {
    const manifestPath = path.join(projectName, 'src', 'manifest.xml');

    if (!fs.existsSync(manifestPath)) {
        console.log(`     ⚠️  manifest.xml not found, skipping feature check`);
        return;
    }

    if (requiredFeatures.length === 0) {
        return;
    }

    let manifestContent = fs.readFileSync(manifestPath, 'utf8');

    // Extract existing features from manifest
    const existingFeatures = [];
    const featureRegex = /<feature required="true">(.*?)<\/feature>/g;
    let match;
    while ((match = featureRegex.exec(manifestContent)) !== null) {
        existingFeatures.push(match[1]);
    }

    // Combine and deduplicate
    const allFeatures = Array.from(new Set([...existingFeatures, ...requiredFeatures])).sort();

    // Create features XML string
    const featuresString = allFeatures.map(feature => `\t\t<feature required="true">${feature}</feature>`).join('\n');

    // Check if <dependencies> section exists
    if (!manifestContent.includes('<dependencies>')) {
        // Add dependencies section with features before closing </manifest>
        manifestContent = manifestContent.replace(
            '</manifest>',
            `  <dependencies>\n\t<features>\n${featuresString}\n\t</features>\n  </dependencies>\n</manifest>`
        );
    } else {
        // Check if <features> section exists within dependencies
        if (!manifestContent.includes('<features>')) {
            // Add features section before closing </dependencies>
            manifestContent = manifestContent.replace(
                '</dependencies>',
                `\t<features>\n${featuresString}\n\t</features>\n  </dependencies>`
            );
        } else {
            // Replace existing features section
            manifestContent = manifestContent.replace(
                /(<features>)[\s\S]*?(<\/features>)/,
                `$1\n${featuresString}\n\t$2`
            );
        }
    }

    // Write updated manifest
    fs.writeFileSync(manifestPath, manifestContent);
    console.log(`     ✅ Updated manifest.xml with ${allFeatures.length} required feature(s)`);
}

function performSanityChecks(filePath, fileContent) {
    const errors = [];
    const warnings = [];

    // Check for @NName tag
    const nameMatch = fileContent.match(/@NName\s+(.+)/);
    if (!nameMatch || !nameMatch[1].trim()) {
        errors.push(`Missing or empty @NName tag`);
    } else if (nameMatch[1].length > 40) {
        errors.push(`@NName "${nameMatch[1]}" is too long (max 40 characters, found ${nameMatch[1].length})`);
    }

    // Check for @NDescription tag
    const descMatch = fileContent.match(/@NDescription\s+(.+)/);
    if (!descMatch || !descMatch[1].trim()) {
        warnings.push(`Missing or empty @NDescription tag`);
    }

    // Check for empty line after header comment
    // Look for */ followed by optional whitespace and newline
    const headerEndMatch = fileContent.match(/\*\/[ \t]*(\r?\n)/);
    if (headerEndMatch) {
        const endIndex = headerEndMatch.index + headerEndMatch[0].length;
        // Check if the next line is empty (just another newline)
        const restOfFile = fileContent.substring(endIndex);
        if (!restOfFile.match(/^[ \t]*(\r?\n)/)) {
            // No empty line found - next line has content
            errors.push(`No empty line after header comment block`);
        }
    }

    // Check UserEventScript specific issues
    const scriptTypeMatch = fileContent.match(/@NScriptType\s+(\w+)/);
    if (scriptTypeMatch && scriptTypeMatch[1] === 'UserEventScript') {
        // Check for setText in CREATE mode
        if (fileContent.includes('setText') && fileContent.includes('UserEventType.CREATE')) {
            errors.push(`UserEventScript uses setText in CREATE mode (use setValue instead)`);
        }
    }

    // Check ClientScript imports
    if (scriptTypeMatch && scriptTypeMatch[1] === 'ClientScript') {
        // Check for server-only module imports
        const serverOnlyModules = ['N/file', 'N/task', 'N/render', 'N/crypto'];
        for (const module of serverOnlyModules) {
            if (fileContent.includes(`from '${module}'`) || fileContent.includes(`"${module}"`)) {
                errors.push(`ClientScript cannot import server-only module: ${module}`);
            }
        }
    }

    return {errors, warnings};
}

function generateXMLFiles(projectName) {
    console.log(`🔧 Generating XML files for project: ${projectName}`);

    if (!fs.existsSync(projectName)) {
        console.error(`❌ Project directory '${projectName}' not found`);
        process.exit(1);
    }

    // Find all TypeScript script files
    const scriptFiles = findScriptFiles(projectName);
    console.log(`📋 Found ${scriptFiles.length} script file(s):`);

    // Ensure Objects directory exists
    const objectsDir = path.join(projectName, 'src', 'Objects');
    fs.mkdirSync(objectsDir, {recursive: true});

    let processedCount = 0;
    const errors = [];
    const allCustomObjects = [];
    const scriptTypes = new Set();

    for (const filePath of scriptFiles) {
        const relativePath = path.relative(process.cwd(), filePath);
        const fileContent = fs.readFileSync(filePath, 'utf8');

        // Collect custom objects from all TypeScript files
        const customObjects = getCustomObjectNames(fileContent);
        allCustomObjects.push(...customObjects);

        const isSuiteScript = isSuiteScriptFile(filePath);

        if (!isSuiteScript) {
            console.log(`   - ${relativePath} (helper/model file - skipping XML generation)`);
            continue;
        }

        console.log(`   - ${relativePath}`);

        try {
            // Perform sanity checks
            const {errors: sanityErrors, warnings} = performSanityChecks(filePath, fileContent, projectName);

            // Display warnings
            warnings.forEach(warning => {
                console.log(`     ⚠️  ${warning}`);
            });

            // Stop processing if there are sanity errors
            if (sanityErrors.length > 0) {
                sanityErrors.forEach(error => {
                    console.error(`     ❌ ${error}`);
                    errors.push(`${relativePath}: ${error}`);
                });
                continue;
            }

            // Parse script header
            const annotations = parseScriptHeader(filePath);

            if (!annotations || !annotations.NScriptType) {
                console.log(`     ⚠️  No NetSuite script annotations found`);
                continue;
            }

            // Track script types for feature requirements
            scriptTypes.add(annotations.NScriptType);

            // Generate XML
            const result = generateScriptXML(annotations, filePath, projectName);

            // Check if XML was generated (null for ClientScript with @NDeploy Suitelet)
            if (result.xml === null) {
                console.log(`     ✅ ClientScript for Suitelet - no XML needed`);
                processedCount++;
            } else {
                // Write XML file
                const xmlFileName = `${result.scriptId}.xml`;
                const xmlFilePath = path.join(objectsDir, xmlFileName);

                fs.writeFileSync(xmlFilePath, result.xml);
                console.log(`     ✅ Generated: ${xmlFilePath}`);
                processedCount++;
            }
        } catch (error) {
            const errorMsg = `Failed to process ${filePath}: ${error.message}`;
            console.error(`     ❌ ${errorMsg}`);
            errors.push(errorMsg);
        }
    }

    // Update manifest with all collected custom objects
    if (allCustomObjects.length > 0) {
        console.log(`\n📝 Updating manifest.xml with custom objects...`);
        const uniqueCustomObjects = Array.from(new Set(allCustomObjects));
        updateManifestWithCustomObjects(projectName, uniqueCustomObjects);
    }

    // Update manifest with required features based on script types
    const requiredFeatures = [];
    if (scriptTypes.has('MapReduceScript')) {
        requiredFeatures.push('SERVERSIDESCRIPTING');
    }

    if (requiredFeatures.length > 0) {
        console.log(`\n📝 Updating manifest.xml with required features...`);
        updateManifestWithFeatures(projectName, requiredFeatures);
    }

    if (errors.length > 0) {
        console.error(`\n❌ XML generation failed with ${errors.length} error(s):`);
        errors.forEach(error => console.error(`   - ${error}`));
        process.exit(1);
    }

    console.log(`🎉 Generated ${processedCount} XML file(s) for project '${projectName}'`);
}

// Get project name from command line arguments
function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        // Try to determine project name from current directory
        const currentDir = path.basename(process.cwd());
        if (fs.existsSync('src') && fs.existsSync('../build.js')) {
            generateXMLFiles(currentDir);
        } else {
            console.error('❌ Please provide a project name or run from within a project directory');
            console.log('Usage: node generate-script-xml.js ProjectName');
            process.exit(1);
        }
    } else {
        const projectName = args[0];
        generateXMLFiles(projectName);
    }
}

if (require.main === module) {
    main();
}

module.exports = {generateXMLFiles, parseScriptHeader, generateScriptXML, truncateId};