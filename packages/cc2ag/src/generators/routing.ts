import path from 'path';
import fs from 'fs-extra';
import { readFile, writeFile, ensureDir } from '../utils/fs.js';
import { SubAgentConfig } from '../converters/subagent.js';

export interface RoutingGeneratorOptions {
    agentsPath: string;
    targetPath: string;
    dryRun?: boolean;
    verbose?: boolean;
}

/**
 * Generate routing rules for Antigravity based on agent configurations
 */
export async function generateRoutingRules(
    agentsConfig: SubAgentConfig[],
    targetPath: string,
    options: { dryRun?: boolean; verbose?: boolean } = {}
): Promise<string> {
    const { dryRun, verbose } = options;

    // Generate routing rules content
    let routingContent = `# SubAgent Routing Protocol

This file defines how Antigravity should route requests to appropriate SubAgents.

`;

    // Group agents by category for better organization
    const agentCategories: { [key: string]: SubAgentConfig[] } = {
        'Research & Analysis': [],
        'Code & Development': [],
        'Testing & Quality': [],
        'Project Management': [],
        'Documentation': [],
        'System & Operations': []
    };

    // Categorize agents based on their names/descriptions
    for (const agent of agentsConfig) {
        if (agent.name.toLowerCase().includes('research')) {
            agentCategories['Research & Analysis'].push(agent);
        } else if (['tester', 'code-reviewer', 'debugger'].includes(agent.name.toLowerCase())) {
            agentCategories['Testing & Quality'].push(agent);
        } else if (['planner', 'project-manager', 'brainstormer'].includes(agent.name.toLowerCase())) {
            agentCategories['Project Management'].push(agent);
        } else if (['docs-manager', 'documentation'].includes(agent.name.toLowerCase())) {
            agentCategories['Documentation'].push(agent);
        } else if (['git-manager', 'mcp-manager'].includes(agent.name.toLowerCase())) {
            agentCategories['System & Operations'].push(agent);
        } else {
            agentCategories['Code & Development'].push(agent);
        }
    }

    // Generate routing rules for each category
    for (const [category, agents] of Object.entries(agentCategories)) {
        if (agents.length > 0) {
            routingContent += `\n## ${category}\n\n`;

            for (const agent of agents) {
                routingContent += `- **Keywords**: ${agent.triggers?.join(', ') || agent.name}\n`;
                routingContent += `  - **Route to**: \`subagent-${agent.name}\`\n\n`;
            }
        }
    }

    // Add special handling for common workflows
    routingContent += `## Common Workflows

### Development Workflow
When user requests development tasks like "implement feature", "fix bug", etc.:
- Route to: \`subagent-fullstack-developer\` or \`subagent-coder\`

### Review Workflow
When user requests code review or quality check:
- Route to: \`subagent-code-reviewer\`

### Planning Workflow
When user requests planning or architecture design:
- Route to: \`subagent-planner\` or \`subagent-brainstormer\`

### Testing Workflow
When user requests testing or validation:
- Route to: \`subagent-tester\`
`;

    if (verbose) {
        console.log(`  ✓ Generated routing rules for ${agentsConfig.length} agents`);
    }

    return routingContent;
}

/**
 * Create routing rules from actual agent files
 */
export async function createRoutingFromAgents(
    agentsPath: string,
    targetPath: string,
    options: { dryRun?: boolean; verbose?: boolean } = {}
): Promise<string> {
    const { dryRun, verbose } = options;

    // Check if the agents path exists
    if (!(await fs.pathExists(agentsPath))) {
        if (verbose) {
            console.log(`  ⚠ Agents path does not exist: ${agentsPath}`);
        }
        // Use default agents as fallback
        const defaultAgents: SubAgentConfig[] = [
            {
                name: 'researcher',
                vendor: 'claude',
                triggers: ['research', 'investigate', 'find information', 'explore', 'study'],
                description: 'Research technical topics and gather information'
            },
            {
                name: 'tester',
                vendor: 'claude',
                triggers: ['test', 'run tests', 'check tests', 'validate', 'verify'],
                description: 'Run tests and validate code'
            },
            {
                name: 'code-reviewer',
                vendor: 'claude',
                triggers: ['review', 'check code', 'audit', 'evaluate', 'inspect'],
                description: 'Review code quality and identify issues'
            },
            {
                name: 'planner',
                vendor: 'claude',
                triggers: ['plan', 'architect', 'design system', 'organize', 'structure'],
                description: 'Create implementation plans and architecture'
            },
            {
                name: 'docs-manager',
                vendor: 'claude',
                triggers: ['document', 'update docs', 'sync docs', 'documentation'],
                description: 'Manage documentation updates'
            },
            {
                name: 'git-manager',
                vendor: 'claude',
                triggers: ['commit', 'push', 'create PR', 'git', 'version control'],
                description: 'Handle git operations and version control'
            },
            {
                name: 'debugger',
                vendor: 'claude',
                triggers: ['debug', 'fix bug', 'troubleshoot', 'investigate issue'],
                description: 'Debug and fix issues in code'
            },
            {
                name: 'brainstormer',
                vendor: 'claude',
                triggers: ['brainstorm', 'think', 'analyze', 'ideate'],
                description: 'Brainstorm solutions and analyze approaches'
            },
            {
                name: 'project-manager',
                vendor: 'claude',
                triggers: ['track progress', 'manage project', 'update status', 'coordinate'],
                description: 'Manage project progress and status'
            },
            {
                name: 'ui-ux-designer',
                vendor: 'claude',
                triggers: ['design', 'ui', 'ux', 'layout', 'interface'],
                description: 'Design UI/UX components and interfaces'
            }
        ];

        const content = await generateRoutingRules(defaultAgents, targetPath, options);
        return content;
    }

    // Read all agent files from the agents path
    const agentFiles = await fs.readdir(agentsPath);
    const agentConfigs: SubAgentConfig[] = [];

    for (const file of agentFiles) {
        if (file.endsWith('.md')) {
            const filePath = path.join(agentsPath, file);
            try {
                const content = await fs.readFile(filePath, 'utf8');

                // Parse frontmatter to get agent configuration
                const frontmatter = parseAgentFrontmatter(content);
                const agentName = path.basename(file, '.md');

                // Create agent config with extracted data and additional triggers
                const agentConfig: SubAgentConfig = {
                    name: frontmatter.name || agentName,
                    vendor: 'claude',
                    model: frontmatter.model,
                    tools: frontmatter.tools,
                    description: frontmatter.description || '',
                    triggers: extractTriggers(frontmatter.description || '', agentName)
                };

                agentConfigs.push(agentConfig);
            } catch (error) {
                if (verbose) {
                    console.log(`  ⚠ Error reading agent file ${filePath}:`, error);
                }
            }
        }
    }

    return await generateRoutingRules(agentConfigs, targetPath, options);
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
 * Parse YAML frontmatter from agent content (duplicate function for standalone use)
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