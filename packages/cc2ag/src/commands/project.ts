import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { ConvertOptions } from '../types.js';
import { getProjectSource, getProjectTarget } from '../utils/paths.js';
import { exists, listDirs, listFiles, ensureDir, removeDir } from '../utils/fs.js';
import { confirm } from '../utils/prompt.js';
import { generateThinWorkflows } from '../converters/workflow.js';
import { convertAllRules, getClaudeMdContent, writeGeminiMd } from '../converters/rules.js';
import { convertAllSkills, convertAllAgents as convertAllClaudeKitSkills } from '../converters/skill.js';
import { convertAllAgents as convertAllClaudeKitSubAgents } from '../converters/subagent.js';
import { ensureExtensionInstalled } from '../utils/extension-installer.js';
import { createRoutingFromAgents } from '../generators/routing.js';

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

    // Generate thin workflow wrappers from user-invocable skills
    const workflowSpinner = ora('Generating workflows...').start();
    let skippedSkills: string[] = [];
    try {
        await ensureDir(target.workflows);
        const workflowResult = await generateThinWorkflows({
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
        const subagentsTarget = path.join(process.cwd(), '.subagents');
        const subagentCount = await convertAllClaudeKitSubAgents({
            sourcePath: source.agents,
            targetPath: subagentsTarget,
            context: 'project',
            dryRun: options.dryRun,
            verbose: options.verbose,
        });
        subagentSpinner.succeed(`${subagentCount} agents → ${subagentsTarget} (SubAgents)`);
    } catch (error) {
        subagentSpinner.fail('Failed to convert agents to SubAgents');
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

    // Generate routing rules (collected into GEMINI.md)
    const routingSpinner = ora('Generating routing rules for SubAgents...').start();
    try {
        const routingContent = await createRoutingFromAgents(
            path.join(process.cwd(), '.subagents'),
            path.join(process.cwd(), '.agent'),
            { dryRun: options.dryRun, verbose: options.verbose }
        );
        if (routingContent) {
            geminiMdSections.push(routingContent);
        }
        routingSpinner.succeed('Routing rules collected');
    } catch (error) {
        routingSpinner.fail('Failed to generate routing rules');
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
    console.log(`  SubAgents: .subagents/ (SubAgent configs)`);
    console.log(`  Routing:   .agent/GEMINI.md (auto-routing rules)`);
    if (options.installExtension) {
        console.log(`  Extension: Antigravity SubAgents (installed)`);
    } else {
        console.log(`  Extension: Antigravity SubAgents (not installed - run with --install-extension)`);
    }

    // Display skipped skills info
    if (skippedSkills.length > 0 && options.verbose) {
        console.log('');
        console.log(chalk.gray(`ℹ Skipped ${skippedSkills.length} non-user-invocable skills`));
    }
}
