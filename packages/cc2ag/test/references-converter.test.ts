import { describe, it, expect } from 'vitest';
import { updateReferences } from '../src/converters/references.js';

describe('updateReferences — skill references', () => {
    it('strips skill- prefix: `skill-brainstorm` → `brainstorm`', () => {
        const content = 'Activate `skill-brainstorm` skill.';
        const result = updateReferences(content, ['skill-brainstorm'], [], 'project');
        expect(result).toContain('`brainstorm`');
        expect(result).not.toContain('`skill-skill-brainstorm`');
        expect(result).not.toContain('`skill-brainstorm`');
    });

    it('strips skill- prefix for multi-part names', () => {
        const content = 'Use `skill-sequential-thinking` for this.';
        const result = updateReferences(content, ['skill-sequential-thinking'], [], 'project');
        expect(result).toContain('`sequential-thinking`');
        expect(result).not.toContain('skill-skill-');
    });

    it('handles skill name without prefix in list (no-op strip)', () => {
        const content = 'Activate `brainstorm` skill.';
        const result = updateReferences(content, ['brainstorm'], [], 'project');
        expect(result).toContain('`brainstorm`');
        expect(result).not.toContain('skill-brainstorm');
    });
});

describe('updateReferences — agent references (project context)', () => {
    it('strips agent- prefix before building path: `agent-planner` → correct path', () => {
        const content = 'Use `agent-planner` agent.';
        const result = updateReferences(content, [], ['agent-planner'], 'project');
        expect(result).toContain('.agent/agents/agent-planner/agent-planner.md');
        expect(result).not.toContain('agent-agent-planner');
    });

    it('strips agent- prefix for multi-part names', () => {
        const content = 'Delegate to `agent-code-reviewer`.';
        const result = updateReferences(content, [], ['agent-code-reviewer'], 'project');
        expect(result).toContain('.agent/agents/agent-code-reviewer/agent-code-reviewer.md');
        expect(result).not.toContain('agent-agent-code-reviewer');
    });
});

describe('updateReferences — agent references (global context)', () => {
    it('builds global path without double prefix', () => {
        const content = 'Load `agent-planner`.';
        const result = updateReferences(content, [], ['agent-planner'], 'global');
        expect(result).toContain('$HOME/.gemini/antigravity/agents/agent-planner/agent-planner.md');
        expect(result).not.toContain('agent-agent-planner');
    });
});

describe('updateReferences — references → resources rename preserved', () => {
    it('renames references/ to resources/ in paths', () => {
        const content = 'See the file at `skills/references/doc.md`.';
        const result = updateReferences(content, [], [], 'project');
        expect(result).toContain('resources/doc.md');
        expect(result).not.toContain('/references/');
    });
});

describe('updateReferences — path replacements still work', () => {
    it('replaces ~/.claude/skills with .agent/skills in project context', () => {
        const content = 'Skills live in `~/.claude/skills`.';
        const result = updateReferences(content, [], [], 'project');
        expect(result).toContain('.agent/skills');
    });
});
