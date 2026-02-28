export interface ConvertOptions {
    dryRun?: boolean;
    force?: boolean;
    verbose?: boolean;
    globalSkills?: boolean;
    clean?: boolean;
    fresh?: boolean;  // Clean and convert fresh (removes existing)
    yes?: boolean;    // Skip confirmation prompts
    installExtension?: boolean;  // Install Antigravity SubAgents extension
    skipExtension?: boolean;     // Skip extension installation
    native?: boolean;  // Use Native Agent Manager instead of SubAgents Extension
}

export interface SkillInfo {
    name: string;
    type: 'agent' | 'skill';
    sourcePath: string;
}

export interface WorkflowInfo {
    name: string;
    sourcePath: string;
    referencedSkills: string[];
}

export interface ConversionResult {
    workflowsConverted: number;
    skillsConverted: number;
    agentsConverted: number;
    rulesConverted: number;
    claudeMdConverted: boolean;
    errors: string[];
}

export interface RulesConvertOptions {
    sourcePath: string;
    targetPath: string;
    skillNames: string[];
    agentNames: string[];
    context: 'global' | 'project';
    dryRun?: boolean;
    verbose?: boolean;
}
