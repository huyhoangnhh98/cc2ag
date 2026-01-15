import path from 'path';
import chalk from 'chalk';
import { readFile, writeFile, listFiles, ensureDir } from '../utils/fs.js';
import { updateReferences, extractReferences, generateActivationBlock } from './references.js';

// Antigravity has a 12000 character limit for workflow content
const WORKFLOW_CHAR_LIMIT = 12000;

export interface WorkflowConvertOptions {
    sourcePath: string;
    targetPath: string;
    skillNames: string[];
    agentNames: string[];
    context: 'global' | 'project';
    dryRun?: boolean;
    verbose?: boolean;
}

export interface WorkflowConvertResult {
    success: boolean;
    charCount: number;
    exceedsLimit: boolean;
}

/**
 * Convert a single command .md file to workflow .md format
 */
export async function convertWorkflow(
    sourceFile: string,
    targetFile: string,
    skillNames: string[],
    agentNames: string[],
    options: { context?: 'global' | 'project'; dryRun?: boolean; verbose?: boolean } = {}
): Promise<WorkflowConvertResult> {
    let content = await readFile(sourceFile);

    // Update references
    content = updateReferences(content, skillNames, agentNames, options.context || 'project');

    // Extract referenced skills/agents for activation block
    const refs = extractReferences(content);

    // Check if already has activation block
    const hasActivationBlock = content.includes('Activate `') && content.includes('` skill.');

    // Check if has frontmatter
    const hasFrontmatter = content.trimStart().startsWith('---');

    if (hasFrontmatter) {
        // Find end of frontmatter
        const firstDelim = content.indexOf('---');
        const secondDelim = content.indexOf('---', firstDelim + 3);

        if (secondDelim !== -1) {
            const frontmatter = content.substring(0, secondDelim + 3);
            const body = content.substring(secondDelim + 3);

            // Add activation block after frontmatter if not already present
            if (!hasActivationBlock && (refs.skills.length > 0 || refs.agents.length > 0)) {
                const activationBlock = generateActivationBlock(refs.skills, refs.agents);
                content = frontmatter + activationBlock + body;
            }
        }
    } else {
        // Add frontmatter and activation block
        const basename = path.basename(sourceFile, '.md');
        const activationBlock = generateActivationBlock(refs.skills, refs.agents);

        content = `---
description: Workflow converted from Claude Code command
---
${activationBlock}
${content}`;
    }

    const charCount = content.length;
    const exceedsLimit = charCount > WORKFLOW_CHAR_LIMIT;

    if (!options.dryRun) {
        await writeFile(targetFile, content);
    }

    return { success: true, charCount, exceedsLimit };
}

/**
 * Convert all commands in a directory to workflows
 */
export async function convertAllWorkflows(
    options: WorkflowConvertOptions
): Promise<{ count: number; oversizedFiles: string[] }> {
    const { sourcePath, targetPath, skillNames, agentNames, context, dryRun, verbose } = options;

    await ensureDir(targetPath);

    const files = await listFiles(sourcePath, '.md');
    let count = 0;
    const oversizedFiles: string[] = [];

    for (const file of files) {
        const sourceFile = path.join(sourcePath, file);

        // Handle nested commands (plan/hard.md → plan-hard.md)
        const targetName = file.replace(/\//g, '-');
        const targetFile = path.join(targetPath, targetName);

        const result = await convertWorkflow(sourceFile, targetFile, skillNames, agentNames, { context, dryRun, verbose });
        count++;

        if (result.exceedsLimit) {
            oversizedFiles.push(`${targetName} (${result.charCount} chars)`);
        }

        if (verbose) {
            const sizeWarning = result.exceedsLimit ? chalk.yellow(` ⚠ ${result.charCount}/${WORKFLOW_CHAR_LIMIT}`) : '';
            console.log(`  ✓ ${file} → ${targetName}${sizeWarning}`);
        }
    }

    // Also handle nested directories
    const { listDirs } = await import('../utils/fs.js');
    const dirs = await listDirs(sourcePath);

    for (const dir of dirs) {
        const nestedFiles = await listFiles(path.join(sourcePath, dir), '.md');

        for (const file of nestedFiles) {
            const sourceFile = path.join(sourcePath, dir, file);
            const targetName = `${dir}-${file}`;
            const targetFile = path.join(targetPath, targetName);

            const result = await convertWorkflow(sourceFile, targetFile, skillNames, agentNames, { context, dryRun, verbose });
            count++;

            if (result.exceedsLimit) {
                oversizedFiles.push(`${targetName} (${result.charCount} chars)`);
            }

            if (verbose) {
                const sizeWarning = result.exceedsLimit ? chalk.yellow(` ⚠ ${result.charCount}/${WORKFLOW_CHAR_LIMIT}`) : '';
                console.log(`  ✓ ${dir}/${file} → ${targetName}${sizeWarning}`);
            }
        }
    }

    return { count, oversizedFiles };
}
