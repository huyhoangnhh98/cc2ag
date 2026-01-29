import chalk from 'chalk';
import { ConvertOptions } from '../types.js';
import { convertGlobal } from './global.js';
import { convertProject } from './project.js';
import { getGlobalSource, getProjectSource, getGlobalTarget, getProjectTarget } from '../utils/paths.js';
import { exists } from '../utils/fs.js';
import { confirm } from '../utils/prompt.js';
import path from 'path';

export async function convertBoth(options: ConvertOptions): Promise<void> {
    const globalSource = getGlobalSource();
    const projectSource = getProjectSource();

    const hasGlobal = await exists(path.dirname(globalSource.commands));
    const hasProject = await exists(path.dirname(projectSource.commands));

    if (!hasGlobal && !hasProject) {
        console.log(chalk.red('✗ No Claude Code sources found!'));
        console.log(chalk.yellow('  Checked: ~/.claude and ./.claude'));
        return;
    }

    // Handle --fresh flag (clean + convert with confirmation)
    if (options.fresh) {
        const globalTarget = getGlobalTarget();
        const projectTarget = getProjectTarget();

        console.log(chalk.yellow('⚠ WARNING: --fresh will remove all existing converted content.'));
        if (hasGlobal) {
            console.log(chalk.yellow(`  Target: ${globalTarget.workflows}`));
            console.log(chalk.yellow(`  Target: ${globalTarget.skills}`));
        }
        if (hasProject) {
            console.log(chalk.yellow(`  Target: ${projectTarget.workflows}`));
            console.log(chalk.yellow(`  Target: ${projectTarget.skills}`));
        }
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

    // Auto-clean for 'both' command to ensure proper separation
    const cleanOptions = { ...options, clean: true, yes: true }; // Pass yes to skip sub-prompts

    if (hasGlobal) {
        console.log(chalk.blue('[1/2] Converting global source...'));
        await convertGlobal(cleanOptions);
        console.log('');
    } else {
        console.log(chalk.yellow('⚠ Global source not found, skipping...'));
    }

    if (hasProject) {
        console.log(chalk.blue('[2/2] Converting project source...'));
        await convertProject(cleanOptions);
    } else {
        console.log(chalk.yellow('⚠ Project source not found, skipping...'));
    }
}
