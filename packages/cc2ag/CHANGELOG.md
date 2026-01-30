# Changelog

All notable changes to this project will be documented in this file.

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
