#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { convertGlobal } from './commands/global.js';
import { convertProject } from './commands/project.js';
import { convertBoth } from './commands/both.js';
import { uninstall } from './commands/uninstall.js';
import { autoUpdate, checkAndPromptUpdate } from './utils/update-checker.js';

const program = new Command();
const CLI_VERSION = '1.3.4';

program
    .name('cc2ag')
    .description('Convert Claude Code configurations to Antigravity format')
    .version(CLI_VERSION);

program
    .command('global')
    .description('Convert global ~/.claude to ~/.gemini/antigravity')
    .option('--dry-run', 'Preview changes without writing')
    .option('--force', 'Overwrite existing files')
    .option('--verbose', 'Show detailed output')
    .option('--clean', 'Clean target directories before converting')
    .option('--fresh', 'Clean and convert fresh (removes existing)')
    .option('-y, --yes', 'Skip confirmation prompts')
    .action(async (options) => {
        console.log(chalk.cyan('╔════════════════════════════════════════════════════════════╗'));
        console.log(chalk.cyan('║     cc2ag: Claude Code → Antigravity Converter             ║'));
        console.log(chalk.cyan('╚════════════════════════════════════════════════════════════╝'));
        console.log('');
        await convertGlobal(options);
    });

program
    .command('project')
    .description('Convert project .claude to .agent (workflows + skills + agents)')
    .option('--dry-run', 'Preview changes without writing')
    .option('--force', 'Overwrite existing files')
    .option('--verbose', 'Show detailed output')
    .option('--clean', 'Clean target directories before converting')
    .option('--fresh', 'Clean and convert fresh (removes existing)')
    .option('-y, --yes', 'Skip confirmation prompts')
    .action(async (options) => {
        console.log(chalk.cyan('╔════════════════════════════════════════════════════════════╗'));
        console.log(chalk.cyan('║     cc2ag: Claude Code → Antigravity Converter             ║'));
        console.log(chalk.cyan('╚════════════════════════════════════════════════════════════╝'));
        console.log('');
        await convertProject(options);
    });

program
    .command('both')
    .description('Convert both global and project sources')
    .option('--dry-run', 'Preview changes without writing')
    .option('--force', 'Overwrite existing files')
    .option('--verbose', 'Show detailed output')
    .option('--clean', 'Clean target directories before converting')
    .option('--fresh', 'Clean and convert fresh (removes existing)')
    .option('-y, --yes', 'Skip confirmation prompts')
    .action(async (options) => {
        console.log(chalk.cyan('╔════════════════════════════════════════════════════════════╗'));
        console.log(chalk.cyan('║     cc2ag: Claude Code → Antigravity Converter             ║'));
        console.log(chalk.cyan('╚════════════════════════════════════════════════════════════╝'));
        console.log('');
        await convertBoth(options);
    });

program
    .command('uninstall')
    .description('Remove all cc2ag-generated workflows, skills, and agents')
    .option('--dry-run', 'Preview what would be removed without deleting')
    .option('--verbose', 'Show detailed output')
    .option('--global', 'Only remove global files (~/.gemini/antigravity)')
    .option('--project', 'Only remove project files (.agent)')
    .action(async (options) => {
        console.log(chalk.red('╔════════════════════════════════════════════════════════════╗'));
        console.log(chalk.red('║     cc2ag: Uninstall Antigravity Files                     ║'));
        console.log(chalk.red('╚════════════════════════════════════════════════════════════╝'));
        console.log('');
        await uninstall(options);
    });

program
    .command('update')
    .description('Update cc2ag to the latest version')
    .action(async () => {
        console.log(chalk.cyan('╔════════════════════════════════════════════════════════════╗'));
        console.log(chalk.cyan('║     cc2ag: Update Tool                                     ║'));
        console.log(chalk.cyan('╚════════════════════════════════════════════════════════════╝'));
        console.log('');
        const success = await autoUpdate('@huyhoangnhh98/cc2ag');
        process.exit(success ? 0 : 1);
    });

// Check for updates after command execution
program.hook('postAction', async () => {
    // Only check on non-update commands to avoid double updates
    const command = process.argv[2];
    if (command !== 'update') {
        await checkAndPromptUpdate(CLI_VERSION, '@huyhoangnhh98/cc2ag');
    }
});

// Default command shows help
program.parse(process.argv);

if (!process.argv.slice(2).length) {
    program.outputHelp();
}
