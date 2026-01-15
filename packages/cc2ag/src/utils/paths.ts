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
    commands: 'commands',
    agents: 'agents',
    skills: 'skills',
    workflows: 'workflows',
    globalWorkflows: 'global_workflows',
};

export function getGlobalSource() {
    return {
        commands: path.join(PATHS.globalClaudeDir, PATHS.commands),
        agents: path.join(PATHS.globalClaudeDir, PATHS.agents),
        skills: path.join(PATHS.globalClaudeDir, PATHS.skills),
    };
}

export function getProjectSource() {
    return {
        commands: path.join(PATHS.projectClaudeDir, PATHS.commands),
        agents: path.join(PATHS.projectClaudeDir, PATHS.agents),
        skills: path.join(PATHS.projectClaudeDir, PATHS.skills),
    };
}

export function getGlobalTarget() {
    return {
        workflows: path.join(PATHS.globalAntigravityDir, PATHS.globalWorkflows),
        skills: path.join(PATHS.globalAntigravityDir, PATHS.skills),
    };
}

export function getProjectTarget() {
    return {
        workflows: path.join(PATHS.projectAgentDir, PATHS.workflows),
        skills: path.join(PATHS.projectAgentDir, PATHS.skills),
    };
}
