import path from 'path';
import { readFile, writeFile, ensureDir, exists } from '../utils/fs.js';
import { loadConfig } from '../utils/subagent-config.js';

export interface WorkflowConvertOptions {
    sourcePath: string;
    targetPath: string;
    dryRun?: boolean;
    verbose?: boolean;
}

/**
 * Script path for subagent status checks
 */
const STATUS_CHECK_SCRIPT = path.join(process.env.HOME || '~', '.cc2ag', 'scripts', 'check-subagent-status.py');

/**
 * Known subagent names
 */
const SUBAGENT_NAMES = [
    'researcher',
    'planner',
    'tester',
    'code-reviewer',
    'docs-manager',
    'git-manager',
    'web-searcher'
];

/**
 * Convert a workflow to include subagent status checks
 */
export async function convertWorkflow(
    sourceFile: string,
    targetDir: string,
    options: { dryRun?: boolean; verbose?: boolean } = {}
): Promise<void> {
    const content = await readFile(sourceFile);
    const workflowName = path.basename(sourceFile, '.md');

    // Detect which subagents are referenced
    const referencedAgents = detectSubagentReferences(content);

    // Generate activation blocks
    const activationBlocks = generateActivationBlocks(referencedAgents);

    // Generate status check snippets
    const statusChecks = generateStatusChecks(referencedAgents);

    // Wrap workflow with subagent integration
    const convertedContent = wrapWorkflow(content, activationBlocks, statusChecks);

    if (!options.dryRun) {
        await ensureDir(targetDir);
        await writeFile(path.join(targetDir, workflowName + '.md'), convertedContent);
    }

    if (options.verbose) {
        console.log(`  ✓ ${workflowName} - converted with ${referencedAgents.length} subagent integrations`);
    }
}

/**
 * Detect subagent references in workflow content
 */
function detectSubagentReferences(content: string): string[] {
    const references: string[] = [];

    // Check for subagent spawn patterns
    const spawnPatterns = [
        /Task\([^)]*subagent_type\s*[:=]\s*["'](\w+)["']/gi,
        /spawn\s+(\w+)\s+subagent/gi,
        /delegate to\s+(\w+)/gi,
        /use\s+(\w+)\s+agent/gi,
        /activate\s+`?agent-(\w+)`?/gi,
        /`?agent-(\w+)`?\s+skill/gi
    ];

    for (const pattern of spawnPatterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
            const agentName = match[1].toLowerCase();
            // Map common variations to standard names
            const standardName = mapToStandardAgent(agentName);
            if (SUBAGENT_NAMES.includes(standardName) && !references.includes(standardName)) {
                references.push(standardName);
            }
        }
    }

    // Also check for explicit subagent mentions in workflow steps
    const stepPatterns = [
        /step.*test/gi,
        /step.*review/gi,
        /step.*document/gi,
        /step.*git/gi,
        /step.*commit/gi
    ];

    // Map workflow steps to subagents
    const stepToAgent: Record<string, string> = {
        'test': 'tester',
        'review': 'code-reviewer',
        'document': 'docs-manager',
        'git': 'git-manager',
        'commit': 'git-manager',
        'research': 'researcher',
        'plan': 'planner',
        'search': 'web-searcher'
    };

    for (const [step, agent] of Object.entries(stepToAgent)) {
        if (content.toLowerCase().includes(step) && !references.includes(agent)) {
            references.push(agent);
        }
    }

    return references;
}

/**
 * Map agent name variations to standard names
 */
function mapToStandardAgent(name: string): string {
    const mapping: Record<string, string> = {
        'researcher': 'researcher',
        'research': 'researcher',
        'planner': 'planner',
        'plan': 'planner',
        'tester': 'tester',
        'test': 'tester',
        'code-reviewer': 'code-reviewer',
        'reviewer': 'code-reviewer',
        'review': 'code-reviewer',
        'docs-manager': 'docs-manager',
        'docs': 'docs-manager',
        'documentation': 'docs-manager',
        'git-manager': 'git-manager',
        'git': 'git-manager',
        'web-searcher': 'web-searcher',
        'searcher': 'web-searcher',
        'search': 'web-searcher',
        'debugger': 'tester',  // Map debugger to tester for fallback
        'project-manager': 'docs-manager',  // Map to docs for finalization
        'ui-ux-designer': 'planner'  // Map to planner for design planning
    };

    return mapping[name.toLowerCase()] || name;
}

/**
 * Generate activation blocks for workflows
 */
function generateActivationBlocks(agents: string[]): string {
    if (agents.length === 0) return '';

    const blocks = agents.map(agent => `Activate \`agent-${agent}\` skill.`).join('\n');

    return `<!-- Skill Activation Block -->
${blocks}

`;
}

/**
 * Generate status check snippets for workflows
 */
function generateStatusChecks(agents: string[]): string {
    if (agents.length === 0) return '';

    const checks = agents.map(agent => {
        return `
<!-- SubAgent Status Check: ${agent} -->
\`!python ${STATUS_CHECK_SCRIPT} check ${agent}\`
If enabled → delegate to ${agent} subagent
Else → use fallback strategy
`;
    }).join('');

    return checks;
}

/**
 * Wrap workflow content with subagent integration
 */
function wrapWorkflow(
    content: string,
    activationBlocks: string,
    statusChecks: string
): string {
    // Check if content has frontmatter
    const hasFrontmatter = content.trimStart().startsWith('---');

    if (hasFrontmatter) {
        // Insert activation block after frontmatter
        const frontmatterEnd = content.indexOf('---', 3);
        const afterFrontmatter = content.indexOf('\n', frontmatterEnd) + 1;

        const before = content.substring(0, afterFrontmatter);
        const after = content.substring(afterFrontmatter);

        return `${before}
${activationBlocks}${statusChecks}
${after}`;
    } else {
        // Prepend activation block
        return `${activationBlocks}${statusChecks}
${content}`;
    }
}

/**
 * Convert all workflows in a directory
 */
export async function convertAllWorkflows(options: WorkflowConvertOptions): Promise<number> {
    const { sourcePath, targetPath, dryRun, verbose } = options;

    // Get all markdown files
    const files: string[] = [];
    const dirExists = await exists(sourcePath);
    if (!dirExists) return 0;

    // Simple file listing (in production use proper glob)
    const dirents = await import('fs').then(fs => fs.promises.readdir(sourcePath, { withFileTypes: true }));
    for (const dirent of dirents) {
        if (dirent.isFile() && dirent.name.endsWith('.md')) {
            files.push(dirent.name);
        }
    }

    let count = 0;
    for (const file of files) {
        const sourceFile = path.join(sourcePath, file);
        await convertWorkflow(sourceFile, targetPath, { dryRun, verbose });
        count++;
    }

    return count;
}
