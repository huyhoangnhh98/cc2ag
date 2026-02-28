import {
    SubAgentsConfig,
    SubAgentEnableConfig,
    DEFAULT_SUBAGENTS_CONFIG,
    FALLBACK_STRATEGIES
} from '../types/subagent.js';
import path from 'path';
import os from 'os';
import { readFile, writeFile, ensureDir, exists } from '../utils/fs.js';

const CONFIG_DIR = path.join(os.homedir(), '.cc2ag');
const CONFIG_FILE = path.join(CONFIG_DIR, 'subagents-config.json');

/**
 * Get the subagents config file path
 */
export function getConfigPath(): string {
    return CONFIG_FILE;
}

/**
 * Load or create subagents config
 */
export async function loadConfig(): Promise<SubAgentsConfig> {
    if (await exists(CONFIG_FILE)) {
        const content = await readFile(CONFIG_FILE);
        return JSON.parse(content) as SubAgentsConfig;
    }

    // Create default config
    await ensureDir(CONFIG_DIR);
    await writeFile(CONFIG_FILE, JSON.stringify(DEFAULT_SUBAGENTS_CONFIG, null, 2));
    return DEFAULT_SUBAGENTS_CONFIG;
}

/**
 * Save subagents config
 */
export async function saveConfig(config: SubAgentsConfig): Promise<void> {
    await ensureDir(CONFIG_DIR);
    await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Get status of a specific subagent
 */
export async function getSubAgentStatus(agentName: string): Promise<SubAgentEnableConfig | null> {
    const config = await loadConfig();
    return config.subagents[agentName] || null;
}

/**
 * Enable a subagent
 */
export async function enableSubAgent(agentName: string, vendor?: 'claude' | 'codex'): Promise<boolean> {
    const config = await loadConfig();

    if (!config.subagents[agentName]) {
        // Add new agent with defaults
        config.subagents[agentName] = {
            enabled: true,
            vendor: vendor || config.defaults.default_vendor,
            fallback: FALLBACK_STRATEGIES[agentName]?.fallbackType || null
        };
    } else {
        config.subagents[agentName].enabled = true;
        if (vendor) {
            config.subagents[agentName].vendor = vendor;
        }
    }

    await saveConfig(config);
    return true;
}

/**
 * Disable a subagent
 */
export async function disableSubAgent(agentName: string): Promise<boolean> {
    const config = await loadConfig();

    if (!config.subagents[agentName]) {
        return false;
    }

    config.subagents[agentName].enabled = false;
    await saveConfig(config);
    return true;
}

/**
 * Configure a subagent
 */
export async function configureSubAgent(
    agentName: string,
    options: {
        vendor?: 'claude' | 'codex';
        fallback?: string;
    }
): Promise<boolean> {
    const config = await loadConfig();

    if (!config.subagents[agentName]) {
        // Add new agent with defaults
        config.subagents[agentName] = {
            enabled: true,
            vendor: options.vendor || config.defaults.default_vendor,
            fallback: options.fallback || FALLBACK_STRATEGIES[agentName]?.fallbackType || null
        };
    } else {
        if (options.vendor) {
            config.subagents[agentName].vendor = options.vendor;
        }
        if (options.fallback !== undefined) {
            config.subagents[agentName].fallback = options.fallback;
        }
    }

    await saveConfig(config);
    return true;
}

/**
 * List all subagents with their status
 */
export async function listSubAgents(): Promise<Array<{
    name: string;
    enabled: boolean;
    vendor: string;
    fallback: string | null;
}>> {
    const config = await loadConfig();

    return Object.entries(config.subagents).map(([name, cfg]) => ({
        name,
        enabled: cfg.enabled,
        vendor: cfg.vendor,
        fallback: cfg.fallback
    }));
}

/**
 * Get CLI command for a subagent (for workflow integration)
 * Returns the subagent CLI path if enabled, or fallback command if disabled
 */
export async function getSubAgentCli(agentName: string): Promise<{
    enabled: boolean;
    cliPath: string | null;
    fallback: string | null;
}> {
    const status = await getSubAgentStatus(agentName);

    if (!status) {
        return {
            enabled: false,
            cliPath: null,
            fallback: FALLBACK_STRATEGIES[agentName]?.commands[0] || null
        };
    }

    if (!status.enabled) {
        return {
            enabled: false,
            cliPath: null,
            fallback: FALLBACK_STRATEGIES[agentName]?.commands[0] || null
        };
    }

    // Return Claude CLI path for enabled agents
    return {
        enabled: true,
        cliPath: '/usr/local/bin/claude',  // Default Claude CLI path
        fallback: null
    };
}
