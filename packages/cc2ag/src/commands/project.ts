import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { ConvertOptions } from '../types.js';
import { getProjectSource, getProjectTarget } from '../utils/paths.js';
import { exists, listDirs, listFiles, ensureDir, removeDir } from '../utils/fs.js';
import { convertAllWorkflows } from '../converters/workflow.js';
import { convertAllSkills, convertAllAgents } from '../converters/skill.js';

export async function convertProject(options: ConvertOptions): Promise<void> {
    const source = getProjectSource();
    const target = getProjectTarget();

    // Check source exists
    const sourceExists = await exists(path.dirname(source.commands));
    if (!sourceExists) {
        console.log(chalk.red('✗ Project Claude Code directory not found: ./.claude'));
        console.log(chalk.yellow('  Make sure you are in a project with .claude/ directory.'));
        return;
    }

    // Clean target directories if --clean flag is set
    if (options.clean) {
        const cleanSpinner = ora('Cleaning target directories...').start();
        await removeDir(target.workflows);
        await removeDir(target.skills);
        cleanSpinner.succeed('Cleaned .agent/workflows and .agent/skills');
    }

    // Collect skill and agent names for reference updates
    const spinner = ora('Scanning sources...').start();

    const skillNames = await listDirs(source.skills);
    const agentNames = (await listFiles(source.agents, '.md')).map(f => path.basename(f, '.md'));

    spinner.succeed(`Found ${skillNames.length} skills, ${agentNames.length} agents`);

    // Convert workflows
    const workflowSpinner = ora('Converting workflows...').start();
    let oversizedWorkflows: string[] = [];
    try {
        await ensureDir(target.workflows);
        const workflowResult = await convertAllWorkflows({
            sourcePath: source.commands,
            targetPath: target.workflows,
            skillNames,
            agentNames,
            context: 'project',
            dryRun: options.dryRun,
            verbose: options.verbose,
        });
        workflowSpinner.succeed(`${workflowResult.count} workflows → ${target.workflows}`);
        oversizedWorkflows = workflowResult.oversizedFiles;
    } catch (error) {
        workflowSpinner.fail('Failed to convert workflows');
        if (options.verbose) console.error(error);
    }

    // Convert skills
    const skillSpinner = ora('Converting skills...').start();
    try {
        await ensureDir(target.skills);
        const skillCount = await convertAllSkills({
            sourcePath: source.skills,
            targetPath: target.skills,
            skillNames,
            agentNames,
            context: 'project',
            dryRun: options.dryRun,
            verbose: options.verbose,
        });
        skillSpinner.succeed(`${skillCount} skills → ${target.skills}`);
    } catch (error) {
        skillSpinner.fail('Failed to convert skills');
        if (options.verbose) console.error(error);
    }

    // Convert agents
    const agentSpinner = ora('Converting agents...').start();
    try {
        await ensureDir(target.skills);
        const agentCount = await convertAllAgents({
            sourcePath: source.agents,
            targetPath: target.skills,
            skillNames,
            agentNames,
            context: 'project',
            dryRun: options.dryRun,
            verbose: options.verbose,
        });
        agentSpinner.succeed(`${agentCount} agents → ${target.skills}`);
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
    console.log(`  Workflows: ${target.workflows}`);
    console.log(`  Skills:    ${target.skills} (skill-*, agent-*)`);

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
