import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { ConvertOptions } from '../types.js';
import { getGlobalSource, getGlobalTarget } from '../utils/paths.js';
import { exists, listDirs, listFiles, ensureDir, removeDir, writeFile } from '../utils/fs.js';
import { confirm } from '../utils/prompt.js';
import { generateWorkflows } from '../converters/workflow.js';
import { convertAllRules, getClaudeMdContent, getRulesMergedContent, writeGeminiMd } from '../converters/rules.js';
import { convertAllSkills, convertAllAgents as convertAllClaudeKitSkills } from '../converters/skill.js';

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
        await removeDir(globalTarget.rules);
        cleanSpinner.succeed('Cleaned global_workflows, skills, and rules');
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

    // Generate workflows (brainstorm, plan, cook)
    const workflowSpinner = ora('Generating workflows...').start();
    let skippedSkills: string[] = [];
    try {
        await ensureDir(globalTarget.workflows);
        const workflowResult = await generateWorkflows({
            skillsPath: source.skills,
            targetPath: globalTarget.workflows,
            skillNames,
            agentNames,
            context: 'global',
            dryRun: options.dryRun,
            verbose: options.verbose,
        });
        workflowSpinner.succeed(`${workflowResult.count} workflows → ${globalTarget.workflows}`);
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
    console.log(`  Workflows: ${globalTarget.workflows}`);
    console.log(`  Skills:    ${skillTargetPath} (skill-*, agent-*)`);

    // Display skipped skills info
    if (skippedSkills.length > 0 && options.verbose) {
        console.log('');
        console.log(chalk.gray(`ℹ Skipped missing workflow sources`));
    }
}
