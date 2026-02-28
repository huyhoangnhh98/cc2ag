import path from 'path';
import chalk from 'chalk';
import { readFile, writeFile, ensureDir, exists } from '../utils/fs.js';
import { updateReferences } from './references.js';

export interface WorkflowOptions {
    skillsPath: string;    // source skills/ directory
    targetPath: string;    // target workflows/ directory
    skillNames: string[];
    agentNames: string[];
    context: 'global' | 'project';
    dryRun?: boolean;
    verbose?: boolean;
}

/** Parsed skill frontmatter fields relevant for workflow conversion */
interface SkillFrontmatter {
    name?: string;
    description?: string;
}

/**
 * Parse YAML frontmatter from skill content
 * Returns null if no valid frontmatter found
 */
function parseSkillFrontmatter(content: string): SkillFrontmatter {
    const result: SkillFrontmatter = {};

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
            // Remove surrounding quotes if they exist
            result.description = value.replace(/^["'](.*)["']$/, '$1');
        }
    }

    return result;
}

/**
 * Remove frontmatter from markdown content
 */
function stripFrontmatter(content: string): string {
    if (!content.trimStart().startsWith('---')) return content;

    const firstDelim = content.indexOf('---');
    const secondDelim = content.indexOf('---', firstDelim + 3);
    if (secondDelim === -1) return content;

    return content.substring(secondDelim + 3).trimStart();
}

/**
 * Target workflow names to generate
 */
const TARGET_WORKFLOWS = ['brainstorm', 'plan', 'cook'];

/**
 * Generate specific full workflows (brainstorm, plan, cook).
 * Each wrapper embeds the full logic of the corresponding skill.
 */
export async function generateWorkflows(options: WorkflowOptions): Promise<{
    count: number;
    skippedSkills: string[];
}> {
    const { skillsPath, targetPath, skillNames, agentNames, context, dryRun, verbose } = options;

    await ensureDir(targetPath);

    let count = 0;
    const skippedSkills: string[] = [];

    for (const workflowName of TARGET_WORKFLOWS) {
        // Look for the corresponding skill in the source directory
        const skillDir = workflowName; // We expect skill folder to match workflow name
        const skillMdPath = path.join(skillsPath, skillDir, 'SKILL.md');
        const skillMdLowerPath = path.join(skillsPath, skillDir, 'skill.md');

        let skillMd = '';
        if (await exists(skillMdPath)) {
            skillMd = skillMdPath;
        } else if (await exists(skillMdLowerPath)) {
            skillMd = skillMdLowerPath;
        }

        if (!skillMd) {
            if (verbose) {
                console.log(chalk.gray(`  ○ Skipping workflow ${workflowName} (source skill not found)`));
            }
            skippedSkills.push(workflowName);
            continue;
        }

        try {
            let content = await readFile(skillMd);
            const frontmatter = parseSkillFrontmatter(content);
            const bodyContent = stripFrontmatter(content);

            // Update references in the body content to convert ClaudeKit syntax to Antigravity
            const updatedBodyContent = updateReferences(bodyContent, skillNames, agentNames, context);

            const description = frontmatter.description || `Workflow converted from Claude Code skill: ${skillDir}`;

            // Generate workflow file embedding the full skill logic
            const workflowContent = `---
description: "${description}"
---

${updatedBodyContent}
`;

            // Write to workflow-{name}.md
            const targetFile = path.join(targetPath, `workflow-${workflowName}.md`);

            if (!dryRun) {
                await writeFile(targetFile, workflowContent);
            }

            count++;

            if (verbose) {
                console.log(`  ${chalk.green('✓')} ${chalk.cyan('[workflow]')} ${workflowName} → workflow-${workflowName}.md`);
            }
        } catch (error) {
            if (verbose) {
                console.log(chalk.red(`  ✗ Error generating workflow ${workflowName}: ${error}`));
            }
        }
    }

    return { count, skippedSkills };
}
