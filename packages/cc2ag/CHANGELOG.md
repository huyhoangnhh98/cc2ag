# Changelog

All notable changes to this project will be documented in this file.

## [1.3.4] - 2026-03-02

### Added
- Skill Activation Logging section now included in generated `GEMINI.md` when running `cc2ag global`
- Model is instructed to output `[SKILL] Activating: {skill-name} — Reason: {why}` before every skill/agent activation, making it easy to trace which skills are called and why

## [1.3.3] - 2026-03-02

### Changed
- Version sync with npm publish

## [1.3.2] - 2026-03-01


### Changed
- Converted agents are now saved as `agent-name/agent-name.md` instead of `SKILL.md` to prevent AG from loading them into the skills menu.
- Skills continue to be saved as `SKILL.md` to ensure they can be executed by AG via the slash menu.
- The `references` directory in skills is now renamed to `resources` per Antigravity documentation, and any mentions of `references` inside the Markdown files are appropriately replaced with `resources`.

## [1.3.1] - 2026-03-01

### Changed
- Converted Claude Code agents are now stored in a dedicated `agents/` folder rather than mixed with skills.
- Removed workflow generator for `brainstorm`, `plan`, and `cook` since AG handles these implicitly as skills.
- Skills and agents now use hardcoded output paths replacing the deprecated Naming section hook.
- `WebSearch` tool references in skills/agents mapped to native AG Google Search capabilities.
- GEMINI.md template updated to reflect new agent path references and path patterns.

## [1.3.0] - 2026-01-30

### Added
- `--fresh` flag for clean + convert with confirmation prompt
- User-invocable skills now convert to workflows (not just commands)
- `prompt.ts` utility for confirmation dialogs
- Vitest testing framework with 4 test cases
- Skill-to-workflow conversion supports `user-invocable: true` detection

### Changed
- Workflow converter now processes both commands and user-invocable skills
- Skills with `user-invocable: true` are converted to workflows and skipped in skills conversion
- Warning displayed when skill overrides a command with same name

## [1.2.3] - 2026-01-29

### Fixed
- Chalk version 5 ESM import compatibility

## [1.2.2] - 2026-01-28

### Changed
- Version bump for npm publish

## [1.2.0] - 2026-01-28

### Added
- Initial release with global and project conversion
- Commands to workflows conversion
- Skills folder conversion with `skill-` prefix
- Agents folder conversion with `agent-` prefix
- Reference path updates for Antigravity format
- `--clean` flag to remove existing converted content
- `--dry-run` flag for preview mode
- `--verbose` flag for detailed output
- `--force` flag to overwrite existing files
- Character limit warning for workflows > 12000 chars
