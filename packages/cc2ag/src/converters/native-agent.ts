import path from 'path';
import { readFile, writeFile, ensureDir, listFiles } from '../utils/fs.js';

export interface NativeAgentConfig {
    name: string;
    description: string;
    model: string;
    triggers: string[];
    tools: string[];
    instructions: string;
}

export interface ConvertAllAgentsToNativeOptions {
    sourcePath: string;
    targetPath: string;
    agentNames?: string[];
    dryRun?: boolean;
    verbose?: boolean;
}

/**
 * Extract trigger keywords from agent name and description
 */
function extractTriggers(name: string, description: string): string[] {
    const triggers: string[] = [name.toLowerCase()];

    const triggerMap: { [key: string]: string[] } = {
        'brainstormer': ['brainstorm', 'architecture', 'technical decision', 'design debate'],
        'planner': ['plan', 'create plan', 'implementation plan', 'architecture'],
        'cook': ['cook', 'implement', 'code this', 'build feature'],
        'tester': ['test', 'run tests', 'validate', 'verify'],
        'reviewer': ['review', 'check code', 'audit', 'evaluate'],
        'docs-manager': ['document', 'update docs', 'sync docs', 'documentation'],
        'git-manager': ['commit', 'push', 'git', 'version control'],
        'debugger': ['debug', 'fix bug', 'troubleshoot', 'investigate'],
        'researcher': ['research', 'investigate', 'find information', 'explore']
    };

    const lowerName = name.toLowerCase();
    if (triggerMap[lowerName]) {
        triggers.push(...triggerMap[lowerName]);
    }

    // Extract from description
    const descLower = description.toLowerCase();
    if (descLower.includes('test')) triggers.push('test', 'testing');
    if (descLower.includes('plan')) triggers.push('plan', 'planning');
    if (descLower.includes('review')) triggers.push('review');
    if (descLower.includes('document')) triggers.push('docs', 'documentation');

    return [...new Set(triggers)];
}

/**
 * Parse Markdown agent file to extract content
 */
function parseAgentMarkdown(content: string): { frontmatter: any; body: string } {
    const result = { frontmatter: {} as any, body: content };

    if (!content.trimStart().startsWith('---')) return result;

    const firstDelim = content.indexOf('---');
    const secondDelim = content.indexOf('---', firstDelim + 3);
    if (secondDelim === -1) return result;

    const frontmatterText = content.substring(firstDelim + 3, secondDelim);
    result.body = content.substring(secondDelim + 3).trim();

    // Simple frontmatter parsing
    const lines = frontmatterText.split('\n');
    for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        if (!key || valueParts.length === 0) continue;

        const value = valueParts.join(':').trim();
        const keyTrimmed = key.trim();

        if (keyTrimmed === 'name') {
            result.frontmatter.name = value.replace(/^['"]|['"]$/g, '');
        } else if (keyTrimmed === 'description') {
            result.frontmatter.description = value.replace(/^['"]|['"]$/g, '');
        }
    }

    return result;
}

/**
 * Convert a single ClaudeKit agent to Native Agent Manager format
 */
export async function convertAgentToNativeAgent(
    sourceFile: string,
    targetDir: string,
    agentName: string,
    options: { dryRun?: boolean; verbose?: boolean } = {}
): Promise<void> {
    const content = await readFile(sourceFile);
    const parsed = parseAgentMarkdown(content);

    const config: NativeAgentConfig = {
        name: parsed.frontmatter.name || agentName,
        description: parsed.frontmatter.description || `Agent ${agentName} for specialized tasks`,
        model: 'gemini-2.5-flash',
        triggers: extractTriggers(agentName, parsed.frontmatter.description || ''),
        tools: ['Glob', 'Grep', 'Read', 'Write', 'Task', 'AskUserQuestion'],
        instructions: parsed.body || `You are ${agentName}. Follow your skill instructions.`
    };

    if (!options.dryRun) {
        await ensureDir(targetDir);

        // Create YAML config
        const yamlContent = generateNativeAgentYaml(config);
        await writeFile(path.join(targetDir, `${agentName}.yaml`), yamlContent);

        if (options.verbose) {
            console.log(`  ✓ ${agentName} → Native Agent Manager format`);
        }
    }
}

/**
 * Generate YAML config for Native Agent Manager
 */
function generateNativeAgentYaml(config: NativeAgentConfig): string {
    const toolsYaml = config.tools.map(t => `  - ${t}`).join('\n');
    const triggersYaml = config.triggers.map(t => `  - "${t}"`).join('\n');

    // Escape instructions for YAML
    const instructionsEscaped = config.instructions
        .split('\n')
        .map(line => `  ${line}`)
        .join('\n');

    return `# ~/.gemini/agent_manager/agents/${config.name}.yaml
name: ${config.name}
description: ${config.description}
model: ${config.model}

# Trigger configuration
triggers:
${triggersYaml}

# Tools permission
tools:
${toolsYaml}

# Agent instructions
instructions: |
${instructionsEscaped}
`;
}

/**
 * Convert all agents to Native Agent Manager format
 */
export async function convertAllAgentsToNative(
    options: ConvertAllAgentsToNativeOptions
): Promise<number> {
    const { sourcePath, targetPath, agentNames = [], dryRun, verbose } = options;
    const agentFiles = await listFiles(sourcePath, '.md');
    let count = 0;

    for (const file of agentFiles) {
        const agentName = path.basename(file, '.md');
        const sourceFile = path.join(sourcePath, file);

        await convertAgentToNativeAgent(sourceFile, targetPath, agentName, { dryRun, verbose });
        count++;
    }

    if (verbose) {
        console.log(`  ✓ Converted ${count} agents to Native Agent Manager format`);
        console.log(`  Location: ${targetPath}`);
    }

    return count;
}
