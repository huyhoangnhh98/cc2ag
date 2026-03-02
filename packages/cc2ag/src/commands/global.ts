import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { ConvertOptions } from '../types.js';
import { getGlobalSource, getGlobalTarget } from '../utils/paths.js';
import { exists, listDirs, listFiles, ensureDir, removeDir } from '../utils/fs.js';
import { confirm } from '../utils/prompt.js';
import { convertAllRules, getClaudeMdContent, getRulesMergedContent, writeGeminiMd, generateConversionLossNotice, generateSkillLoggingSection } from '../converters/rules.js';
import { convertAllSkills, convertAllAgents as convertAllClaudeKitAgents } from '../converters/skill.js';
import { generateHookRules, logHookRulesGuidance } from '../converters/hook-rules.js';

export async function convertGlobal(options: ConvertOptions): Promise<void> {
    const source = getGlobalSource();
    const globalTarget = getGlobalTarget();

    // Global source always outputs to global target
    const skillContext: 'global' | 'project' = 'global';
    const skillTargetPath = globalTarget.skills;

    // Check source exists
    const sourceExists = await exists(path.dirname(source.workflows));
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
        console.log(chalk.yellow(`  Target: ${globalTarget.rules}`));
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
        await removeDir(globalTarget.agents);
        await removeDir(globalTarget.rules);
        cleanSpinner.succeed('Cleaned global_workflows, skills, agents, and rules');
    }

    // Collect skill and agent names for reference updates
    const spinner = ora('Scanning sources...').start();

    const skillNames = await listDirs(source.skills);
    const agentNames = (await listFiles(source.agents, '.md')).map(f => path.basename(f, '.md'));

    spinner.succeed(`Found ${skillNames.length} skills, ${agentNames.length} agents`);

    // Convert CK workflows → AG rules
    const rulesSpinner = ora('Converting rules...').start();
    try {
        await ensureDir(globalTarget.rules);
        const rulesCount = await convertAllRules({
            sourcePath: source.workflows,
            targetPath: globalTarget.rules,
            skillNames,
            agentNames,
            context: 'global',
            dryRun: options.dryRun,
            verbose: options.verbose,
        });
        rulesSpinner.succeed(`${rulesCount} rules → ${globalTarget.rules}`);
    } catch (error) {
        rulesSpinner.fail('Failed to convert rules');
        if (options.verbose) console.error(error);
    }

    // Convert agents
    const agentSpinner = ora('Converting agents...').start();
    try {
        await ensureDir(globalTarget.agents);
        const agentCount = await convertAllClaudeKitAgents({
            sourcePath: source.agents,
            targetPath: globalTarget.agents,
            skillNames,
            agentNames,
            context: skillContext,
            dryRun: options.dryRun,
            verbose: options.verbose,
        });
        agentSpinner.succeed(`${agentCount} agents → ${globalTarget.agents}`);
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
            targetPath: globalTarget.rules,
            dryRun: options.dryRun,
            verbose: options.verbose,
        });
        hookRulesSpinner.succeed(`${hookRulesCount} hook rules → ${globalTarget.rules}`);
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
            source.claudeMd, skillNames, agentNames, 'global'
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

    // Get merged rules content for GEMINI.md (always loaded)
    const rulesMergeSpinner = ora('Merging rules into GEMINI.md...').start();
    try {
        const rulesContent = await getRulesMergedContent({
            sourcePath: source.workflows,
            targetPath: globalTarget.rules,
            skillNames,
            agentNames,
            context: 'global',
        });
        if (rulesContent) {
            geminiMdSections.push(rulesContent);
            rulesMergeSpinner.succeed('Rules merged into GEMINI.md');
        } else {
            rulesMergeSpinner.info('No rules to merge');
        }
    } catch (error) {
        rulesMergeSpinner.fail('Failed to merge rules');
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

    // Add skill activation logging, conversion notes to GEMINI.md
    geminiMdSections.push(generateSkillLoggingSection());
    geminiMdSections.push(generateConversionLossNotice());

    // Write final assembled GEMINI.md (CLAUDE.md + rules)
    const geminiSpinner = ora('Writing GEMINI.md...').start();
    try {
        const written = await writeGeminiMd(
            globalTarget.geminiMd, geminiMdSections, options.dryRun
        );
        if (written) {
            geminiSpinner.succeed(`GEMINI.md → ${globalTarget.geminiMd}`);
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
    console.log(`  Rules:     ${globalTarget.rules}`);
    console.log(`  Agents:    ${globalTarget.agents} (agent-*)`);
    console.log(`  Skills:    ${skillTargetPath} (skill-*)`);

    // Display skipped skills info
    if (skippedSkills.length > 0 && options.verbose) {
        console.log('');
        console.log(chalk.gray(`ℹ Skipped missing workflow sources`));
    }

    // Display hook-rules activation guidance
    logHookRulesGuidance();
}
