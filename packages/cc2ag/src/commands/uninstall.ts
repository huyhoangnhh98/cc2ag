import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

interface UninstallOptions {
    dryRun?: boolean;
    verbose?: boolean;
    global?: boolean;
    project?: boolean;
}

export async function uninstall(options: UninstallOptions): Promise<void> {
    const spinner = ora('Preparing uninstall...').start();

    // Default: uninstall both if neither specified
    const uninstallGlobal = options.global || (!options.global && !options.project);
    const uninstallProject = options.project || (!options.global && !options.project);

    let removedCount = 0;

    try {
        // Uninstall global
        if (uninstallGlobal) {
            spinner.text = 'Removing global Antigravity files...';
            const globalPaths = [
                path.join(os.homedir(), '.gemini', 'antigravity', 'global_workflows'),
                path.join(os.homedir(), '.gemini', 'antigravity', 'global_rules'),
                path.join(os.homedir(), '.gemini', 'antigravity', 'skills'),
            ];

            for (const dirPath of globalPaths) {
                if (await fs.pathExists(dirPath)) {
                    const items = await fs.readdir(dirPath);

                    for (const item of items) {
                        const itemPath = path.join(dirPath, item);

                        if (options.dryRun) {
                            if (options.verbose) {
                                console.log(chalk.gray(`  [DRY-RUN] Would remove: ${itemPath}`));
                            }
                        } else {
                            await fs.remove(itemPath);
                            if (options.verbose) {
                                console.log(chalk.red(`  ✗ Removed: ${itemPath}`));
                            }
                        }
                        removedCount++;
                    }
                }
            }

            if (!options.dryRun) {
                console.log(chalk.green(`\n✓ Removed global workflows, rules, and skills`));
            }
        }

        // Uninstall project
        if (uninstallProject) {
            spinner.text = 'Removing project .agent files...';
            const projectAgentPath = path.join(process.cwd(), '.agent');

            if (await fs.pathExists(projectAgentPath)) {
                const agentDirs = ['workflows', 'skills'];

                for (const dir of agentDirs) {
                    const dirPath = path.join(projectAgentPath, dir);
                    if (await fs.pathExists(dirPath)) {
                        const items = await fs.readdir(dirPath);

                        for (const item of items) {
                            const itemPath = path.join(dirPath, item);

                            if (options.dryRun) {
                                if (options.verbose) {
                                    console.log(chalk.gray(`  [DRY-RUN] Would remove: ${itemPath}`));
                                }
                            } else {
                                await fs.remove(itemPath);
                                if (options.verbose) {
                                    console.log(chalk.red(`  ✗ Removed: ${itemPath}`));
                                }
                            }
                            removedCount++;
                        }
                    }
                }

                if (!options.dryRun) {
                    console.log(chalk.green(`✓ Removed project .agent workflows and skills`));
                }
            } else {
                console.log(chalk.yellow('⚠ No .agent directory found in current project'));
            }
        }

        spinner.stop();

        console.log('');
        if (options.dryRun) {
            console.log(chalk.cyan(`[DRY-RUN] Would remove ${removedCount} items`));
            console.log(chalk.gray('Run without --dry-run to actually remove files'));
        } else {
            console.log(chalk.green(`✓ Successfully removed ${removedCount} items`));
        }

    } catch (error) {
        spinner.fail('Uninstall failed');
        console.error(chalk.red(`Error: ${error}`));
        process.exit(1);
    }
}
