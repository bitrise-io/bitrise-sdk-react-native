# Bitrise SDK Examples

This directory contains example applications demonstrating the Bitrise SDK for React Native.

## Available Examples

### [Expo Managed Workflow](./expo/)

Complete example using Expo managed workflow with config plugins.

**Best for:**
- Expo SDK 50+ projects
- Teams using EAS Build
- Projects that want automatic native configuration

**Features:**
- Config plugin for automatic deployment key injection
- EAS Build integration
- Development builds with `expo run:ios/android`

### [Bare React Native](./react-native/)

Complete example for bare React Native projects without Expo.

**Best for:**
- Non-Expo React Native projects
- Projects with custom native modules
- Teams using react-native CLI

**Features:**
- Manual native configuration
- Full SDK API demonstration
- iOS and Android setup guides

## Quick Comparison

| Feature | Expo | Bare RN |
|---------|------|---------|
| Setup complexity | Low (config plugin) | Medium (manual native config) |
| Deployment key | Automatic via plugin | Manual in Info.plist/strings.xml |
| Build system | EAS Build | Xcode/Android Studio |
| Native linking | Automatic | Automatic (RN 0.60+) |

## Running Examples

Both examples reference the SDK from the parent directory (`file:../..`). Before running:

### 1. Build the SDK

From the repository root:

```bash
npm install
npm run build
```

### 2. Run an Example

**Expo example:**
```bash
cd examples/expo
npm install
npx expo prebuild
npm run ios  # or npm run android
```

**Bare React Native example:**
```bash
cd examples/react-native
npm install
# Follow setup instructions in examples/react-native/README.md
npm run ios  # or npm run android
```

## What Each Example Demonstrates

Both examples showcase the core SDK functionality:

- **SDK Configuration** - `BitriseSDK.configure()` with API credentials
- **Automatic Sync** - `codePush.sync()` with different install modes
- **Manual Updates** - `checkForUpdate()`, `download()`, `install()` flow
- **Progress Tracking** - Real-time download progress callbacks
- **Status Monitoring** - Sync status changes throughout the update lifecycle
- **Update Dialogs** - Native alert dialogs for user confirmation
- **App Restart** - Programmatic restart to apply updates
- **Activity Logging** - Debug logging for troubleshooting

## Choosing an Example

| If you... | Use |
|-----------|-----|
| Have an Expo project | [Expo Example](./expo/) |
| Have a bare RN project | [React Native Example](./react-native/) |
| Want simplest setup | [Expo Example](./expo/) |
| Need full native control | [React Native Example](./react-native/) |
| Use EAS Build | [Expo Example](./expo/) |
| Use Xcode/Android Studio | [React Native Example](./react-native/) |
