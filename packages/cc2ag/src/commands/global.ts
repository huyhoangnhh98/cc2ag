import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { ConvertOptions } from '../types.js';
import { getGlobalSource, getGlobalTarget } from '../utils/paths.js';
import { exists, listDirs, listFiles, ensureDir, removeDir, writeFile } from '../utils/fs.js';
import { confirm } from '../utils/prompt.js';
import { generateThinWorkflows } from '../converters/workflow.js';
import { convertAllRules, getClaudeMdContent, getRulesMergedContent, writeGeminiMd } from '../converters/rules.js';
import { convertAllSkills, convertAllAgents as convertAllClaudeKitSkills } from '../converters/skill.js';
import { convertAllAgents as convertAllClaudeKitSubAgents } from '../converters/subagent.js';
import { convertAllAgentsToNative } from '../converters/native-agent.js';
import { ensureExtensionInstalled } from '../utils/extension-installer.js';
import { createRoutingFromAgents } from '../generators/routing.js';

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

    // Generate thin workflow wrappers from user-invocable skills
    const workflowSpinner = ora('Generating workflows...').start();
    let skippedSkills: string[] = [];
    try {
        await ensureDir(globalTarget.workflows);
        const workflowResult = await generateThinWorkflows({
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

    // Handle extension installation (only if NOT using native)
    if (options.native) {
        console.log(chalk.cyan('ℹ Native Agent Manager mode - skipping SubAgents extension'));
    } else if (options.installExtension) {
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

    // Convert agents based on --native flag
    if (options.native) {
        // Convert to Native Agent Manager format
        const nativeAgentSpinner = ora('Converting agents to Native Agent Manager format...').start();
        try {
            const nativeAgentTarget = path.join(process.env.HOME || '~', '.gemini', 'agent_manager', 'agents');
            const nativeAgentCount = await convertAllAgentsToNative({
                sourcePath: source.agents,
                targetPath: nativeAgentTarget,
                agentNames,
                dryRun: options.dryRun,
                verbose: options.verbose,
            });
            nativeAgentSpinner.succeed(`${nativeAgentCount} agents → ${nativeAgentTarget} (Native Agent Manager)`);
        } catch (error) {
            nativeAgentSpinner.fail('Failed to convert agents to Native Agent Manager');
            if (options.verbose) console.error(error);
        }

        // Generate Native Agent Manager routing rules (separate file)
        const nativeRoutingSpinner = ora('Generating Native Agent Manager routing rules...').start();
        try {
            const geminiTarget = path.join(process.env.HOME || '~', '.gemini');
            const routingContent = `# Native Agent Manager Routing Rules
# Auto-generated by cc2ag

## Agent Triggers

${agentNames.map(name => `- ${name}: triggers on "${name.toLowerCase()}", "run ${name.toLowerCase()}"`).join('\n')}

## Context Passing Pattern

Use @file references to pass context between sessions:
- \`/plan @plans/reports/brainstorm-*.md\`
- \`/cook @plans/{date}-{slug}/\`

## Workflow

1. /brainstorm → plans/reports/brainstorm-*.md
2. /plan @brainstorm-report → plans/{slug}/phases/
3. /cook @plan-folder → Implementation
`;
            if (!options.dryRun) {
                await ensureDir(geminiTarget);
                await writeFile(path.join(geminiTarget, 'AGENT_MANAGER.md'), routingContent);
            }
            nativeRoutingSpinner.succeed(`Routing rules → ${geminiTarget}/AGENT_MANAGER.md`);
        } catch (error) {
            nativeRoutingSpinner.fail('Failed to generate routing rules');
            if (options.verbose) console.error(error);
        }
    } else {
        // Convert to SubAgent format (existing behavior)
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

        // Generate routing rules for SubAgents (collected into GEMINI.md)
        const routingSpinner = ora('Generating routing rules for SubAgents...').start();
        try {
            const routingContent = await createRoutingFromAgents(
                path.join(process.env.HOME || '~', '.subagents'),
                path.join(process.env.HOME || '~', '.gemini'),
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
    }

    // Write final assembled GEMINI.md (CLAUDE.md + rules + routing)
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

    if (options.native) {
        console.log(`  Agents:    ~/.gemini/agent_manager/agents/ (Native Agent Manager)`);
        console.log(`  Routing:   ~/.gemini/AGENT_MANAGER.md (workflow guide)`);
        console.log('');
        console.log(chalk.cyan('Native Agent Manager Workflow:'));
        console.log('  1. /brainstorm → plans/reports/brainstorm-*.md');
        console.log('  2. /plan @brainstorm-report → plans/{slug}/phases/');
        console.log('  3. /cook @plan-folder → Implementation');
    } else {
        console.log(`  SubAgents: ~/.subagents/ (SubAgent configs)`);
        console.log(`  Routing:   ~/.gemini/GEMINI.md (auto-routing rules)`);
        if (options.installExtension) {
            console.log(`  Extension: Antigravity SubAgents (installed)`);
        } else {
            console.log(`  Extension: Antigravity SubAgents (not installed - run with --install-extension)`);
        }
    }

    // Display skipped skills info
    if (skippedSkills.length > 0 && options.verbose) {
        console.log('');
        console.log(chalk.gray(`ℹ Skipped ${skippedSkills.length} non-user-invocable skills`));
    }
}
