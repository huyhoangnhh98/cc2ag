import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { ConvertOptions } from '../types.js';
import { getProjectSource, getProjectTarget } from '../utils/paths.js';
import { exists, listDirs, listFiles, ensureDir, removeDir } from '../utils/fs.js';
import { confirm } from '../utils/prompt.js';
import { convertAllRules, getClaudeMdContent, writeGeminiMd, generateConversionLossNotice } from '../converters/rules.js';
import { convertAllSkills, convertAllAgents as convertAllClaudeKitSkills } from '../converters/skill.js';
import { generateHookRules, logHookRulesGuidance } from '../converters/hook-rules.js';

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
        await removeDir(target.agents);
        await removeDir(target.rules);
        cleanSpinner.succeed('Cleaned .agent/workflows, .agent/skills, .agent/agents, and .agent/rules');
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

    // Convert ClaudeKit agents to dedicated agent folders
    const agentSpinner = ora('Converting agents...').start();
    try {
        await ensureDir(target.agents);
        const agentCount = await convertAllClaudeKitSkills({
            sourcePath: source.agents,
            targetPath: target.agents,
            skillNames,
            agentNames,
            context: 'project',
            dryRun: options.dryRun,
            verbose: options.verbose,
        });
        agentSpinner.succeed(`${agentCount} agents → ${target.agents}`);
    } catch (error) {
        agentSpinner.fail('Failed to convert agents');
        if (options.verbose) console.error(error);
    }

    // Generate workflows (brainstorm, plan, cook) - REMOVED
    // We no longer generate workflows for brainstorm/plan/cook as skills can be called directly
    let skippedSkills: string[] = [];

    // Generate hook-based rules
    const hookRulesSpinner = ora('Generating hook-based rules...').start();
    try {
        const hookRulesCount = await generateHookRules({
            targetPath: target.rules,
            dryRun: options.dryRun,
            verbose: options.verbose,
        });
        hookRulesSpinner.succeed(`${hookRulesCount} hook rules → ${target.rules}`);
    } catch (error) {
        hookRulesSpinner.fail('Failed to generate hook rules');
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

    // Add workflow chain and conversion notes to GEMINI.md
    geminiMdSections.push(generateConversionLossNotice());

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
    console.log(`  Agents:    ${target.agents} (agent-*)`);
    console.log(`  Skills:    ${target.skills} (skill-*)`);

    // Display skipped skills info
    if (skippedSkills.length > 0 && options.verbose) {
        console.log('');
        console.log(chalk.gray(`ℹ Skipped missing workflow sources`));
    }

    // Display hook-rules activation guidance
    logHookRulesGuidance();
}
