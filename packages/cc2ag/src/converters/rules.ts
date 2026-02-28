import path from 'path';
import chalk from 'chalk';
import { readFile, writeFile, listFiles, ensureDir, exists } from '../utils/fs.js';
import { updateReferences } from './references.js';
import { RulesConvertOptions } from '../types.js';

/**
 * Convert all CK workflow files to AG rules directory.
 * Simple copy with reference updates (no frontmatter manipulation).
 */
export async function convertAllRules(options: RulesConvertOptions): Promise<number> {
    const { sourcePath, targetPath, skillNames, agentNames, context, dryRun, verbose } = options;

    await ensureDir(targetPath);

    const workflowFiles = await listFiles(sourcePath, '.md');
    let count = 0;

    for (const file of workflowFiles) {
        const sourceFile = path.join(sourcePath, file);
        let content = await readFile(sourceFile);

        // Update references (paths, skill/agent names)
        content = updateReferences(content, skillNames, agentNames, context);

        const targetFile = path.join(targetPath, file);

        if (!dryRun) {
            await writeFile(targetFile, content);
        }

        count++;

        if (verbose) {
            console.log(`  ${chalk.green('✓')} ${file} → rules/${file}`);
        }
    }

    return count;
}

/**
 * Read all rule files and return merged content for embedding in GEMINI.md.
 * Each rule file becomes a section with a header.
 */
export async function getRulesMergedContent(options: RulesConvertOptions): Promise<string> {
    const { sourcePath, skillNames, agentNames, context } = options;

    const workflowFiles = await listFiles(sourcePath, '.md');
    if (workflowFiles.length === 0) return '';

    const sections: string[] = [];

    for (const file of workflowFiles) {
        const sourceFile = path.join(sourcePath, file);
        let content = await readFile(sourceFile);
        content = updateReferences(content, skillNames, agentNames, context);

        const name = path.basename(file, '.md');
        sections.push(`## ${name}\n\n${content.trim()}`);
    }

    return `\n# Rules\n\n${sections.join('\n\n---\n\n')}\n`;
}

/**
 * Convert CLAUDE.md → GEMINI.md with reference updates.
 * Returns converted content string, or empty string if source not found.
 */
export async function getClaudeMdContent(
    sourcePath: string,
    skillNames: string[],
    agentNames: string[],
    context: 'global' | 'project',
): Promise<string> {
    if (!(await exists(sourcePath))) {
        return '';
    }

    let content = await readFile(sourcePath);

    // Update references (paths, skill/agent names)
    content = updateReferences(content, skillNames, agentNames, context);

    // Replace CLAUDE.md self-references with GEMINI.md
    content = content.replaceAll('CLAUDE.md', 'GEMINI.md');

    // Replace .claude/ directory refs with appropriate targets
    if (context === 'global') {
        content = content.replaceAll('$HOME/.claude/', '$HOME/.gemini/antigravity/');
        content = content.replaceAll('~/.claude/', '~/.gemini/antigravity/');
        content = content.replaceAll('.claude/', '.gemini/antigravity/');
    } else {
        content = content.replaceAll('.claude/', '.agent/');
    }

    return content;
}

/**
 * Write the final assembled GEMINI.md content.
 * Combines: CLAUDE.md content + rules + any additional sections.
 */
export async function writeGeminiMd(
    targetPath: string,
    sections: string[],
    dryRun?: boolean
): Promise<boolean> {
    const content = sections.filter(s => s.trim()).join('\n\n---\n\n');
    if (!content.trim()) return false;

    if (!dryRun) {
        await ensureDir(path.dirname(targetPath));
        await writeFile(targetPath, content);
    }

    return true;
}
