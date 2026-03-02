# cc2ag

> Convert Claude Code configurations to Antigravity format

[![npm version](https://badge.fury.io/js/cc2ag.svg)](https://www.npmjs.com/package/cc2ag)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
npm install -g cc2ag
```

## Usage

```bash
# Convert global ~/.claude to Antigravity
cc2ag global

# Convert project ./.claude to Antigravity
cc2ag project

# Convert both global and project
cc2ag both
```

### Options

```bash
--dry-run    # Preview changes without writing
--force      # Overwrite existing files
--verbose    # Show detailed output
```

## What it converts

| Claude Code | Antigravity | Location |
|-------------|-------------|----------|
| `commands/*.md` | `workflows/*.md` | Global: `~/.gemini/antigravity/global_workflows/`<br>Project: `.agent/workflows/` |
| `skills/*/` | `skill-*/SKILL.md` | Project: `.agent/skills/` |
| `agents/*.md` | `{agent-name}/SKILL.md` | Global: `~/.gemini/antigravity/agents/`<br>Project: `.agent/agents/` |

### Key Features

- **Auto-adds activation blocks** - Workflows automatically include `Activate skill` statements
- **Reference updates** - Converts `agent-planner` → `$HOME/.gemini/antigravity/agents/planner`, `planning` → `skill-planning`

## Examples

### Before (Claude Code)

```markdown
# plan-hard.md
Use multiple `researcher` agents...
pass them to `planner` subagent...
```

### After (Antigravity)

```markdown
# plan-hard.md
---
description: Workflow converted from Claude Code command
---

<!-- Skill Activation Block -->
Load `$HOME/.gemini/antigravity/agents/researcher` instructions.
Load `$HOME/.gemini/antigravity/agents/planner` instructions.
Activate `skill-planning` skill.

Use multiple `$HOME/.gemini/antigravity/agents/researcher` instructions...
pass them to `$HOME/.gemini/antigravity/agents/planner` instructions...
```

## License

MIT
