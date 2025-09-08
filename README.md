# NetSuite Commands Framework

A functional programming framework for NetSuite that implements the Command Pattern for orchestrating complex business operations with rollback capabilities, error handling, and batch processing support.

## Overview

This framework provides a robust command execution system for NetSuite, allowing you to:
- Define reusable, composable commands for NetSuite operations
- Execute commands individually or in batches
- Handle errors gracefully with fallback mechanisms
- Process large-scale operations through MapReduce
- Serialize and transport commands between different script contexts

## Features

- **Command Pattern Implementation**: Each operation is encapsulated as a command with execute, undo, and fallback capabilities
- **Batch Processing**: Execute multiple commands in sequence with automatic error handling
- **MapReduce Integration**: Scale to handle thousands of operations efficiently
- **Template System**: Reference outputs from previous commands using template placeholders
- **Multiple Entry Points**: RESTlet API, Suitelet UI, and MapReduce processors
- **Automatic Record Management**: Tracks and saves loaded records automatically
- **Conditional Execution**: Skip or stop commands based on context conditions


## Usage


### Available Commands

#### Record Operations
- `CommandCreateRecord`: Create new records
- `CommandLoadRecord`: Load existing records
- `CommandSaveRecord`: Save current record
- `CommandDeleteRecord`: Delete records

#### Field Operations
- `CommandSetValueOnLoadedRecord`: Set field values
- `CommandSetTextOnLoadedRecord`: Set text field values
- `CommandSetMultiSelectValueOnLoadedRecord`: Set multi-select fields
- `CommandSetAddressFieldOnLoadedRecord`: Set address fields
- `CommandSetValuesWithoutLoadingRecord`: Bulk field updates

#### Line Item Operations
- `CommandAddLineDynamicMode`: Add line items dynamically
- `CommandDeleteLine`: Remove line items
- `CommandCommitCurrentLine`: Commit current line
- `CommandSelectLine`: Select specific line

#### Other Operations
- `CommandRecordAttach`: Attach records
- `CommandRecordDetach`: Detach records
- `CommandLockUnlockField`: Control field editability
- `CommandThrowException`: Throw controlled exceptions

### Template System

Reference outputs from previous commands using the `<ID>` syntax:

```json
[
  {
    "type": "CommandCreateRecord",
    "recordType": "customer",
    "values": {"companyname": "Test Co"},
    "details": "12345"
  },
  {
    "type": "CommandSetValueOnLoadedRecord",
    "fieldId": "custentity_parent",
    "value": "<12345>"
  }
]
```

## Development

### Project Structure

```
/
├── Command.ts                 # Core command interface
├── CommandHandler.ts          # Command orchestration
├── CommandContext.ts          # Execution context
├── Command*.ts               # Individual command implementations
├── rest_run_commands.ts      # RESTlet entry point
├── mr_commands.ts            # MapReduce processor
├── st_run_commands.ts        # Suitelet UI
├── __tests__/                # Jest test files
└── suitecloud.config.js      # SuiteCloud configuration
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

### Linting

```bash
npm run lint
```

### Building

```bash
npm run build
```

## Creating Custom Commands

Implement the `Command` interface:

```typescript
import {Command} from "./Command";
import {CommandContext} from "./CommandContext";

export class CommandCustom implements Command {
    type = "CommandCustom";
    details: string;
    group = "custom";
    
    execute(context?: CommandContext, log?: (s: string) => void): CommandContext {
        // Implementation
        context.result = "Success";
        return context;
    }
    
    undo(context?: CommandContext): CommandContext {
        // Rollback logic
        return context;
    }
    
    fallBack(): Command[] {
        // Alternative commands if this fails
        return [];
    }
    
    // ... other required methods
    
    toStr(): string {
        return JSON.stringify(this);
    }
    
    static fromString(s: string): CommandCustom {
        return Object.assign(new CommandCustom(), JSON.parse(s));
    }
}
```

Don't forget to register your command in `CommandHandler.commandFromString()`.

## API Reference

### CommandContext

The context object passed between commands:

```typescript
interface CommandContext {
    output?: {[key: string]: string};        // Store command outputs
    loadedRecord?: Record;                   // Current NetSuite record
    automaticallyLoadedRecords?: Record[];   // Records to auto-save
    failed?: boolean;                        // Execution failed flag
    skip?: boolean;                          // Skip current command
    stop?: boolean;                          // Stop execution chain
    result?: string;                          // Execution result message
    fallbacks?: Command[];                    // Fallback commands
}
```

### Command Lifecycle

1. `conditionsToSkip()` - Check if command should be skipped
2. `conditionsToStop()` - Check if execution should stop
3. `execute()` - Main command logic
4. `fallBack()` - Generate fallback commands on failure (if any)
5. `aftermathToStop()` - Post-execution stop conditions

## Error Handling

Commands can be marked as `optional` to continue execution on failure:

```json
{
  "type": "CommandSetValueOnLoadedRecord",
  "optional": true,
  "fieldId": "custentity_field",
  "value": "test"
}
```

## MapReduce Processing

For large-scale operations, use MapReduce mode:

```javascript
{
  "commands": "[...]",
  "useMapReduce": "true",
  "customJobId": "BATCH_001"  // Optional custom job identifier
}
```

## Deployment

The framework supports multiple deployment slots for parallel processing:
- 10 MapReduce deployment slots (`customdeploy_mr_commands1` through `customdeploy_mr_commands10`)
- Automatic failover to available slots
- Parameter chunking for large command sets

## License

See LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass and linting succeeds
5. Submit a pull request

## Support

For issues and questions, please use the GitHub issue tracker.