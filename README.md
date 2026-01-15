# Claude Code to Antigravity Converter (cc2ag)

[![npm version](https://badge.fury.io/js/%40huyhoangnhh98%2Fcc2ag.svg)](https://www.npmjs.com/package/@huyhoangnhh98/cc2ag)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Convert Claude Code configurations to Antigravity (Gemini) format.

## 📋 Requirements

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

## 🚀 Installation

### Install globally (recommended)

```bash
npm install -g @huyhoangnhh98/cc2ag
```

### Or install locally in your project

```bash
npm install @huyhoangnhh98/cc2ag
```

## 💻 Usage

### Global installation

```bash
cc2ag --help
```

### Local installation

```bash
npx @huyhoangnhh98/cc2ag --help
```

## 🔧 Available Commands

| Command | Description |
|---------|-------------|
| `cc2ag global` | Convert global `~/.claude` to `~/.gemini/antigravity` |
| `cc2ag project` | Convert project `.claude` to `.agent` |
| `cc2ag both` | Convert both global and project sources |
| `cc2ag uninstall` | Remove all cc2ag-generated files |

## 📥 Convert Commands

### Convert global Claude Code configs

```bash
cc2ag global
cc2ag global --verbose          # Show detailed output
cc2ag global --dry-run          # Preview without writing
cc2ag global --force            # Overwrite existing files
cc2ag global --global-skills    # Install skills globally
```

### Convert project Claude Code configs

```bash
cc2ag project
cc2ag project --verbose
cc2ag project --dry-run
cc2ag project --force
```

### Convert both global and project

```bash
cc2ag both
cc2ag both --verbose --force
```

## 🗑️ Uninstall Command

Remove all cc2ag-generated workflows, skills, and agents:

```bash
# Remove everything (global + project)
cc2ag uninstall

# Preview what would be removed
cc2ag uninstall --dry-run

# Remove only global files (~/.gemini/antigravity)
cc2ag uninstall --global

# Remove only project files (.agent)
cc2ag uninstall --project

# Verbose output
cc2ag uninstall --verbose
```

## 📁 Output Structure

### Global (`~/.gemini/antigravity/`)
```
├── global_workflows/    # Converted commands → workflows
├── global_rules/        # Converted settings → rules  
└── skills/              # Converted skills → agents/skills
```

### Project (`.agent/`)
```
├── workflows/           # Project-level workflows
└── skills/              # Project-level skills/agents
```

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 👤 Author

**hoangnhh98**

- GitHub: [@huyhoangnhh98](https://github.com/huyhoangnhh98)
- npm: [@huyhoangnhh98](https://www.npmjs.com/~huyhoangnhh98)
