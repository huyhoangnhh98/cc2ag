// Path replacement patterns based on context (global vs project)
const GLOBAL_PATH_REPLACEMENTS: [string, string][] = [
    ['$HOME/.claude/skills', '$HOME/.gemini/antigravity/skills'],
    ['~/.claude/skills', '~/.gemini/antigravity/skills'],
    ['$HOME/.claude/agents', '$HOME/.gemini/antigravity/skills'],
    ['~/.claude/agents', '~/.gemini/antigravity/skills'],
    ['.claude/skills', '.agent/skills'],
    ['.claude/agents', '.agent/skills'],
];

const PROJECT_PATH_REPLACEMENTS: [string, string][] = [
    ['$HOME/.claude/skills', '.agent/skills'],
    ['~/.claude/skills', '.agent/skills'],
    ['$HOME/.claude/agents', '.agent/skills'],
    ['~/.claude/agents', '.agent/skills'],
    ['.claude/skills', '.agent/skills'],
    ['.claude/agents', '.agent/skills'],
];

/**
 * Update path references from Claude to Antigravity
 */
export function updatePathReferences(content: string, context: 'global' | 'project'): string {
    const replacements = context === 'global'
        ? GLOBAL_PATH_REPLACEMENTS
        : PROJECT_PATH_REPLACEMENTS;

    let result = content;
    for (const [from, to] of replacements) {
        result = result.replaceAll(from, to);
    }
    return result;
}

/**
 * Update references in content:
 * - `skill-name` → `skill-skill-name`
 * - `agent-name` → `agent-agent-name`
 * - Convert agent usage patterns to skill activation
 * - Replace Claude paths with Antigravity paths
 */
export function updateReferences(
    content: string,
    skillNames: string[],
    agentNames: string[],
    context: 'global' | 'project' = 'project'
): string {
    let result = content;

    // First update path references (Claude → Antigravity)
    result = updatePathReferences(result, context);

    // Replace skill references: `skill-name` → `skill-skill-name`
    for (const skillName of skillNames) {
        if (skillName) {
            const regex = new RegExp(`\`${escapeRegex(skillName)}\``, 'g');
            result = result.replace(regex, `\`skill-${skillName}\``);
        }
    }

    // Replace agent references: `agent-name` → `agent-agent-name`
    for (const agentName of agentNames) {
        if (agentName) {
            const regex = new RegExp(`\`${escapeRegex(agentName)}\``, 'g');
            result = result.replace(regex, `\`agent-${agentName}\``);
        }
    }

    // Convert agent usage patterns to skill activation patterns
    // Pattern: "use `agent-xxx` agent" → "Activate `agent-xxx` skill"
    result = result.replace(/[Uu]se (`agent-[^`]+`) agents?/g, 'Activate $1 skill');

    // Pattern: "`agent-xxx` subagent" → "`agent-xxx` skill"
    result = result.replace(/(`agent-[^`]+`) subagents?/g, '$1 skill');

    // Pattern: "spawn `agent-xxx`" → "Activate `agent-xxx` skill"
    result = result.replace(/[Ss]pawn (`agent-[^`]+`)/g, 'Activate $1 skill');

    // Pattern: "invoke `agent-xxx`" → "Activate `agent-xxx` skill"
    result = result.replace(/[Ii]nvoke (`agent-[^`]+`)/g, 'Activate $1 skill');

    // Pattern: "launch `agent-xxx`" → "Activate `agent-xxx` skill"
    result = result.replace(/[Ll]aunch (`agent-[^`]+`)/g, 'Activate $1 skill');

    // Convert slash command format: /xxx:yyy → /xxx-yyy (Antigravity format)
    // Match patterns like /ipa:validate, /plan:hard, /docs:sync, etc.
    result = result.replace(/\/([a-z]+(?:-[a-z]+)*):([a-z]+(?:-[a-z]+)*)/g, '/$1-$2');

    return result;
}

/**
 * Extract all skill/agent references from content
 */
export function extractReferences(content: string): { skills: string[]; agents: string[] } {
    const skillMatches = content.match(/`skill-([^`]+)`/g) || [];
    const agentMatches = content.match(/`agent-([^`]+)`/g) || [];

    const skills = [...new Set(skillMatches.map(m => m.replace(/`/g, '')))];
    const agents = [...new Set(agentMatches.map(m => m.replace(/`/g, '')))];

    return { skills, agents };
}

/**
 * Generate activation block for workflow
 */
export function generateActivationBlock(skills: string[], agents: string[]): string {
    const lines: string[] = [];

    // Add agents first (they usually contain personas)
    for (const agent of agents) {
        if (!lines.includes(`Activate \`${agent}\` skill.`)) {
            lines.push(`Activate \`${agent}\` skill.`);
        }
    }

    // Then add skills
    for (const skill of skills) {
        if (!lines.includes(`Activate \`${skill}\` skill.`)) {
            lines.push(`Activate \`${skill}\` skill.`);
        }
    }

    if (lines.length === 0) return '';

    return '\n<!-- Skill Activation Block -->\n' + lines.join('\n') + '\n';
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
