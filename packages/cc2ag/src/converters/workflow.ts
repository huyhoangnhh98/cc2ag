import path from 'path';
import chalk from 'chalk';
import { readFile, writeFile, listFiles, listDirs, ensureDir, exists } from '../utils/fs.js';
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
    skillsPath?: string; // Path to skills/ directory for skill-to-workflow conversion
}

/** Parsed skill frontmatter fields relevant for workflow conversion */
interface SkillFrontmatter {
    name?: string;
    description?: string;
    userInvocable?: boolean; // default true - if false, skip workflow conversion
}

/**
 * Parse YAML frontmatter from skill content
 * Returns null if no valid frontmatter found
 */
function parseSkillFrontmatter(content: string): SkillFrontmatter {
    const result: SkillFrontmatter = { userInvocable: true }; // default

    if (!content.trimStart().startsWith('---')) return result;

    const firstDelim = content.indexOf('---');
    const secondDelim = content.indexOf('---', firstDelim + 3);
    if (secondDelim === -1) return result;

    const frontmatterText = content.substring(firstDelim + 3, secondDelim);

    // Simple YAML parsing for known fields
    const lines = frontmatterText.split('\n');
    for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        if (!key || valueParts.length === 0) continue;

        const value = valueParts.join(':').trim();
        const keyTrimmed = key.trim();

        if (keyTrimmed === 'name') {
            result.name = value;
        } else if (keyTrimmed === 'description') {
            result.description = value;
        } else if (keyTrimmed === 'user-invocable') {
            result.userInvocable = value.toLowerCase() !== 'false';
        }
    }

    return result;
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
 * Convert all commands and user-invocable skills to workflows
 * Skills take priority over commands when names collide
 */
export async function convertAllWorkflows(
    options: WorkflowConvertOptions
): Promise<{ count: number; oversizedFiles: string[]; skippedSkills: string[] }> {
    const { sourcePath, targetPath, skillNames, agentNames, context, dryRun, verbose, skillsPath } = options;

    await ensureDir(targetPath);

    // Track workflow names to handle collisions (skills take priority)
    const workflowSources: Map<string, { source: string; type: 'command' | 'skill' }> = new Map();
    const skippedSkills: string[] = [];

    // 1. Collect commands from commands/ directory
    const commandFiles = await listFiles(sourcePath, '.md');
    for (const file of commandFiles) {
        const name = path.basename(file, '.md');
        workflowSources.set(name, { source: path.join(sourcePath, file), type: 'command' });
    }

    // Also collect nested command directories (plan/hard.md → plan-hard)
    const commandDirs = await listDirs(sourcePath);
    for (const dir of commandDirs) {
        const nestedFiles = await listFiles(path.join(sourcePath, dir), '.md');
        for (const file of nestedFiles) {
            const name = `${dir}-${path.basename(file, '.md')}`;
            workflowSources.set(name, { source: path.join(sourcePath, dir, file), type: 'command' });
        }
    }

    // 2. Collect user-invocable skills from skills/ directory (override commands)
    if (skillsPath) {
        const skillDirs = await listDirs(skillsPath);
        for (const skillDir of skillDirs) {
            const skillMdPath = path.join(skillsPath, skillDir, 'SKILL.md');
            const skillMdLowerPath = path.join(skillsPath, skillDir, 'skill.md');

            let skillMd = '';
            if (await exists(skillMdPath)) {
                skillMd = skillMdPath;
            } else if (await exists(skillMdLowerPath)) {
                skillMd = skillMdLowerPath;
            }

            if (!skillMd) continue;

            try {
                const content = await readFile(skillMd);
                const frontmatter = parseSkillFrontmatter(content);

                // Skip non-user-invocable skills
                if (frontmatter.userInvocable === false) {
                    skippedSkills.push(skillDir);
                    if (verbose) {
                        console.log(chalk.gray(`  ○ Skipping ${skillDir} (user-invocable: false)`));
                    }
                    continue;
                }

                // Check for collision
                const existing = workflowSources.get(skillDir);
                if (existing && existing.type === 'command') {
                    if (verbose) {
                        console.log(chalk.yellow(`  ⚠ Skill "${skillDir}" overrides command`));
                    }
                }

                workflowSources.set(skillDir, { source: skillMd, type: 'skill' });
            } catch (error) {
                if (verbose) {
                    console.log(chalk.red(`  ✗ Error reading skill ${skillDir}: ${error}`));
                }
            }
        }
    }

    // 3. Convert all collected sources to workflows
    let count = 0;
    const oversizedFiles: string[] = [];

    for (const [name, { source, type }] of workflowSources) {
        const targetName = `${name}.md`;
        const targetFile = path.join(targetPath, targetName);

        const result = await convertWorkflow(source, targetFile, skillNames, agentNames, { context, dryRun, verbose });
        count++;

        if (result.exceedsLimit) {
            oversizedFiles.push(`${targetName} (${result.charCount} chars)`);
        }

        if (verbose) {
            const typeLabel = type === 'skill' ? chalk.cyan('[skill]') : chalk.gray('[cmd]');
            const sizeWarning = result.exceedsLimit ? chalk.yellow(` ⚠ ${result.charCount}/${WORKFLOW_CHAR_LIMIT}`) : '';
            console.log(`  ✓ ${typeLabel} ${name} → ${targetName}${sizeWarning}`);
        }
    }

    return { count, oversizedFiles, skippedSkills };
}
