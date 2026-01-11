# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.7] - 2026-01-11

### Added

- System tray integration for background running
- CLI `commit-message` command for AI-powered commit message generation
- Multi-account management for AI providers (DeepSeek, Claude)
- Playground feature for interactive AI conversations
- Cross-platform builds (Windows, macOS, Linux)

### Fixed

- CLI build errors related to `cwd` handling in packaged builds
- Production icon display issues on Linux

### Changed

- Improved IPC chain for CLI → Main Process → Renderer communication

## [1.0.6] - 2026-01-10

### Added

- Monaco Editor integration for code viewing
- Dashboard statistics and usage tracking

### Fixed

- CodeBlock component return value errors

## [1.0.5] - 2026-01-09

### Added

- Initial CLI implementation with Unix socket communication
- Hot reload support for CLI development
- Account import/export functionality

## [1.0.0] - 2026-01-01

### Added

- Initial release
- Electron desktop application framework
- React frontend with TailwindCSS
- Basic AI provider integration
- Local API server for CLI communication
