import path from 'path';
import chalk from 'chalk';
import { readFile, writeFile, listDirs, ensureDir, exists } from '../utils/fs.js';

// Antigravity has a 12000 character limit for workflow content
const WORKFLOW_CHAR_LIMIT = 12000;

export interface ThinWorkflowOptions {
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

/**
 * Generate thin workflow wrappers from user-invocable skills.
 * Each wrapper just activates the corresponding skill.
 */
export async function generateThinWorkflows(options: ThinWorkflowOptions): Promise<{
    count: number;
    skippedSkills: string[];
}> {
    const { skillsPath, targetPath, dryRun, verbose } = options;

    await ensureDir(targetPath);

    const skillDirs = await listDirs(skillsPath);
    let count = 0;
    const skippedSkills: string[] = [];

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

            const description = frontmatter.description || `Workflow converted from Claude Code skill: ${skillDir}`;
            const thinContent = `---\ndescription: ${description}\n---\nActivate \`skill-${skillDir}\` skill.\n`;

            const targetFile = path.join(targetPath, `${skillDir}.md`);

            if (!dryRun) {
                await writeFile(targetFile, thinContent);
            }

            count++;

            if (verbose) {
                console.log(`  ${chalk.green('✓')} ${chalk.cyan('[skill]')} ${skillDir} → ${skillDir}.md`);
            }
        } catch (error) {
            if (verbose) {
                console.log(chalk.red(`  ✗ Error reading skill ${skillDir}: ${error}`));
            }
        }
    }

    return { count, skippedSkills };
}
