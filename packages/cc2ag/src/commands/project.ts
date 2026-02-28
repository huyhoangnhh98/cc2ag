import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { ConvertOptions } from '../types.js';
import { getProjectSource, getProjectTarget } from '../utils/paths.js';
import { exists, listDirs, listFiles, ensureDir, removeDir } from '../utils/fs.js';
import { confirm } from '../utils/prompt.js';
import { generateWorkflows } from '../converters/workflow.js';
import { convertAllRules, getClaudeMdContent, writeGeminiMd } from '../converters/rules.js';
import { convertAllSkills, convertAllAgents as convertAllClaudeKitSkills } from '../converters/skill.js';

export async function convertProject(options: ConvertOptions): Promise<void> {
    const source = getProjectSource();
    const target = getProjectTarget();

    // Check source exists
    const sourceExists = await exists(path.dirname(source.workflows));
    if (!sourceExists) {
        console.log(chalk.red('✗ Project Claude Code directory not found: ./.claude'));
        console.log(chalk.yellow('  Make sure you are in a project with .claude/ directory.'));
        return;
    }

    // Handle --fresh flag (clean + convert with confirmation)
    if (options.fresh) {
        console.log(chalk.yellow('⚠ WARNING: --fresh will remove all existing converted content.'));
        console.log(chalk.yellow(`  Target: ${target.workflows}`));
        console.log(chalk.yellow(`  Target: ${target.skills}`));
        console.log(chalk.yellow(`  Target: ${target.rules}`));
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
        const cleanSpinner = ora('Cleaning target directories...').start();
        await removeDir(target.workflows);
        await removeDir(target.skills);
        await removeDir(target.rules);
        cleanSpinner.succeed('Cleaned .agent/workflows, .agent/skills, and .agent/rules');
    }

    // Collect skill and agent names for reference updates
    const spinner = ora('Scanning sources...').start();

    const skillNames = await listDirs(source.skills);
    const agentNames = (await listFiles(source.agents, '.md')).map(f => path.basename(f, '.md'));

    spinner.succeed(`Found ${skillNames.length} skills, ${agentNames.length} agents`);

    // Convert CK workflows → AG rules
    const rulesSpinner = ora('Converting rules...').start();
    try {
        await ensureDir(target.rules);
        const rulesCount = await convertAllRules({
            sourcePath: source.workflows,
            targetPath: target.rules,
            skillNames,
            agentNames,
            context: 'project',
            dryRun: options.dryRun,
            verbose: options.verbose,
        });
        rulesSpinner.succeed(`${rulesCount} rules → ${target.rules}`);
    } catch (error) {
        rulesSpinner.fail('Failed to convert rules');
        if (options.verbose) console.error(error);
    }

    // Generate workflows (brainstorm, plan, cook)
    const workflowSpinner = ora('Generating workflows...').start();
    let skippedSkills: string[] = [];
    try {
        await ensureDir(target.workflows);
        const workflowResult = await generateWorkflows({
            skillsPath: source.skills,
            targetPath: target.workflows,
            skillNames,
            agentNames,
            context: 'project',
            dryRun: options.dryRun,
            verbose: options.verbose,
        });
        workflowSpinner.succeed(`${workflowResult.count} workflows → ${target.workflows}`);
        skippedSkills = workflowResult.skippedSkills;
    } catch (error) {
        workflowSpinner.fail('Failed to generate workflows');
        if (options.verbose) console.error(error);
    }

    // Collect GEMINI.md content sections (assembled at the end)
    const geminiMdSections: string[] = [];

    // Get CLAUDE.md content for GEMINI.md
    const claudeSpinner = ora('Converting CLAUDE.md → GEMINI.md...').start();
    try {
        const claudeContent = await getClaudeMdContent(
            source.claudeMd, skillNames, agentNames, 'project'
        );
        if (claudeContent) {
            geminiMdSections.push(claudeContent);
            claudeSpinner.succeed('CLAUDE.md content collected');
        } else {
            claudeSpinner.info('No CLAUDE.md found, skipping');
        }
    } catch (error) {
        claudeSpinner.fail('Failed to convert CLAUDE.md');
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

    // Convert ClaudeKit agents to skills (for compatibility)
    const agentSpinner = ora('Converting agents...').start();
    try {
        await ensureDir(target.skills);
        const agentCount = await convertAllClaudeKitSkills({
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
        agentSpinner.fail('Failed to convert agents to skills');
        if (options.verbose) console.error(error);
    }

    // Write final assembled GEMINI.md (CLAUDE.md + routing)
    const geminiSpinner = ora('Writing GEMINI.md...').start();
    try {
        const written = await writeGeminiMd(
            target.geminiMd, geminiMdSections, options.dryRun
        );
        if (written) {
            geminiSpinner.succeed(`GEMINI.md → ${target.geminiMd}`);
        } else {
            geminiSpinner.info('No content for GEMINI.md');
        }
    } catch (error) {
        geminiSpinner.fail('Failed to write GEMINI.md');
        if (options.verbose) console.error(error);
    }

    console.log('');
    console.log(chalk.green('╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.green('║                    Conversion Complete!                    ║'));
    console.log(chalk.green('╚════════════════════════════════════════════════════════════╝'));
    console.log('');
    console.log(chalk.cyan('Output:'));
    console.log(`  Rules:     ${target.rules}`);
    console.log(`  Workflows: ${target.workflows}`);
    console.log(`  Skills:    ${target.skills} (skill-*, agent-*)`);

    // Display skipped skills info
    if (skippedSkills.length > 0 && options.verbose) {
        console.log('');
        console.log(chalk.gray(`ℹ Skipped missing workflow sources`));
    }
}
