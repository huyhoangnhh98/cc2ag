import path from 'path';
import { readFile, writeFile, ensureDir, listDirs, listFiles, copyDir, exists } from '../utils/fs.js';
import { updateReferences } from './references.js';

export interface SkillConvertOptions {
    sourcePath: string;
    targetPath: string;
    skillNames: string[];
    agentNames: string[];
    context: 'global' | 'project';
    dryRun?: boolean;
    verbose?: boolean;
}

/**
 * Convert a skill folder to antigravity format with skill- prefix
 */
export async function convertSkillFolder(
    sourceFolder: string,
    targetFolder: string,
    skillNames: string[],
    agentNames: string[],
    options: { context?: 'global' | 'project'; dryRun?: boolean; verbose?: boolean } = {}
): Promise<void> {
    const skillName = path.basename(targetFolder);

    if (!options.dryRun) {
        await ensureDir(targetFolder);
    }

    // Find and convert SKILL.md
    let skillContent = '';
    const skillMdPath = path.join(sourceFolder, 'SKILL.md');
    const skillMdLowerPath = path.join(sourceFolder, 'skill.md');

    if (await exists(skillMdPath)) {
        skillContent = await readFile(skillMdPath);
    } else if (await exists(skillMdLowerPath)) {
        skillContent = await readFile(skillMdLowerPath);
    }

    if (skillContent) {
        // Update references
        skillContent = updateReferences(skillContent, skillNames, agentNames, options.context || 'project');

        // Update name in frontmatter to match folder name
        if (skillContent.trimStart().startsWith('---')) {
            skillContent = skillContent.replace(/^(---[\s\S]*?)(name:\s*).+$/m, `$1$2${skillName}`);
        } else {
            // Add frontmatter with name
            skillContent = `---
name: ${skillName}
description: Skill converted from Claude Code
---

${skillContent}`;
        }

        if (!options.dryRun) {
            await writeFile(path.join(targetFolder, 'SKILL.md'), skillContent);
        }
    }

    // Copy subdirectories
    const subDirs = ['scripts', 'examples', 'resources'];
    for (const subDir of subDirs) {
        const srcDir = path.join(sourceFolder, subDir);
        if (await exists(srcDir)) {
            if (!options.dryRun) {
                await copyDir(srcDir, path.join(targetFolder, subDir));
            }
        }
    }

    // Special case: references → resources
    const referencesDir = path.join(sourceFolder, 'references');
    if (await exists(referencesDir)) {
        if (!options.dryRun) {
            await copyDir(referencesDir, path.join(targetFolder, 'resources'));
        }
    }
}

/**
 * Convert an agent .md file to skill folder format with agent- prefix
 */
export async function convertAgentToSkill(
    sourceFile: string,
    targetFolder: string,
    skillNames: string[],
    agentNames: string[],
    options: { context?: 'global' | 'project'; dryRun?: boolean; verbose?: boolean } = {}
): Promise<void> {
    const agentName = path.basename(targetFolder);

    if (!options.dryRun) {
        await ensureDir(targetFolder);
    }

    let content = await readFile(sourceFile);

    // Update references
    content = updateReferences(content, skillNames, agentNames, options.context || 'project');

    // Update name in frontmatter to match folder name
    if (content.trimStart().startsWith('---')) {
        content = content.replace(/^(---[\s\S]*?)(name:\s*).+$/m, `$1$2${agentName}`);
    } else {
        // Add frontmatter with name
        content = `---
name: ${agentName}
description: Agent converted from Claude Code
---

${content}`;
    }

    if (!options.dryRun) {
        await writeFile(path.join(targetFolder, 'SKILL.md'), content);
    }
}

/**
 * Convert all skills in a directory
 */
export async function convertAllSkills(options: SkillConvertOptions): Promise<number> {
    const { sourcePath, targetPath, skillNames, agentNames, context, dryRun, verbose } = options;

    await ensureDir(targetPath);

    const dirs = await listDirs(sourcePath);
    let count = 0;

    for (const dir of dirs) {
        const sourceFolder = path.join(sourcePath, dir);
        const targetFolder = path.join(targetPath, `skill-${dir}`);

        await convertSkillFolder(sourceFolder, targetFolder, skillNames, agentNames, { context, dryRun, verbose });
        count++;

        if (verbose) {
            console.log(`  ✓ ${dir} → skill-${dir}/`);
        }
    }

    return count;
}

/**
 * Convert all agents in a directory
 */
export async function convertAllAgents(options: SkillConvertOptions): Promise<number> {
    const { sourcePath, targetPath, skillNames, agentNames, context, dryRun, verbose } = options;

    await ensureDir(targetPath);

    const files = await listFiles(sourcePath, '.md');
    let count = 0;

    for (const file of files) {
        const agentName = path.basename(file, '.md');
        const sourceFile = path.join(sourcePath, file);
        const targetFolder = path.join(targetPath, `agent-${agentName}`);

        await convertAgentToSkill(sourceFile, targetFolder, skillNames, agentNames, { context, dryRun, verbose });
        count++;

        if (verbose) {
            console.log(`  ✓ ${file} → agent-${agentName}/SKILL.md`);
        }
    }

    return count;
}
