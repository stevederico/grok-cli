# Changelog

## [0.3.9] - 2026-02-26

  Add vitest workspace config
  Fix 32 failing test files
  Update snapshot assertions
  Fix mock default exports
  Fix logger test sandboxing
  Update stale test assertions

## [0.3.8] - 2026-02-26

  Add conversation history
  Add rich system prompt
  Add agent profiles
  Add /agent command
  Fix /plan command
  Add tool filtering per agent
  Update provider message handling

## [0.3.7] - 2026-02-26

  Consolidate .grokcli to .grok-cli
  Rename .grokcliignore to .grok-cli-ignore
  Add hook system
  Add lifecycle hook events
  Wire hook integration points
  Update settings schema
  Update config plumbing

## [0.3.6] - 2026-02-26

  Add API key setup dialog
  Add /setup alias for /auth
  Expand /auth show all providers
  Expand auth validation per-provider
  Update README quick start
  Update commands documentation

## [0.3.4] - 2026-01-29

Add multi-provider support
  Add new tools
  Expand slash commands
  Refactor xAI provider
  Update UI components
  Update themes

## [0.3.3] - 2026-01-29

### Fixed
- Fix TypeScript build errors in cli config
- Fix /stats token tracking always showing 0
- Add usage extraction from xAI API responses
- Wire up addUsage in provider stream hook

## [0.3.2] - 2026-01-28

### Changed
- Update ASCII art
- Default model to grok-code-fast-1
- Fix tsconfig exclude

### Fixed
- Retry logic with exponential backoff and jitter for transient API errors
- Debug logging gated behind `DEBUG=1` environment variable
- Request timeouts (3s health checks, 30s queries)
- Removed dead code (LruCache, messageInspectors, generateContentResponseUtilities)

### Improved
- Centralized system prompts into single source of truth
- Standardized environment variable names (`GROKCLI_PROVIDER`, `GROKCLI_OLLAMA_ENDPOINT`)
- Documentation cleanup: removed outdated Google/Gemini references

## [0.3.0] - 2025-07-15
### Added
- Complete Terms of Service and Privacy Notice documentation
- Open source preparation and cleanup

### Removed
- Google Artifact Registry authentication scripts
- Internal development references

### Changed
- Cleaned up for open source release
- Updated error messages for public distribution

## [0.2.7] - 2025-07-15
### Fixed
- Ollama provider: Added `queryWithTools()` implementation, supports tool calling with fallback
- Provider selection: Fixed environment variable handling (`GROKCLI_PROVIDER`)

### Added
- Provider management:
  - Auto-detection using `GROKCLI_PROVIDER`, defaults to `grok` if `XAI_API_KEY` set, else `ollama`
  - Validation system with health checks
  - `/provider` command: `list`, `current`, `set <name>`
- Provider health monitoring:
  - Real-time config validation
  - Ollama connectivity checks (`http://localhost:11434`)
  - API key validation for Grok
- Interactive dialogs: `/provider` and `/model` with keyboard navigation (↑↓, Enter, ESC)
- Dynamic UI: Real-time model/provider updates in status bar

### Improved
- Error handling: Timeouts (3s health checks, 30s queries), better 404 model handling, fallback model selection
- Smart provider switching with validation and setup instructions

## [0.2.6] - 2025-07-10
### Fixed
- Theme functionality and color scheme

## [0.2.5] - 2025-07-05
### Added
- ASCII art
### Fixed
- Tool functionality
### Changed
- Project name

## [0.2.4] - 2025-06-30
### Added
- Debug messages
### Removed
- All telemetry
- `@opentelemetry` dependencies

## [0.2.3] - 2025-06-25
### Added
- Witty phrase cyclers
### Removed
- Unused folders
- Other providers
### Changed
- Replaced GrokCLI components

## [0.2.2] - 2025-06-20
### Added
- Debug mode
- Updated privacy policy

## [0.2.1] - 2025-06-15
### Improved
- Tool usage

## [0.2.0] - 2025-06-10
### Added
- Working tools

## [0.1.9] - 2025-06-05
### Changed
- Replaced SearchWeb with non-Google search
- Fully de-Googled

## [0.1.8] - 2025-06-01
### Added
- Version and build info
### Removed
- Auth flow DeprecationWarning

## [0.1.7] - 2025-05-28
### Added
- Working Grok provider
### Changed
- Set Grok as default

## [0.1.6] - 2025-05-25
### Fixed
- `punycode` module DeprecationWarning
- Environment variable not found
### Added
- `/provider` endpoint
- Provider tests
### Removed
- All telemetry
- Deno dependencies
- `/auth` endpoint
- `/compress` endpoint
- Google, Anthropic, OAI providers
### Changed
- Updated auth
- Set Ollama as default