# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-04

### Added - Expo Support 🎉

#### Config Plugin
- **Expo config plugin** for managed workflow support
- Automatic deployment key injection into native files (Info.plist and strings.xml)
- Platform-specific configuration (separate iOS and Android keys)
- Simple and advanced configuration formats
- Environment variable support via app.config.js
- EAS Build integration with build profiles
- Comprehensive plugin documentation and examples

#### Runtime Configuration
- **ExpoConfig utility** for reading native configuration at runtime
- Automatic deployment key reading from Info.plist (iOS)
- Automatic deployment key reading from strings.xml (Android)
- Native module extension: `getStringResource()` method for Android
- Graceful fallback when native config not available
- BitriseSDK auto-reads deployment keys from native config

#### Example Application
- Complete Expo example app (`example-expo/`)
- CodePush integration UI with all features:
  - Check for updates
  - Download with progress tracking
  - Install with multiple modes (immediate, on restart, on resume)
  - Sync with update dialogs
  - Activity logging
- EAS Build configuration (eas.json)
- Bitrise CI/CD workflow (bitrise.yml)
- Metro bundler configuration
- Comprehensive README with setup instructions

#### Documentation
- **Expo Support section** in main README
- **expo-configuration.md**: Advanced configuration guide (800+ lines)
  - Basic and platform-specific configuration
  - Environment-based configuration
  - EAS Build integration
  - Best practices and common patterns
  - Verification steps
- **migration-to-expo.md**: Migration guide from bare React Native (400+ lines)
  - Step-by-step migration process
  - Configuration changes
  - Testing procedures
  - Troubleshooting guide
  - Rollback plan
- **Troubleshooting section** in main README
  - Expo-specific issues (5 common problems)
  - General issues (3 common problems)
- Plugin README with usage examples

#### Testing
- 38 new tests (all passing)
- Plugin tests: 20 tests (100% coverage)
- ExpoConfig tests: 18 tests (100% coverage)
- Total test count: 437 tests
- Test coverage maintained at ~95%

### Changed

#### SDK Configuration
- BitriseSDK.configure() now auto-reads `deploymentKey` and `serverUrl` from native config
- Deployment key is now optional in configure() when using Expo plugin
- Enhanced configuration validation with clearer error messages

#### Package Configuration
- Added `app.plugin` field to package.json
- Added `app.plugin.js` entry point for Expo
- Added plugin exports to package.json exports field
- Added plugin directory to files list
- Split build process: `build:sdk` and `build:plugin`
- Updated TypeScript configuration for plugin

#### Native Modules
- Extended Android BitriseFileSystemModule with `getStringResource()` method
- Added synchronous string resource reading on Android

### Performance

- Bundle size: 66.3 KB (increased from 56.6 KB, +9.7 KB)
  - Plugin code: 0 bytes (build-time only, not in bundle)
  - Runtime utilities: ~3 KB
  - Within 70 KB target
- Gzipped size: ~33 KB (within 35 KB target)
- No performance impact on app startup
- Config reading: < 100ms

### Compatibility

- ✅ Expo SDK 50+
- ✅ React Native 0.72+
- ✅ Node.js 18+
- ✅ TypeScript 5.0+
- ✅ EAS Build
- ✅ Expo Development Builds
- ✅ Bare React Native (backward compatible)
- ❌ Expo Go (not supported - requires custom native code)

### Developer Experience

- Simplified Expo installation (3 steps)
- Automatic native configuration via plugin
- No manual native code changes required
- Environment-based configuration support
- Clear error messages for configuration issues
- Comprehensive examples and documentation

### Breaking Changes

None - this release is fully backward compatible with existing bare React Native implementations.

## [0.1.0] - 2026-01-XX

### Added

- Initial release
- Core SDK for Bitrise Release Management
- CodePush functionality for over-the-air updates
- Native filesystem storage (no 50 MB limit)
- Smart download queue with retry logic
- Built-in statistics and metrics
- Download queue management (pause/resume/cancel)
- Event-driven architecture
- Rollback management
- iOS and Android support
- Comprehensive test suite (399 tests, 94.9% coverage)
- Zero external dependencies

### Features

- Over-the-air updates via CodePush
- Backward compatible with react-native-code-push
- Native filesystem storage for large packages
- Sequential download queue with automatic processing
- Retry logic with exponential backoff
- Progress tracking and event emission
- Rollback on failed updates
- MetricsClient for tracking
- Production-ready with comprehensive tests

### API

- BitriseSDK.configure()
- BitriseSDK.codePush.checkForUpdate()
- BitriseSDK.codePush.sync()
- BitriseSDK.codePush.notifyAppReady()
- DownloadQueue API with events
- MetricsClient for analytics

## Development

### Repository
- https://github.com/bitrise-io/bitrise-sdk-react-native

### Issues
- https://github.com/bitrise-io/bitrise-sdk-react-native/issues

### Contributing
See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

---

## Version History

- **v0.2.0**: Expo support with config plugin, runtime configuration, and comprehensive documentation
- **v0.1.0**: Initial release with CodePush functionality, download queue, and native storage

## Migration Guide

### From v0.1.0 to v0.2.0

No breaking changes. The update is fully backward compatible.

**New Expo users:**
1. Add plugin to app.json
2. Run `npx expo prebuild`
3. Remove manual deployment key from configure()

**Existing bare React Native users:**
- No changes required
- All existing code continues to work
- Optional: Use new ExpoConfig utility

See [docs/migration-to-expo.md](./docs/migration-to-expo.md) for detailed migration guide.

## Acknowledgments

- Phase 7 implementation: Expo support with config plugin
- Comprehensive documentation and examples
- Extensive testing and quality assurance
- Community feedback and contributions
