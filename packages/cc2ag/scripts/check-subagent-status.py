#!/usr/bin/env python3
"""
Check subagent status for workflow integration.

Usage:
    python check-subagent-status.py check <agent>    # Check if agent is enabled
    python check-subagent-status.py get-cli <agent>  # Get CLI path for agent
    python check-subagent-status.py list             # List all agents
    python check-subagent-status.py config-path      # Get config file path

Output:
    check <agent>: "enabled" or "disabled:fallback:<fallback>"
    get-cli <agent>: CLI path or "disabled"
"""

import json
import os
import sys
from pathlib import Path

# Config file path
CONFIG_DIR = Path.home() / '.cc2ag'
CONFIG_FILE = CONFIG_DIR / 'subagents-config.json'

# Default fallback strategies
FALLBACK_STRATEGIES = {
    'tester': 'native-test',
    'code-reviewer': 'manual-review',
    'docs-manager': 'manual-docs',
    'git-manager': 'native-git',
    'web-searcher': 'native-search',
    'researcher': 'manual-research',
    'planner': 'manual-planning'
}

# Default CLI paths
CLI_PATHS = {
    'claude': '/usr/local/bin/claude',
    'codex': '/usr/local/bin/codex'
}


def load_config():
    """Load or create default config."""
    if not CONFIG_FILE.exists():
        # Create default config
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        default_config = {
            'version': '1.0',
            'subagents': {
                'researcher': {'enabled': True, 'vendor': 'claude', 'fallback': 'manual-research'},
                'planner': {'enabled': True, 'vendor': 'claude', 'fallback': 'manual-planning'},
                'tester': {'enabled': True, 'vendor': 'claude', 'fallback': 'native-test'},
                'code-reviewer': {'enabled': True, 'vendor': 'claude', 'fallback': 'manual-review'},
                'docs-manager': {'enabled': True, 'vendor': 'claude', 'fallback': 'manual-docs'},
                'git-manager': {'enabled': True, 'vendor': 'claude', 'fallback': 'native-git'},
                'web-searcher': {'enabled': True, 'vendor': 'claude', 'fallback': 'native-search'}
            },
            'defaults': {
                'default_vendor': 'claude',
                'auto_fallback': True
            }
        }
        with open(CONFIG_FILE, 'w') as f:
            json.dump(default_config, f, indent=2)
        return default_config

    with open(CONFIG_FILE, 'r') as f:
        return json.load(f)


def check_agent(agent_name: str) -> str:
    """Check if agent is enabled. Returns status string."""
    config = load_config()
    agent_config = config['subagents'].get(agent_name)

    if not agent_config:
        # Agent not configured, use default fallback
        fallback = FALLBACK_STRATEGIES.get(agent_name, 'manual')
        return f'disabled:fallback:{fallback}'

    if agent_config['enabled']:
        return 'enabled'
    else:
        fallback = agent_config.get('fallback', FALLBACK_STRATEGIES.get(agent_name, 'manual'))
        return f'disabled:fallback:{fallback}'


def get_cli(agent_name: str) -> str:
    """Get CLI path for agent. Returns CLI path or 'disabled'."""
    config = load_config()
    agent_config = config['subagents'].get(agent_name)

    if not agent_config or not agent_config['enabled']:
        return 'disabled'

    vendor = agent_config.get('vendor', 'claude')
    return CLI_PATHS.get(vendor, CLI_PATHS['claude'])


def list_agents():
    """List all agents with status."""
    config = load_config()

    print(f"{'Agent':<18} | {'Status':<8} | {'Vendor':<6} | Fallback")
    print('-' * 60)

    for name, agent_config in config['subagents'].items():
        status = 'enabled' if agent_config['enabled'] else 'disabled'
        vendor = agent_config.get('vendor', 'claude')
        fallback = agent_config.get('fallback', 'none')
        print(f"{name:<18} | {status:<8} | {vendor:<6} | {fallback}")


def config_path() -> str:
    """Get config file path."""
    return str(CONFIG_FILE)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]

    if command == 'check' and len(sys.argv) >= 3:
        result = check_agent(sys.argv[2])
        print(result)
        # Exit code: 0 if enabled, 1 if disabled
        sys.exit(0 if result == 'enabled' else 1)

    elif command == 'get-cli' and len(sys.argv) >= 3:
        result = get_cli(sys.argv[2])
        print(result)
        sys.exit(0 if result != 'disabled' else 1)

    elif command == 'list':
        list_agents()

    elif command == 'config-path':
        print(config_path())

    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == '__main__':
    main()
