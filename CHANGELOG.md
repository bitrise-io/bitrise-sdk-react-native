# Changelog

All notable changes documented here. Format based on [Keep a Changelog](https://keepachangelog.com/).

## [0.2.0] - 2026-02-05

### Added

- Differential updates support for smaller download sizes
- `isFirstRun` tracking to detect first launch after update
- Binary version mismatch callback for native code changes
- react-native-code-push native config key compatibility (`CodePushDeploymentKey`, `CodePushServerUrl`)

### Changed

- Use react-native-code-push config keys for seamless migration

## [0.1.0] - 2026-02-01

### Added

- Core CodePush functionality (`sync`, `checkForUpdate`, `notifyAppReady`)
- Expo config plugin for managed workflow support
- Download queue with automatic retry logic
- Native filesystem storage (no 50 MB limit)
- Metrics client for analytics
- Higher-order component (HOC) for automatic sync
- Rollback management with configurable timers
- Comprehensive error classes
- 94% test coverage
