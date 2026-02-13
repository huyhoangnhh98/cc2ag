import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { ConvertOptions } from '../types.js';
import { getGlobalSource, getGlobalTarget } from '../utils/paths.js';
import { exists, listDirs, listFiles, ensureDir, removeDir } from '../utils/fs.js';
import { confirm } from '../utils/prompt.js';
import { convertAllWorkflows } from '../converters/workflow.js';
import { convertAllSkills, convertAllAgents as convertAllClaudeKitSkills } from '../converters/skill.js';
import { convertAllAgents as convertAllClaudeKitSubAgents } from '../converters/subagent.js';
import { ensureExtensionInstalled } from '../utils/extension-installer.js';
import { createRoutingFromAgents } from '../generators/routing.js';

export async function convertGlobal(options: ConvertOptions): Promise<void> {
    const source = getGlobalSource();
    const globalTarget = getGlobalTarget();

    // Global source always outputs to global target
    const skillContext: 'global' | 'project' = 'global';
    const skillTargetPath = globalTarget.skills;

    // Check source exists
    const sourceExists = await exists(path.dirname(source.commands));
    if (!sourceExists) {
        console.log(chalk.red('✗ Global Claude Code directory not found: ~/.claude'));
        console.log(chalk.yellow('  Make sure you have Claude Code installed globally.'));
        return;
    }

    // Handle --fresh flag (clean + convert with confirmation)
    if (options.fresh) {
        console.log(chalk.yellow('⚠ WARNING: --fresh will remove all existing converted content.'));
        console.log(chalk.yellow(`  Target: ${globalTarget.workflows}`));
        console.log(chalk.yellow(`  Target: ${globalTarget.skills}`));
        console.log('');

        if (!options.yes) {
            const confirmed = await confirm('Continue?');
            if (!confirmed) {
                console.log('Aborted.');
                return;
            }
        }

        options.clean = true; // Enable clean mode
    }

    // Clean target directories if --clean flag is set
    if (options.clean) {
        const cleanSpinner = ora('Cleaning global target directories...').start();
        await removeDir(globalTarget.workflows);
        await removeDir(globalTarget.skills);
        cleanSpinner.succeed('Cleaned global_workflows and skills');
    }

    // Collect skill and agent names for reference updates
    const spinner = ora('Scanning sources...').start();

    const skillNames = await listDirs(source.skills);
    const agentNames = (await listFiles(source.agents, '.md')).map(f => path.basename(f, '.md'));

    spinner.succeed(`Found ${skillNames.length} skills, ${agentNames.length} agents`);

    // Convert workflows to global (always use global context for path replacement)
    // Now also includes user-invocable skills as workflows
    const workflowSpinner = ora('Converting commands + skills to workflows...').start();
    let oversizedWorkflows: string[] = [];
    let skippedSkills: string[] = [];
    try {
        await ensureDir(globalTarget.workflows);
        const workflowResult = await convertAllWorkflows({
            sourcePath: source.commands,
            targetPath: globalTarget.workflows,
            skillNames,
            agentNames,
            context: 'global',
            dryRun: options.dryRun,
            verbose: options.verbose,
            skillsPath: source.skills, // NEW: include skills as workflow sources
        });
        workflowSpinner.succeed(`${workflowResult.count} workflows → ${globalTarget.workflows}`);
        oversizedWorkflows = workflowResult.oversizedFiles;
        skippedSkills = workflowResult.skippedSkills;
    } catch (error) {
        workflowSpinner.fail('Failed to convert workflows');
        if (options.verbose) console.error(error);
    }

    // Convert skills
    const skillSpinner = ora(`Converting skills to ${skillContext}...`).start();
    try {
        await ensureDir(skillTargetPath);
        const skillCount = await convertAllSkills({
            sourcePath: source.skills,
            targetPath: skillTargetPath,
            skillNames,
            agentNames,
            context: skillContext,
            dryRun: options.dryRun,
            verbose: options.verbose,
        });
        skillSpinner.succeed(`${skillCount} skills → ${skillTargetPath}`);
    } catch (error) {
        skillSpinner.fail('Failed to convert skills');
        if (options.verbose) console.error(error);
    }

    // Handle extension installation
    if (options.installExtension) {
        const extensionSpinner = ora('Installing Antigravity SubAgents extension...').start();
        try {
            const success = await ensureExtensionInstalled({ verbose: options.verbose });
            if (success) {
                extensionSpinner.succeed('Extension installed successfully');
            } else {
                extensionSpinner.fail('Extension installation failed');
                console.log(chalk.yellow('  Note: Conversion will proceed without extension support'));
            }
        } catch (error) {
            extensionSpinner.fail('Extension installation error');
            console.error(error);
        }
    } else if (!options.skipExtension) {
        // Check if extension is installed and warn if not
        try {
            const isInstalled = await ensureExtensionInstalled({ skipIfInstalled: true, verbose: false });
            if (!isInstalled && options.verbose) {
                console.log(chalk.yellow('⚠ Antigravity SubAgents extension not found.'));
                console.log(chalk.yellow('  Install with: code --install-extension OleynikAleksandr.antigravity-subagents'));
                console.log(chalk.yellow('  Or run with --install-extension flag'));
            }
        } catch (error) {
            if (options.verbose) {
                console.log(chalk.yellow('⚠ Could not verify extension installation status'));
            }
        }
    }

    // Convert agents to subagent format
    const subagentSpinner = ora('Converting ClaudeKit agents to SubAgents...').start();
    try {
        const subagentsTarget = path.join(process.env.HOME || '~', '.subagents');
        const subagentCount = await convertAllClaudeKitSubAgents({
            sourcePath: source.agents,
            targetPath: subagentsTarget,
            context: 'global',
            dryRun: options.dryRun,
            verbose: options.verbose,
        });
        subagentSpinner.succeed(`${subagentCount} agents → ${subagentsTarget} (SubAgents)`);
    } catch (error) {
        subagentSpinner.fail('Failed to convert agents to SubAgents');
        if (options.verbose) console.error(error);
    }

    // Convert ClaudeKit agents to skills (for compatibility)
    const agentSpinner = ora(`Converting agents to ${skillContext} (compatibility)...`).start();
    try {
        await ensureDir(skillTargetPath);
        const agentCount = await convertAllClaudeKitSkills({
            sourcePath: source.agents,
            targetPath: skillTargetPath,
            skillNames,
            agentNames,
            context: skillContext,
            dryRun: options.dryRun,
            verbose: options.verbose,
        });
        agentSpinner.succeed(`${agentCount} agents → ${skillTargetPath} (skills)`);
    } catch (error) {
        agentSpinner.fail('Failed to convert agents to skills');
        if (options.verbose) console.error(error);
    }

    // Generate routing rules
    const routingSpinner = ora('Generating routing rules for SubAgents...').start();
    try {
        const geminiTarget = path.join(process.env.HOME || '~', '.gemini');
        await createRoutingFromAgents(
            path.join(process.env.HOME || '~', '.subagents'),
            geminiTarget,
            { dryRun: options.dryRun, verbose: options.verbose }
        );
        routingSpinner.succeed(`Routing rules → ${geminiTarget}/GEMINI.md`);
    } catch (error) {
        routingSpinner.fail('Failed to generate routing rules');
        if (options.verbose) console.error(error);
    }

    console.log('');
    console.log(chalk.green('╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.green('║                    Conversion Complete!                    ║'));
    console.log(chalk.green('╚════════════════════════════════════════════════════════════╝'));
    console.log('');
    console.log(chalk.cyan('Output:'));
    console.log(`  Workflows: ${globalTarget.workflows}`);
    console.log(`  Skills:    ${skillTargetPath} (skill-*, agent-*)`);
    console.log(`  SubAgents: ~/.subagents/ (SubAgent configs)`);
    console.log(`  Routing:   ~/.gemini/GEMINI.md (auto-routing rules)`);
    if (options.installExtension) {
        console.log(`  Extension: Antigravity SubAgents (installed)`);
    } else {
        console.log(`  Extension: Antigravity SubAgents (not installed - run with --install-extension)`);
    }

    // Display warnings for oversized workflows
    if (oversizedWorkflows.length > 0) {
        console.log('');
        console.log(chalk.yellow('⚠ WARNING: The following workflows exceed Antigravity\'s 12000 character limit:'));
        for (const file of oversizedWorkflows) {
            console.log(chalk.yellow(`   - ${file}`));
        }
        console.log(chalk.yellow('   Consider refactoring large workflows into smaller skill references.'));
    }

    // Display skipped skills info
    if (skippedSkills.length > 0 && options.verbose) {
        console.log('');
        console.log(chalk.gray(`ℹ Skipped ${skippedSkills.length} non-user-invocable skills`));
    }
}
