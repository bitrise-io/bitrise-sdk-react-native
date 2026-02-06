# Bitrise SDK - Expo Example App

This example app demonstrates how to integrate the Bitrise React Native SDK with CodePush functionality in an Expo managed workflow.

## Features

- ✅ Expo managed workflow with config plugin
- ✅ CodePush integration (check, download, install updates)
- ✅ Automatic deployment key injection via plugin
- ✅ Development builds with `expo run:ios/android`
- ✅ EAS Build support for production builds
- ✅ Activity logging for debugging
- ✅ Multiple sync modes (immediate, on restart, on resume)

## Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- Xcode (for iOS development)
- Android Studio (for Android development)

## Quick Start

### 1. Install Dependencies

```bash
cd examples/expo
npm install
```

### 2. Configure Deployment Keys

Edit `app.json` and replace the test deployment keys:

```json
{
  "expo": {
    "plugins": [
      [
        "@bitrise/react-native-sdk",
        {
          "ios": {
            "deploymentKey": "YOUR_IOS_DEPLOYMENT_KEY"
          },
          "android": {
            "deploymentKey": "YOUR_ANDROID_DEPLOYMENT_KEY"
          }
        }
      ]
    ]
  }
}
```

Or use `app.config.js` for environment-based configuration:

```bash
# Rename app.config.js.example to app.config.js
# Set environment variables
export BITRISE_IOS_DEPLOYMENT_KEY="your-ios-key"
export BITRISE_ANDROID_DEPLOYMENT_KEY="your-android-key"
```

### 3. Prebuild Native Projects

```bash
npm run prebuild
```

This generates the `ios/` and `android/` directories with the Bitrise configuration injected.

### 4. Run Development Build

**iOS:**
```bash
npm run ios
```

**Android:**
```bash
npm run android
```

## Development Workflow

### Local Development

1. **Start Metro bundler:**
   ```bash
   npm start
   ```

2. **Run on iOS simulator:**
   ```bash
   npm run ios
   ```

3. **Run on Android emulator:**
   ```bash
   npm run android
   ```

### Rebuild Native Code

If you change plugin configuration or native code:

```bash
npm run prebuild:clean
```

This cleans and rebuilds the native projects.

## EAS Build

### Setup EAS

1. **Login to Expo:**
   ```bash
   eas login
   ```

2. **Configure project:**
   ```bash
   eas build:configure
   ```

### Build Commands

**Development build:**
```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

**Preview build:**
```bash
eas build --profile preview --platform all
```

**Production build:**
```bash
eas build --profile production --platform all
```

### Install Development Build

After the build completes:

**iOS:**
```bash
eas build:run --profile development --platform ios
```

**Android:**
```bash
eas build:run --profile development --platform android
```

## App Features

### Check for Updates

Manually check if a CodePush update is available:

```typescript
const update = await BitriseSDK.codePush.checkForUpdate()
if (update) {
  console.log(`Update available: ${update.label}`)
}
```

### Download Update

Download an update with progress tracking:

```typescript
await update.download((progress) => {
  const percent = (progress.receivedBytes / progress.totalBytes) * 100
  console.log(`Download progress: ${percent}%`)
})
```

### Install Update

Install the downloaded update:

```typescript
await update.install(InstallMode.IMMEDIATE) // Restarts immediately
await update.install(InstallMode.ON_NEXT_RESTART) // Applies on next app start
await update.install(InstallMode.ON_NEXT_RESUME) // Applies when app resumes
```

### Sync (Automatic)

Automatically check, download, and install updates:

```typescript
const result = await BitriseSDK.codePush.sync({
  installMode: InstallMode.ON_NEXT_RESTART,
  updateDialog: {
    title: 'Update Available',
    optionalUpdateMessage: 'An update is available. Install now?',
    optionalInstallButtonLabel: 'Install',
    optionalIgnoreButtonLabel: 'Later',
  },
})
```

## Configuration

### app.json (Static Configuration)

Simple configuration for all environments:

```json
{
  "expo": {
    "plugins": [
      [
        "@bitrise/react-native-sdk",
        {
          "deploymentKey": "shared-key-for-both-platforms"
        }
      ]
    ]
  }
}
```

Platform-specific configuration:

```json
{
  "expo": {
    "plugins": [
      [
        "@bitrise/react-native-sdk",
        {
          "ios": {
            "deploymentKey": "ios-key",
            "serverUrl": "https://api.bitrise.io"
          },
          "android": {
            "deploymentKey": "android-key",
            "serverUrl": "https://api.bitrise.io"
          }
        }
      ]
    ]
  }
}
```

### app.config.js (Dynamic Configuration)

Environment-based configuration:

```javascript
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    [
      '@bitrise/react-native-sdk',
      {
        ios: {
          deploymentKey: process.env.BITRISE_IOS_DEPLOYMENT_KEY,
          serverUrl: process.env.BITRISE_SERVER_URL || 'https://api.bitrise.io',
        },
        android: {
          deploymentKey: process.env.BITRISE_ANDROID_DEPLOYMENT_KEY,
          serverUrl: process.env.BITRISE_SERVER_URL || 'https://api.bitrise.io',
        },
      },
    ],
  ],
})
```

### eas.json (EAS Build Configuration)

Configure environment variables for different build profiles:

```json
{
  "build": {
    "development": {
      "env": {
        "BITRISE_IOS_DEPLOYMENT_KEY": "dev-ios-key",
        "BITRISE_ANDROID_DEPLOYMENT_KEY": "dev-android-key"
      }
    },
    "production": {
      "env": {
        "BITRISE_IOS_DEPLOYMENT_KEY": "prod-ios-key",
        "BITRISE_ANDROID_DEPLOYMENT_KEY": "prod-android-key"
      }
    }
  }
}
```

## Troubleshooting

### "BitriseFileSystem module not found"

**Solution:** Rebuild native projects:
```bash
npm run prebuild:clean
npm run ios  # or npm run android
```

### "Deployment key not configured"

**Solution:** Check that your `app.json` or `app.config.js` has the plugin configured with deployment keys.

### Changes not taking effect

**Solution:**
1. Clean native directories: `rm -rf ios android`
2. Rebuild: `npm run prebuild`
3. Run app: `npm run ios` or `npm run android`

### Metro bundler issues

**Solution:** Clear cache and restart:
```bash
npm start -- --clear
```

### EAS Build fails

**Solution:** Ensure `eas.json` has correct configuration and environment variables are set.

## Project Structure

```
examples/expo/
├── App.tsx                 # Main app component with CodePush integration
├── app.json               # Static Expo configuration
├── app.config.js          # Dynamic Expo configuration (environment variables)
├── eas.json               # EAS Build configuration
├── metro.config.js        # Metro bundler configuration
├── tsconfig.json          # TypeScript configuration
├── package.json           # Dependencies and scripts
└── README.md              # This file
```

## Testing Checklist

- [ ] Install dependencies
- [ ] Configure deployment keys
- [ ] Run `npm run prebuild`
- [ ] Test on iOS simulator
- [ ] Test on Android emulator
- [ ] Test "Check for Updates" button
- [ ] Test "Download Update" button
- [ ] Test "Install Update" button
- [ ] Test "Sync" button
- [ ] Test "Restart App" button
- [ ] Verify deployment key is read from native config
- [ ] Build with EAS Build (development profile)
- [ ] Install and test EAS development build on physical device

## API Reference

See the main SDK README for complete API documentation:
[../../README.md](../../README.md)

## Support

For issues or questions:
- GitHub Issues: https://github.com/bitrise-io/bitrise-sdk-react-native/issues
- Documentation: https://github.com/bitrise-io/bitrise-sdk-react-native#readme

## License

MIT
