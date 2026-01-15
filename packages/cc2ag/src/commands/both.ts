import chalk from 'chalk';
import { ConvertOptions } from '../types.js';
import { convertGlobal } from './global.js';
import { convertProject } from './project.js';
import { getGlobalSource, getProjectSource } from '../utils/paths.js';
import { exists } from '../utils/fs.js';
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

    // Auto-clean for 'both' command to ensure proper separation
    const cleanOptions = { ...options, clean: true };

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
