// Path replacement patterns based on context (global vs project)
const GLOBAL_PATH_REPLACEMENTS: [string, string][] = [
    ['$HOME/.claude/CLAUDE.md', '$HOME/.gemini/GEMINI.md'],
    ['~/.claude/CLAUDE.md', '~/.gemini/GEMINI.md'],
    ['$HOME/.claude/workflows', '$HOME/.gemini/antigravity/rules'],
    ['~/.claude/workflows', '~/.gemini/antigravity/rules'],
    ['$HOME/.claude/skills', '$HOME/.gemini/antigravity/skills'],
    ['~/.claude/skills', '~/.gemini/antigravity/skills'],
    ['$HOME/.claude/agents', '$HOME/.gemini/antigravity/agents'],
    ['~/.claude/agents', '~/.gemini/antigravity/agents'],
    ['.claude/skills', '.agent/skills'],
    ['.claude/agents', '.agent/agents'],
];

const PROJECT_PATH_REPLACEMENTS: [string, string][] = [
    ['.claude/CLAUDE.md', '.agent/GEMINI.md'],
    ['.claude/workflows', '.agent/rules'],
    ['$HOME/.claude/skills', '.agent/skills'],
    ['~/.claude/skills', '.agent/skills'],
    ['$HOME/.claude/agents', '.agent/agents'],
    ['~/.claude/agents', '.agent/agents'],
    ['.claude/skills', '.agent/skills'],
    ['.claude/agents', '.agent/agents'],
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
 * - `skill-brainstorm` → `brainstorm` (strip skill- prefix, folder has no prefix post-fix)
 * - `agent-planner` → path to agent-planner/agent-planner.md (clean folder name, no double-prefix)
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

    // Replace skill references: `skill-brainstorm` → `brainstorm` (folder has no skill- prefix post-fix)
    for (const skillName of skillNames) {
        if (skillName) {
            const cleanName = skillName.replace(/^skill-/, '');
            const regex = new RegExp(`\`${escapeRegex(skillName)}\``, 'g');
            result = result.replace(regex, `\`${cleanName}\``);
        }
    }

    // Replace agent references: `agent-planner` → path to agent (folder is agent-planner, no double-prefix)
    for (const agentName of agentNames) {
        if (agentName) {
            const cleanName = agentName.replace(/^agent-/, '');
            const regex = new RegExp(`\`${escapeRegex(agentName)}\``, 'g');
            const agentPath = context === 'global'
                ? `$HOME/.gemini/antigravity/agents/agent-${cleanName}/agent-${cleanName}.md`
                : `.agent/agents/agent-${cleanName}/agent-${cleanName}.md`;
            result = result.replace(regex, `\`${agentPath}\``);
        }
    }

    // Convert agent usage patterns to load instructions
    // Pattern: "use `agent-xxx` agent" → "Load `agent-xxx` instructions"
    // Since we've replaced the backticks with path earlier, we need to match the original or new format
    result = result.replace(/[Uu]se (`agent-[^`]+`) agents?/g, 'Load $1 instructions');
    result = result.replace(/[Uu]se (`[^`]+\/agents\/[^`]+`) agents?/g, 'Load $1 instructions');

    // Pattern: "`agent-xxx` subagent" → "`agent-xxx` instructions"
    result = result.replace(/(`agent-[^`]+`) subagents?/g, '$1 instructions');
    result = result.replace(/(`[^`]+\/agents\/[^`]+`) subagents?/g, '$1 instructions');

    // Pattern: "spawn `agent-xxx`" → "Load `agent-xxx` instructions"
    result = result.replace(/[Ss]pawn (`agent-[^`]+`)/g, 'Load $1 instructions');
    result = result.replace(/[Ss]pawn (`[^`]+\/agents\/[^`]+`)/g, 'Load $1 instructions');

    // Pattern: "invoke `agent-xxx`" → "Load `agent-xxx` instructions"
    result = result.replace(/[Ii]nvoke (`agent-[^`]+`)/g, 'Load $1 instructions');
    result = result.replace(/[Ii]nvoke (`[^`]+\/agents\/[^`]+`)/g, 'Load $1 instructions');

    // Pattern: "launch `agent-xxx`" → "Load `agent-xxx` instructions"
    result = result.replace(/[Ll]aunch (`agent-[^`]+`)/g, 'Load $1 instructions');
    result = result.replace(/[Ll]aunch (`[^`]+\/agents\/[^`]+`)/g, 'Load $1 instructions');

    // Map WebSearch to native capabilities
    result = result.replace(/`WebSearch` tool/g, "native web search capability");
    result = result.replace(/WebSearch tool/g, "native web search capability");

    // Convert slash command format: /xxx:yyy → /xxx-yyy (Antigravity format)
    // Match patterns like /ipa:validate, /plan:hard, /docs:sync, etc.
    result = result.replace(/\/([a-z]+(?:-[a-z]+)*):([a-z]+(?:-[a-z]+)*)/g, '/$1-$2');

    // Replace ck:[skill] with skill-[skill]
    result = result.replace(/ck:([a-z0-9-]+)/g, 'skill-$1');

    // Replace /ck-[command] with /[command]
    result = result.replace(/\/ck-([a-z0-9-]+)/g, '/$1');

    // Replace occurrences of "references" directory to "resources" directory
    result = result.replace(/([/\\'`"]|^)references([/\\'`"]|$)/g, '$1resources$2');

    // Replace skill execution commands `/skill-[skill-name]` to just `/[skill-name]`
    // since Antigravity handles them properly when the `skill-` prefix is stripped during slash command input.
    result = result.replace(/\/skill-([a-z0-9-]+)/g, '/$1');

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
        if (!lines.includes(`Load \`${agent}\` instructions.`)) {
            lines.push(`Load \`${agent}\` instructions.`);
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
