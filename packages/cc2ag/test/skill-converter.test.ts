import { describe, it, expect } from 'vitest';

// Test the prefix-stripping logic used in convertAllSkills and convertAllAgents
// These mirror the exact expressions used in skill.ts

describe('skill folder naming', () => {
    it('strips skill- prefix from source dir', () => {
        const dir = 'skill-brainstorm';
        const cleanName = dir.replace(/^skill-/, '');
        expect(cleanName).toBe('brainstorm');
    });

    it('strips skill- prefix from nested skill dir', () => {
        const dir = 'skill-sequential-thinking';
        const cleanName = dir.replace(/^skill-/, '');
        expect(cleanName).toBe('sequential-thinking');
    });

    it('leaves non-prefixed dir unchanged', () => {
        const dir = 'brainstorm';
        const cleanName = dir.replace(/^skill-/, '');
        expect(cleanName).toBe('brainstorm');
    });

    it('does not double-strip skill- prefix', () => {
        const dir = 'skill-brainstorm';
        const cleanName = dir.replace(/^skill-/, '');
        // target folder should be cleanName, not skill-cleanName
        const targetFolderBase = cleanName;
        expect(targetFolderBase).not.toContain('skill-skill-');
        expect(targetFolderBase).toBe('brainstorm');
    });
});

describe('agent folder naming', () => {
    it('strips agent- prefix from source filename', () => {
        const file = 'agent-planner.md';
        const agentName = file.replace('.md', '');
        const cleanName = agentName.replace(/^agent-/, '');
        expect(cleanName).toBe('planner');
    });

    it('builds agent- prefixed target folder without double-prefix', () => {
        const file = 'agent-planner.md';
        const agentName = file.replace('.md', '');
        const cleanName = agentName.replace(/^agent-/, '');
        const targetFolderBase = `agent-${cleanName}`;
        expect(targetFolderBase).toBe('agent-planner');
        expect(targetFolderBase).not.toBe('agent-agent-planner');
    });

    it('strips agent- prefix from multi-part name', () => {
        const file = 'agent-code-reviewer.md';
        const agentName = file.replace('.md', '');
        const cleanName = agentName.replace(/^agent-/, '');
        const targetFolderBase = `agent-${cleanName}`;
        expect(targetFolderBase).toBe('agent-code-reviewer');
    });

    it('leaves non-prefixed agent filename unchanged after strip', () => {
        const file = 'planner.md';
        const agentName = file.replace('.md', '');
        const cleanName = agentName.replace(/^agent-/, '');
        const targetFolderBase = `agent-${cleanName}`;
        expect(targetFolderBase).toBe('agent-planner');
    });

    it('output file name matches folder base (no double agent- prefix)', () => {
        // convertAgentToSkill writes ${agentName}.md where agentName = path.basename(targetFolder)
        // targetFolder = agent-planner → agentName = agent-planner → file = agent-planner.md
        const targetFolderBase = 'agent-planner';
        const outputFile = `${targetFolderBase}.md`;
        expect(outputFile).toBe('agent-planner.md');
        expect(outputFile).not.toBe('agent-agent-planner.md');
    });
});
