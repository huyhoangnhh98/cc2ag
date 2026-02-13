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
    errors: string[];
}
