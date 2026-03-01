import path from 'path';
import os from 'os';

export const PATHS = {
    // Claude Code sources
    globalClaudeDir: path.join(os.homedir(), '.claude'),
    projectClaudeDir: '.claude',

    // Antigravity targets
    globalAntigravityDir: path.join(os.homedir(), '.gemini', 'antigravity'),
    projectAgentDir: '.agent',

    // Subdirectories
    agents: 'agents',
    skills: 'skills',
    workflows: 'workflows',
    rules: 'rules',
    globalWorkflows: 'global_workflows',
};

export function getGlobalSource() {
    return {
        workflows: path.join(PATHS.globalClaudeDir, PATHS.workflows),
        agents: path.join(PATHS.globalClaudeDir, PATHS.agents),
        skills: path.join(PATHS.globalClaudeDir, PATHS.skills),
        claudeMd: path.join(PATHS.globalClaudeDir, 'CLAUDE.md'),
    };
}

export function getProjectSource() {
    return {
        workflows: path.join(PATHS.projectClaudeDir, PATHS.workflows),
        agents: path.join(PATHS.projectClaudeDir, PATHS.agents),
        skills: path.join(PATHS.projectClaudeDir, PATHS.skills),
        claudeMd: path.join(PATHS.projectClaudeDir, 'CLAUDE.md'),
    };
}

export function getGlobalTarget() {
    return {
        workflows: path.join(PATHS.globalAntigravityDir, PATHS.globalWorkflows),
        skills: path.join(PATHS.globalAntigravityDir, PATHS.skills),
        agents: path.join(PATHS.globalAntigravityDir, PATHS.agents),
        rules: path.join(PATHS.globalAntigravityDir, PATHS.rules),
        geminiMd: path.join(PATHS.globalAntigravityDir, '..', 'GEMINI.md'),
    };
}

export function getProjectTarget() {
    return {
        workflows: path.join(PATHS.projectAgentDir, PATHS.workflows),
        skills: path.join(PATHS.projectAgentDir, PATHS.skills),
        agents: path.join(PATHS.projectAgentDir, PATHS.agents),
        rules: path.join(PATHS.projectAgentDir, PATHS.rules),
        geminiMd: path.join(PATHS.projectAgentDir, 'GEMINI.md'),
    };
}
