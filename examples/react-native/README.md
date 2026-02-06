# Bitrise SDK - Bare React Native Example

This example demonstrates integrating the Bitrise SDK in a bare React Native project (without Expo).

## Features Demonstrated

- SDK configuration with `BitriseSDK.configure()`
- Automatic sync with different `InstallMode` options
- Manual update flow: `checkForUpdate()` -> `download()` -> `install()`
- Progress tracking callbacks
- Status callbacks showing all sync phases
- Binary version mismatch handling
- Error handling patterns

## Prerequisites

- Node.js 18+
- React Native development environment set up
- Xcode (for iOS)
- Android Studio (for Android)

## Quick Start

### 1. Install Dependencies

```bash
cd examples/react-native
npm install
```

### 2. Generate Native Projects

This example requires native iOS and Android projects. Generate them using:

```bash
# Generate iOS project
npx react-native init BitriseSDKExample --directory ./temp-init --skip-install
cp -r ./temp-init/ios ./ios
rm -rf ./temp-init

# Install iOS dependencies
cd ios && pod install && cd ..
```

For Android:
```bash
npx react-native init BitriseSDKExample --directory ./temp-init --skip-install
cp -r ./temp-init/android ./android
rm -rf ./temp-init
```

### 3. Configure Native Deployment Keys

**iOS (Info.plist):**

Add to `ios/BitriseSDKExample/Info.plist`:
```xml
<key>CodePushDeploymentKey</key>
<string>YOUR_IOS_DEPLOYMENT_KEY</string>
<key>CodePushServerURL</key>
<string>https://api.bitrise.io</string>
```

**Android (strings.xml):**

Add to `android/app/src/main/res/values/strings.xml`:
```xml
<string name="CodePushDeploymentKey">YOUR_ANDROID_DEPLOYMENT_KEY</string>
<string name="CodePushServerURL">https://api.bitrise.io</string>
```

### 4. Update App.tsx

Replace placeholder values in `App.tsx`:
```typescript
BitriseSDK.configure({
  apiToken: 'YOUR_ACTUAL_TOKEN',
  appSlug: 'YOUR_ACTUAL_SLUG',
  deploymentKey: 'YOUR_DEPLOYMENT_KEY',
})
```

### 5. Run

```bash
# iOS
npm run ios

# Android
npm run android
```

## SDK API Demonstrated

### Configuration

```typescript
BitriseSDK.configure({
  apiToken: string,      // Required: Bitrise API token
  appSlug: string,       // Required: Bitrise app slug
  deploymentKey: string, // Required for bare RN
  serverUrl?: string,    // Optional: Custom server URL
})
```

### Automatic Sync with Callbacks

```typescript
const result = await BitriseSDK.codePush.sync(
  {
    installMode: InstallMode.ON_NEXT_RESTART,
    updateDialog: {
      title: 'Update Available',
      optionalUpdateMessage: 'Would you like to install?',
      optionalInstallButtonLabel: 'Install',
      optionalIgnoreButtonLabel: 'Later',
    },
  },
  // Status callback
  (status) => console.log('Status:', SyncStatus[status]),
  // Progress callback
  (progress) => console.log(`${progress.receivedBytes}/${progress.totalBytes}`),
  // Binary mismatch callback
  (update) => console.log('Requires native update:', update.appVersion)
)
```

### Manual Update Flow

```typescript
// 1. Check for updates
const update = await BitriseSDK.codePush.checkForUpdate()

if (update) {
  // 2. Download with progress tracking
  const localPackage = await update.download((progress) => {
    const percent = (progress.receivedBytes / progress.totalBytes) * 100
    console.log(`Downloading: ${percent}%`)
  })

  // 3. Install the update
  await localPackage.install(InstallMode.ON_NEXT_RESTART)

  // 4. Restart to apply (optional)
  BitriseSDK.codePush.restartApp()
}
```

### Install Modes

| Mode | Behavior |
|------|----------|
| `IMMEDIATE` | Install and restart immediately |
| `ON_NEXT_RESTART` | Install now, apply on next app restart |
| `ON_NEXT_RESUME` | Install now, apply when app resumes from background |
| `ON_NEXT_SUSPEND` | Install when app goes to background |

## Differences from Expo Example

| Aspect | Expo Example | Bare RN Example |
|--------|--------------|-----------------|
| Deployment Key | Auto-read from native config via plugin | Must provide in `configure()` |
| Native Setup | Automatic via Expo config plugin | Manual Podfile/Gradle setup |
| Build System | EAS Build or `expo run` | `react-native run-ios/android` |
| Native Code | Managed by Expo | Full access |

## Troubleshooting

### "BitriseFileSystem module not found"

1. Ensure the SDK is properly linked (React Native 0.60+ has auto-linking)
2. Run `pod install` in the `ios/` directory
3. Clean and rebuild: `cd ios && pod deintegrate && pod install`

### Updates not downloading

1. Verify deployment key is correct
2. Check network connectivity
3. Ensure `notifyAppReady()` is called after app starts
4. Check for errors in the activity log

### Metro bundler can't find SDK

1. Ensure `metro.config.js` is configured with workspace paths
2. Run `npm install` in both the example and root SDK directory
3. Clear Metro cache: `npx react-native start --reset-cache`

## Project Structure

```
examples/react-native/
├── App.tsx              # Main demo component
├── index.js             # React Native entry point
├── app.json             # App metadata
├── package.json         # Dependencies
├── metro.config.js      # Metro bundler config
├── tsconfig.json        # TypeScript config
├── babel.config.js      # Babel config
├── ios/                 # iOS native project
└── android/             # Android native project
```

## Learn More

- [SDK Documentation](../../README.md)
- [API Reference](../../docs/api-reference.md)
- [Expo Example](../expo/) - For Expo-based projects
