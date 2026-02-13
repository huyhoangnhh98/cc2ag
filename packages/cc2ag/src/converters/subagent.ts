import path from 'path';
import { readFile, writeFile, ensureDir, listFiles, exists } from '../utils/fs.js';
import { updateReferences } from './references.js';

export interface SubAgentConvertOptions {
    sourcePath: string;
    targetPath: string;
    context: 'global' | 'project';
    dryRun?: boolean;
    verbose?: boolean;
}

export interface SubAgentConfig {
    name: string;
    vendor: 'claude' | 'codex';
    model?: string;
    tools?: string[];
    triggers?: string[];
    description?: string;
}

/**
 * Parse YAML frontmatter from agent content
 */
function parseAgentFrontmatter(content: string): Partial<SubAgentConfig> {
    const result: Partial<SubAgentConfig> = {};

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
            result.name = value.replace(/^['"]|['"]$/g, '');
        } else if (keyTrimmed === 'model') {
            result.model = value.replace(/^['"]|['"]$/g, '');
        } else if (keyTrimmed === 'tools') {
            // Parse tools array: "Glob, Grep, Read, Bash, ..." -> ["Glob", "Grep", ...]
            const toolsStr = value.replace(/^\[|\]$/g, '').trim();
            if (toolsStr.startsWith('"') || toolsStr.startsWith("'")) {
                // Handle quoted tools list
                const toolsMatch = toolsStr.match(/"([^"]+)"|'([^']+)'|([^,]+)/g);
                if (toolsMatch) {
                    result.tools = toolsMatch.map(t => t.trim().replace(/^[ "'"]|[ "'"]$/g, ''));
                }
            } else {
                // Handle comma-separated tools
                result.tools = toolsStr.split(',').map(t => t.trim()).filter(t => t);
            }
        } else if (keyTrimmed === 'description') {
            result.description = value.replace(/^['"]|['"]$/g, '');
        }
    }

    return result;
}

/**
 * Extract potential trigger keywords from agent description/content
 */
function extractTriggers(description: string, name: string): string[] {
    const triggers: string[] = [];

    // Add name-based triggers
    triggers.push(name.toLowerCase());

    // Common trigger patterns based on agent names
    const triggerMap: { [key: string]: string[] } = {
        'researcher': ['research', 'investigate', 'find information', 'explore', 'study'],
        'tester': ['test', 'run tests', 'check tests', 'validate', 'verify'],
        'code-reviewer': ['review', 'check code', 'audit', 'evaluate', 'inspect'],
        'planner': ['plan', 'architect', 'design system', 'organize', 'structure'],
        'docs-manager': ['document', 'update docs', 'sync docs', 'documentation'],
        'git-manager': ['commit', 'push', 'create PR', 'git', 'version control'],
        'debugger': ['debug', 'fix bug', 'troubleshoot', 'investigate issue'],
        'brainstormer': ['brainstorm', 'think', 'analyze', 'ideate'],
        'project-manager': ['track progress', 'manage project', 'update status', 'coordinate'],
        'mcp-manager': ['mcp', 'manage servers', 'discover tools'],
        'ui-ux-designer': ['design', 'ui', 'ux', 'layout', 'interface']
    };

    const lowerName = name.toLowerCase();
    if (triggerMap[lowerName]) {
        triggers.push(...triggerMap[lowerName]);
    }

    // Extract additional triggers from description
    const descLower = description.toLowerCase();
    if (descLower.includes('research') || descLower.includes('investigate')) {
        triggers.push('research', 'investigate');
    }
    if (descLower.includes('test') || descLower.includes('validate')) {
        triggers.push('test', 'validate');
    }
    if (descLower.includes('review') || descLower.includes('check')) {
        triggers.push('review', 'check');
    }

    // Remove duplicates and return
    return [...new Set(triggers)];
}

/**
 * Convert a single ClaudeKit agent to Antigravity SubAgent format
 */
export async function convertAgentToSubAgent(
    sourceFile: string,
    targetDir: string,
    agentNames: string[],
    options: { context?: 'global' | 'project'; dryRun?: boolean; verbose?: boolean } = {}
): Promise<void> {
    const agentName = path.basename(sourceFile, '.md');
    const content = await readFile(sourceFile);

    // Parse frontmatter to get agent configuration
    const frontmatter = parseAgentFrontmatter(content);
    const agentConfig: SubAgentConfig = {
        name: frontmatter.name || agentName,
        vendor: 'claude', // Default to Claude since ClaudeKit agents use Claude
        model: frontmatter.model,
        tools: frontmatter.tools,
        description: frontmatter.description,
        triggers: extractTriggers(frontmatter.description || '', agentName)
    };

    if (!options.dryRun) {
        // Create target directory
        await ensureDir(targetDir);

        // Create instructions.md from the content excluding frontmatter
        const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---\s*/, '');
        const updatedContent = updateReferences(contentWithoutFrontmatter, agentNames, [agentName], options.context || 'project');

        await writeFile(path.join(targetDir, 'instructions.md'), updatedContent);

        // Create config.json
        const config: SubAgentConfig = {
            ...agentConfig,
            triggers: agentConfig.triggers
        };

        await writeFile(path.join(targetDir, 'config.json'), JSON.stringify(config, null, 2));
    }
}

/**
 * Create manifest.json for all subagents
 */
export async function createManifest(
    agentNames: string[],
    targetPath: string,
    options: { dryRun?: boolean; verbose?: boolean } = {}
): Promise<void> {
    const manifest = {
        version: '1.0.0',
        source: 'cc2ag',
        agents: agentNames.map(name => ({
            name,
            path: path.join('~/.subagents', name),
            global: true,
            vendor: 'claude' as const
        }))
    };

    if (!options.dryRun) {
        await ensureDir(targetPath);
        await writeFile(path.join(targetPath, 'manifest.json'), JSON.stringify(manifest, null, 2));
    }
}

/**
 * Convert all agents in a directory to subagent format
 */
export async function convertAllAgents(options: SubAgentConvertOptions): Promise<number> {
    const { sourcePath, targetPath, context, dryRun, verbose } = options;

    // Get all agent files
    const agentFiles = await listFiles(sourcePath, '.md');
    let count = 0;

    for (const file of agentFiles) {
        const agentName = path.basename(file, '.md');
        const sourceFile = path.join(sourcePath, file);
        const targetDir = path.join(targetPath, agentName);

        await convertAgentToSubAgent(sourceFile, targetDir, [agentName], { context, dryRun, verbose });
        count++;

        if (verbose) {
            console.log(`  ✓ ${file} → ${agentName}/ (SubAgent)`);
        }
    }

    // Create manifest after all agents are converted
    const agentNames = agentFiles.map(f => path.basename(f, '.md'));
    await createManifest(agentNames, targetPath, { dryRun, verbose });

    if (verbose) {
        console.log(`  ✓ Created manifest.json for ${agentNames.length} agents`);
    }

    return count;
}