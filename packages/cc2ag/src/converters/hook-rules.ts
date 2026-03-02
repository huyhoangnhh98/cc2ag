import path from 'path';
import chalk from 'chalk';
import { writeFile, ensureDir } from '../utils/fs.js';

interface HookRule {
    filename: string;
    sourceHook: string;
    activationMode: 'always_on' | 'model_decision' | 'glob' | 'manual';
    activationDescription?: string;
    content: string;
}

export interface HookRulesOptions {
    targetPath: string;
    dryRun?: boolean;
    verbose?: boolean;
}

const HOOK_RULES: HookRule[] = [
    {
        filename: 'security-guardrails.md',
        sourceHook: 'privacy-block.cjs',
        activationMode: 'always_on',
        content: `# Security Guardrails

Never read sensitive files without explicit user permission:
- .env, .env.*, .env.local
- credentials.json, secrets.*, *-credentials.*
- Private keys (*.pem, *.key, id_rsa*)
- Config files with API keys or tokens

If you need to access a potentially sensitive file, ask the user first.
Do NOT commit sensitive files to git.`,
    },
    {
        filename: 'naming-conventions.md',
        sourceHook: 'descriptive-name.cjs',
        activationMode: 'model_decision',
        activationDescription: 'Apply when creating or renaming files',
        content: `# File Naming Conventions

When creating files:
- Skip this guidance for markdown or plain text files
- Prefer kebab-case for JS/TS/Python/shell (.js, .ts, .py, .sh) with descriptive names
- Respect language conventions: C#/Java/Kotlin/Swift use PascalCase, Go/Rust use snake_case
- Other languages: follow their ecosystem's standard naming convention
- Goal: self-documenting names readable by LLM tools (Grep, Glob, Search)`,
    },
    {
        filename: 'code-quality-workflow.md',
        sourceHook: 'post-edit-simplify-reminder.cjs',
        activationMode: 'model_decision',
        activationDescription: 'Apply after multiple file edits in a session',
        content: `# Code Quality Workflow

After making significant code changes (5+ file edits):
1. Review modified files for simplification opportunities
2. Check for DRY violations (duplicated code)
3. Ensure YAGNI compliance (no unnecessary abstractions)
4. Verify KISS (simplest solution that works)
5. Consider running code review before committing`,
    },
];

/**
 * Generate AG rule files from CK hook logic.
 * Returns number of rules generated.
 */
export async function generateHookRules(options: HookRulesOptions): Promise<number> {
    const { targetPath, dryRun, verbose } = options;

    await ensureDir(targetPath);

    let count = 0;

    for (const rule of HOOK_RULES) {
        const activationLine = rule.activationDescription
            ? `activation: ${rule.activationMode} — ${rule.activationDescription}`
            : `activation: ${rule.activationMode}`;

        const fileContent = `---
description: "${rule.content.split('\n')[0].replace('# ', '')}"
${activationLine}
source: "Converted from CK hook: ${rule.sourceHook}"
---

${rule.content}
`;

        const targetFile = path.join(targetPath, rule.filename);

        if (!dryRun) {
            await writeFile(targetFile, fileContent);
        }

        count++;

        if (verbose) {
            console.log(`  ${chalk.green('✓')} ${chalk.cyan('[hook-rule]')} ${rule.sourceHook} → ${rule.filename} (${rule.activationMode})`);
        }
    }

    return count;
}

/**
 * Log post-conversion guidance for hook-based rules.
 */
export function logHookRulesGuidance(): void {
    console.log('');
    console.log(chalk.yellow('⚠ Hook-based rules require manual activation in AG:'));
    for (const rule of HOOK_RULES) {
        const modeLabel = rule.activationMode.replace('_', ' ');
        console.log(`  - ${rule.filename} → Set to "${capitalize(modeLabel)}"`);
    }
}

function capitalize(s: string): string {
    return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
