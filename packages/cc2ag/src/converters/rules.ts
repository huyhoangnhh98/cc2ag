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

/**
 * Generate conversion loss notice for GEMINI.md.
 */
export function generateConversionLossNotice(): string {
    return `
## Conversion Notes

Converted from Claude Code via cc2ag. Some features are not available in Antigravity:
- Dynamic context injection (session env vars) — use static rules instead
- Subagent tool restrictions — AG doesn't restrict tools per agent
- Token/context tracking — no equivalent in AG
- Team coordination — AG Agent Manager is session overview only

## Hook-Based Rules

The following rules were converted from Claude Code hooks and need manual activation:

| Rule File | Recommended Mode | Purpose |
|-----------|-----------------|---------|
| \`security-guardrails.md\` | Always On | Block sensitive file access |
| \`naming-conventions.md\` | Model Decision | Enforce file naming standards |
| \`code-quality-workflow.md\` | Model Decision | Post-edit simplification reminders |

Set activation modes via: Customizations panel → Rules → Edit each rule.
`;
}

/**
 * Generate skill activation logging section for GEMINI.md.
 * Instructs the model to log every skill/agent activation for traceability.
 */
export function generateSkillLoggingSection(): string {
    return `
## Skill Activation Logging

Before activating any skill or sub-agent, you MUST output a one-line log in this exact format:

\`\`\`
[SKILL] Activating: {skill-name} — Reason: {why}
\`\`\`

**Examples:**
\`\`\`
[SKILL] Activating: scout — Reason: Discovering relevant files and code patterns
[SKILL] Activating: sequential-thinking — Reason: Complex multi-step problem requires structured analysis
[SKILL] Activating: agent-planner — Reason: Creating implementation plan for feature request
[SKILL] Activating: docs-seeker — Reason: Looking up latest API docs for external library
[SKILL] Activating: brainstorm — Reason: Exploring architecture options and trade-offs
\`\`\`

This logging is MANDATORY to help users trace which skills are being activated and why. Do not skip this log line under any circumstances.
`;
}
