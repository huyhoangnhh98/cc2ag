import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { ConvertOptions } from '../types.js';
import { getGlobalSource, getGlobalTarget } from '../utils/paths.js';
import { exists, listDirs, listFiles, ensureDir, removeDir } from '../utils/fs.js';
import { convertAllWorkflows } from '../converters/workflow.js';
import { convertAllSkills, convertAllAgents } from '../converters/skill.js';

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
    const workflowSpinner = ora('Converting workflows to global...').start();
    let oversizedWorkflows: string[] = [];
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
        });
        workflowSpinner.succeed(`${workflowResult.count} workflows → ${globalTarget.workflows}`);
        oversizedWorkflows = workflowResult.oversizedFiles;
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

    // Convert agents
    const agentSpinner = ora(`Converting agents to ${skillContext}...`).start();
    try {
        await ensureDir(skillTargetPath);
        const agentCount = await convertAllAgents({
            sourcePath: source.agents,
            targetPath: skillTargetPath,
            skillNames,
            agentNames,
            context: skillContext,
            dryRun: options.dryRun,
            verbose: options.verbose,
        });
        agentSpinner.succeed(`${agentCount} agents → ${skillTargetPath}`);
    } catch (error) {
        agentSpinner.fail('Failed to convert agents');
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

    // Display warnings for oversized workflows
    if (oversizedWorkflows.length > 0) {
        console.log('');
        console.log(chalk.yellow('⚠ WARNING: The following workflows exceed Antigravity\'s 12000 character limit:'));
        for (const file of oversizedWorkflows) {
            console.log(chalk.yellow(`   - ${file}`));
        }
        console.log(chalk.yellow('   Consider refactoring large workflows into smaller skill references.'));
    }
}
