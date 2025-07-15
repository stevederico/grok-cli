# Changelog

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
- Replaced OpenCLI components

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