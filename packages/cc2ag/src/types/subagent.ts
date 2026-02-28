/**
 * SubAgent YAML configuration format for Antigravity SubAgents extension
 */
export interface SubAgentYaml {
    name: string;
    description: string;
    vendor: 'claude' | 'codex';
    model?: string;
    triggers: string[];
    instructions: string;
    scope: 'global' | 'project';
    tools?: string[];
}

/**
 * Enable/Disable configuration for a single subagent
 */
export interface SubAgentEnableConfig {
    enabled: boolean;
    vendor: 'claude' | 'codex';
    fallback: string | null;  // e.g., 'native-test', 'manual-review', 'native-git'
}

/**
 * Main subagents configuration schema
 */
export interface SubAgentsConfig {
    version: string;
    subagents: {
        [agentName: string]: SubAgentEnableConfig;
    };
    defaults: {
        default_vendor: 'claude' | 'codex';
        auto_fallback: boolean;
    };
}

/**
 * Fallback command configuration
 */
export interface FallbackConfig {
    agentName: string;
    fallbackType: string;
    commands: string[];
}

/**
 * Available fallback strategies per agent
 */
export const FALLBACK_STRATEGIES: Record<string, FallbackConfig> = {
    tester: {
        agentName: 'tester',
        fallbackType: 'native-test',
        commands: ['npm test', 'pytest', 'go test ./...', 'cargo test', 'flutter test']
    },
    'code-reviewer': {
        agentName: 'code-reviewer',
        fallbackType: 'manual-review',
        commands: ['echo "TODO: Code review needed"', 'echo "Run manual code review checklist"']
    },
    'docs-manager': {
        agentName: 'docs-manager',
        fallbackType: 'manual-docs',
        commands: ['echo "TODO: Update documentation"', 'echo "Run docs:sync manually"']
    },
    'git-manager': {
        agentName: 'git-manager',
        fallbackType: 'native-git',
        commands: ['git add .', 'git status', 'git commit -m "{message}"']
    },
    'web-searcher': {
        agentName: 'web-searcher',
        fallbackType: 'native-search',
        commands: ['echo "Use WebSearch tool manually"']
    },
    researcher: {
        agentName: 'researcher',
        fallbackType: 'manual-research',
        commands: ['echo "Conduct manual research using WebSearch"']
    },
    planner: {
        agentName: 'planner',
        fallbackType: 'manual-planning',
        commands: ['echo "Create implementation plan manually"']
    }
};

/**
 * Default subagent configuration
 */
export const DEFAULT_SUBAGENTS_CONFIG: SubAgentsConfig = {
    version: '1.0',
    subagents: {
        researcher: {
            enabled: true,
            vendor: 'claude',
            fallback: 'manual-research'
        },
        planner: {
            enabled: true,
            vendor: 'claude',
            fallback: 'manual-planning'
        },
        tester: {
            enabled: true,
            vendor: 'claude',
            fallback: 'native-test'
        },
        'code-reviewer': {
            enabled: true,
            vendor: 'claude',
            fallback: 'manual-review'
        },
        'docs-manager': {
            enabled: true,
            vendor: 'claude',
            fallback: 'manual-docs'
        },
        'git-manager': {
            enabled: true,
            vendor: 'claude',
            fallback: 'native-git'
        },
        'web-searcher': {
            enabled: true,
            vendor: 'claude',
            fallback: 'native-search'
        }
    },
    defaults: {
        default_vendor: 'claude',
        auto_fallback: true
    }
};
