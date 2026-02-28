import { exec } from 'child_process';
import { promisify } from 'util';
import { exists } from './fs.js';

const execAsync = promisify(exec);

export interface CLIDetectionResult {
    claudeCLI: {
        installed: boolean;
        path: string | null;
        version: string | null;
    };
    codexCLI: {
        installed: boolean;
        path: string | null;
        version: string | null;
    };
    antigravityExtension: {
        installed: boolean;
        version: string | null;
    };
}

/**
 * Detect installed CLIs and Antigravity extension
 */
export async function detectCLIs(): Promise<CLIDetectionResult> {
    const result: CLIDetectionResult = {
        claudeCLI: { installed: false, path: null, version: null },
        codexCLI: { installed: false, path: null, version: null },
        antigravityExtension: { installed: false, version: null }
    };

    // Detect Claude CLI
    try {
        const { stdout } = await execAsync('which claude');
        const claudePath = stdout.trim();
        if (claudePath) {
            result.claudeCLI.installed = true;
            result.claudeCLI.path = claudePath;
            try {
                const { stdout: version } = await execAsync('claude --version');
                result.claudeCLI.version = version.trim();
            } catch {
                result.claudeCLI.version = 'unknown';
            }
        }
    } catch {
        result.claudeCLI.installed = false;
    }

    // Detect Codex CLI
    try {
        const { stdout } = await execAsync('which codex');
        const codexPath = stdout.trim();
        if (codexPath) {
            result.codexCLI.installed = true;
            result.codexCLI.path = codexPath;
            try {
                const { stdout: version } = await execAsync('codex --version');
                result.codexCLI.version = version.trim();
            } catch {
                result.codexCLI.version = 'unknown';
            }
        }
    } catch {
        result.codexCLI.installed = false;
    }

    // Detect Antigravity SubAgents extension
    try {
        const { stdout } = await execAsync('code --list-extensions');
        const extensions = stdout.toLowerCase();
        if (extensions.includes('antigravity') || extensions.includes('oleynikaleksandr.antigravity-subagents')) {
            result.antigravityExtension.installed = true;
            // Try to get version
            try {
                const { stdout: version } = await execAsync('code --list-extensions --show-versions');
                const match = version.match(/oleynikaleksandr\.antigravity-subagents@(.+)/i);
                if (match) {
                    result.antigravityExtension.version = match[1].trim();
                }
            } catch {
                result.antigravityExtension.version = 'unknown';
            }
        }
    } catch {
        // VSCode CLI not available, check filesystem
        const extensionPath = `${process.env.HOME || '~'}/.vscode/extensions`;
        if (await exists(extensionPath)) {
            try {
                const fs = await import('fs/promises');
                const dirs = await fs.readdir(extensionPath);
                const antigravityDir = dirs.find(d => d.toLowerCase().includes('antigravity'));
                if (antigravityDir) {
                    result.antigravityExtension.installed = true;
                    result.antigravityExtension.version = 'unknown';
                }
            } catch {
                result.antigravityExtension.installed = false;
            }
        }
    }

    return result;
}

/**
 * Generate setup recommendations based on detection results
 */
export function generateSetupGuide(detection: CLIDetectionResult): string {
    const lines: string[] = [];

    lines.push('╔════════════════════════════════════════════════════════════╗');
    lines.push('║           cc2ag Setup Recommendation                       ║');
    lines.push('╚════════════════════════════════════════════════════════════╝');
    lines.push('');

    // Claude CLI status
    if (detection.claudeCLI.installed) {
        lines.push(`✓ Claude CLI: ${detection.claudeCLI.path} (${detection.claudeCLI.version || 'unknown'})`);
    } else {
        lines.push(`✗ Claude CLI: Not installed`);
        lines.push(`  → Install: npm install -g @anthropic-ai/claude-code`);
    }

    // Codex CLI status
    if (detection.codexCLI.installed) {
        lines.push(`✓ Codex CLI: ${detection.codexCLI.path} (${detection.codexCLI.version || 'unknown'})`);
    } else {
        lines.push(`✗ Codex CLI: Not installed`);
        lines.push(`  → Install: npm install -g @openai/codex`);
    }

    // Antigravity extension status
    if (detection.antigravityExtension.installed) {
        lines.push(`✓ Antigravity SubAgents: v${detection.antigravityExtension.version || 'unknown'}`);
    } else {
        lines.push(`✗ Antigravity SubAgents: Not installed`);
        lines.push(`  → Install: code --install-extension OleynikAleksandr.antigravity-subagents`);
    }

    lines.push('');
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('RECOMMENDED SETUP:');
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('');

    // Scenario-based recommendations
    if (detection.antigravityExtension.installed && detection.claudeCLI.installed) {
        lines.push('✓ You have everything needed for SubAgents with Claude CLI!');
        lines.push('');
        lines.push('Enable subagents:');
        lines.push('  cc2ag subagents enable researcher');
        lines.push('  cc2ag subagents enable planner');
        lines.push('  cc2ag subagents enable tester');
        lines.push('  # ... enable other agents as needed');
        lines.push('');
        lines.push('Or enable all at once:');
        lines.push('  cc2ag subagents enable-all --vendor claude');
    } else if (detection.antigravityExtension.installed && detection.codexCLI.installed) {
        lines.push('✓ You have everything needed for SubAgents with Codex CLI!');
        lines.push('');
        lines.push('Enable subagents:');
        lines.push('  cc2ag subagents enable researcher --vendor codex');
        lines.push('  cc2ag subagents enable planner --vendor codex');
        lines.push('  # ... enable other agents as needed');
        lines.push('');
        lines.push('Or enable all at once:');
        lines.push('  cc2ag subagents enable-all --vendor codex');
    } else if (!detection.antigravityExtension.installed && (detection.claudeCLI.installed || detection.codexCLI.installed)) {
        lines.push('⚠ You have a CLI but not the Antigravity extension.');
        lines.push('');
        lines.push('Option 1: Use SubAgents (Recommended)');
        lines.push('  1. Install Antigravity extension:');
        lines.push('     code --install-extension OleynikAleksandr.antigravity-subagents');
        lines.push('  2. Then enable subagents:');
        lines.push('     cc2ag subagents enable-all --vendor claude');
        lines.push('');
        lines.push('Option 2: Use Native Commands (No SubAgents)');
        lines.push('  cc2ag subagents disable-all');
        lines.push('  # Workflows will use native commands instead');
    } else {
        lines.push('⚠ No CLI detected. You have two options:');
        lines.push('');
        lines.push('Option 1: Install Claude CLI + SubAgents (Recommended)');
        lines.push('  1. Install Claude CLI:');
        lines.push('     npm install -g @anthropic-ai/claude-code');
        lines.push('  2. Install Antigravity extension:');
        lines.push('     code --install-extension OleynikAleksandr.antigravity-subagents');
        lines.push('  3. Enable subagents:');
        lines.push('     cc2ag subagents enable-all --vendor claude');
        lines.push('');
        lines.push('Option 2: Use without SubAgents');
        lines.push('  cc2ag subagents disable-all');
        lines.push('  # All workflows will use native commands');
    }

    lines.push('');

    return lines.join('\n');
}

/**
 * Get installation status summary (single line)
 */
export function getInstallationSummary(detection: CLIDetectionResult): string {
    const parts: string[] = [];

    if (detection.claudeCLI.installed) parts.push('✓ Claude CLI');
    if (detection.codexCLI.installed) parts.push('✓ Codex CLI');
    if (detection.antigravityExtension.installed) parts.push('✓ Antigravity');

    if (parts.length === 0) {
        return 'No CLI or extension detected';
    }

    return parts.join(', ');
}
