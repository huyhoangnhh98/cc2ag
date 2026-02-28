import { Command } from 'commander';
import chalk from 'chalk';
import {
    listSubAgents,
    enableSubAgent,
    disableSubAgent,
    configureSubAgent,
    getSubAgentStatus,
    getConfigPath
} from '../../utils/subagent-config.js';
import { FALLBACK_STRATEGIES, FallbackConfig } from '../../types/subagent.js';
import { detectCLIs, generateSetupGuide, getInstallationSummary } from '../../utils/cli-detector.js';

export function createSubAgentsCommand(): Command {
    const subAgentsCmd = new Command('subagents');
    subAgentsCmd.description('Manage subagents configuration (enable/disable/configure)');

    // List command
    subAgentsCmd
        .command('list')
        .description('List all subagents with their status')
        .action(async () => {
            console.log(chalk.cyan('\n╔════════════════════════════════════════════════════════════╗'));
            console.log(chalk.cyan('║              SubAgents Configuration                        ║'));
            console.log(chalk.cyan('╚════════════════════════════════════════════════════════════╝\n'));

            const agents = await listSubAgents();

            if (agents.length === 0) {
                console.log(chalk.yellow('No subagents configured. Run /cook or /plan to initialize.'));
                return;
            }

            console.log(chalk.bold('Agent Name         | Status  | Vendor | Fallback'));
            console.log(chalk.gray('─'.repeat(60)));

            for (const agent of agents) {
                const status = agent.enabled ? chalk.green('enabled') : chalk.red('disabled');
                const vendor = agent.vendor.padEnd(6);
                const fallback = agent.fallback || chalk.gray('none');
                console.log(`${agent.name.padEnd(18)} | ${status} | ${vendor} | ${fallback}`);
            }

            console.log('');
            console.log(chalk.gray(`Config file: ${getConfigPath()}`));
            console.log('');
        });

    // Status command
    subAgentsCmd
        .command('status <agent>')
        .description('Get status of a specific subagent')
        .action(async (agent: string) => {
            const status = await getSubAgentStatus(agent);

            if (!status) {
                console.log(chalk.red(`✗ Subagent '${agent}' not found`));
                process.exit(1);
            }

            const enabled = status.enabled ? 'enabled' : `disabled:fallback:${status.fallback || 'none'}`;
            console.log(enabled);
        });

    // Enable command
    subAgentsCmd
        .command('enable <agent>')
        .description('Enable a subagent')
        .option('--vendor <vendor>', 'Set vendor (claude or codex)')
        .action(async (agent: string, options: { vendor?: 'claude' | 'codex' }) => {
            if (!FALLBACK_STRATEGIES[agent] && agent !== 'web-searcher') {
                console.log(chalk.yellow(`⚠ Unknown subagent '${agent}'. Available agents:`));
                console.log(Object.keys(FALLBACK_STRATEGIES).map(a => `  - ${a}`).join('\n'));
                console.log('  - web-searcher');
                console.log('');
                console.log(chalk.yellow('Continuing anyway...'));
            }

            const success = await enableSubAgent(agent, options.vendor);
            if (success) {
                console.log(chalk.green(`✓ Enabled subagent '${agent}'`));
                if (options.vendor) {
                    console.log(chalk.gray(`  Vendor: ${options.vendor}`));
                }
            }
        });

    // Disable command
    subAgentsCmd
        .command('disable <agent>')
        .description('Disable a subagent')
        .action(async (agent: string) => {
            const fallback = FALLBACK_STRATEGIES[agent]?.fallbackType;

            const success = await disableSubAgent(agent);
            if (success) {
                console.log(chalk.green(`✓ Disabled subagent '${agent}'`));
                if (fallback) {
                    console.log(chalk.gray(`  Fallback: ${fallback}`));
                    console.log(chalk.gray(`  Workflows will use ${fallback} when this agent is disabled`));
                }
            } else {
                console.log(chalk.red(`✗ Subagent '${agent}' not found`));
                process.exit(1);
            }
        });

    // Configure command
    subAgentsCmd
        .command('configure <agent>')
        .description('Configure a subagent (vendor, fallback)')
        .option('--vendor <vendor>', 'Set vendor (claude or codex)')
        .option('--fallback <fallback>', 'Set fallback strategy')
        .action(async (agent: string, options: { vendor?: 'claude' | 'codex'; fallback?: string }) => {
            if (!options.vendor && !options.fallback) {
                console.log(chalk.yellow('Usage: cc2ag subagents configure <agent> --vendor <vendor> | --fallback <fallback>'));
                return;
            }

            const success = await configureSubAgent(agent, options);
            if (success) {
                console.log(chalk.green(`✓ Configured subagent '${agent}'`));
                if (options.vendor) {
                    console.log(chalk.gray(`  Vendor: ${options.vendor}`));
                }
                if (options.fallback) {
                    console.log(chalk.gray(`  Fallback: ${options.fallback}`));
                }
            } else {
                console.log(chalk.red(`✗ Subagent '${agent}' not found`));
                process.exit(1);
            }
        });

    // Fallbacks command - show available fallback strategies
    subAgentsCmd
        .command('fallbacks')
        .description('List available fallback strategies')
        .action(() => {
            console.log(chalk.cyan('\n╔════════════════════════════════════════════════════════════╗'));
            console.log(chalk.cyan('║              Fallback Strategies                            ║'));
            console.log(chalk.cyan('╚════════════════════════════════════════════════════════════╝\n'));

            console.log(chalk.bold('Agent              | Fallback Type    | Commands'));
            console.log(chalk.gray('─'.repeat(70)));

            for (const [agent, config] of Object.entries(FALLBACK_STRATEGIES) as Array<[string, FallbackConfig]>) {
                const fallbackType = config.fallbackType.padEnd(16);
                const commands = config.commands.slice(0, 2).join(', ');
                console.log(`${agent.padEnd(18)} | ${fallbackType} | ${commands}`);
            }

            console.log('');
        });

    // Setup guide command - detect CLIs and show recommendations
    subAgentsCmd
        .command('setup-guide')
        .description('Detect installed CLIs and show setup recommendations')
        .action(async () => {
            const detection = await detectCLIs();
            console.log(generateSetupGuide(detection));
        });

    // Enable all command
    subAgentsCmd
        .command('enable-all')
        .description('Enable all subagents')
        .option('--vendor <vendor>', 'Set vendor for all (claude or codex)', 'claude')
        .action(async (options: { vendor: 'claude' | 'codex' }) => {
            const agents = Object.keys(FALLBACK_STRATEGIES);
            let successCount = 0;

            for (const agent of agents) {
                const success = await enableSubAgent(agent, options.vendor);
                if (success) successCount++;
            }

            console.log(chalk.green(`✓ Enabled ${successCount}/${agents.length} subagents`));
            console.log(chalk.gray(`  Vendor: ${options.vendor}`));
            console.log('');
            console.log('Tip: Run individual commands to customize fallbacks:');
            console.log('  cc2ag subagents configure tester --fallback pytest');
        });

    // Disable all command
    subAgentsCmd
        .command('disable-all')
        .description('Disable all subagents (use native commands)')
        .action(async () => {
            const agents = Object.keys(FALLBACK_STRATEGIES);
            let successCount = 0;

            for (const agent of agents) {
                const success = await disableSubAgent(agent);
                if (success) successCount++;
            }

            console.log(chalk.green(`✓ Disabled ${successCount}/${agents.length} subagents`));
            console.log('');
            console.log(chalk.yellow('All workflows will now use native commands:'));
            console.log('  - Tests: npm test, pytest, etc.');
            console.log('  - Review: Manual checklist');
            console.log('  - Docs: Manual updates');
            console.log('  - Git: Direct git commands');
            console.log('');
            console.log('To re-enable subagents:');
            console.log('  cc2ag subagents enable-all --vendor claude');
        });

    // Quick status command - one line summary
    subAgentsCmd
        .command('summary')
        .alias('status-summary')
        .description('Quick status summary')
        .action(async () => {
            const detection = await detectCLIs();
            const agents = await listSubAgents();
            const enabledCount = agents.filter(a => a.enabled).length;
            const totalCount = agents.length;

            console.log('');
            console.log(chalk.bold('Installation Status:'), getInstallationSummary(detection));
            console.log(chalk.bold('SubAgents:'), `${enabledCount}/${totalCount} enabled`);
            console.log('');

            if (enabledCount === 0) {
                console.log(chalk.yellow('Hint: All subagents disabled. Workflows use native commands.'));
                console.log('      Run: cc2ag subagents enable-all --vendor claude');
            } else if (enabledCount === totalCount) {
                console.log(chalk.green('✓ All subagents enabled!'));
            } else {
                console.log(chalk.gray(`Tip: Run 'cc2ag subagents list' for details`));
            }
            console.log('');
        });

    return subAgentsCmd;
}
