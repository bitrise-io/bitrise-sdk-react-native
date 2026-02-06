# Bitrise SDK for React Native

[![npm version](https://img.shields.io/npm/v/@bitrise/react-native-sdk.svg)](https://www.npmjs.com/package/@bitrise/react-native-sdk)
[![license](https://img.shields.io/npm/l/@bitrise/react-native-sdk.svg)](https://github.com/bitrise-io/bitrise-sdk-react-native/blob/main/LICENSE)
[![coverage](https://img.shields.io/badge/coverage-94%25-brightgreen.svg)](https://github.com/bitrise-io/bitrise-sdk-react-native)
[![platforms](https://img.shields.io/badge/platforms-iOS%20%7C%20Android-lightgrey.svg)](https://github.com/bitrise-io/bitrise-sdk-react-native)
[![expo](https://img.shields.io/badge/Expo-SDK%2050%2B-blue.svg)](https://expo.dev)

Lightweight React Native SDK for Bitrise Release Management with code push functionality.

## Features

- 🚀 Over-the-air updates via code push
- 📦 Minimal bundle size impact (~53 KB)
- 🔄 Backward compatible with react-native-code-push
- ⚡ Support for Expo managed and bare workflows
- 🧪 Production-ready with comprehensive tests (94% coverage)
- 📱 iOS and Android support
- 💾 **Native filesystem storage** - No 50 MB package size limit
- 🔁 **Smart download queue** - Automatic sequential processing with retry logic
- 📊 **Built-in statistics** - Track download success rates and performance
- 🎯 **Zero external dependencies** - All features implemented from scratch

## Installation

```bash
npm install @bitrise/react-native-sdk
```

or

```bash
yarn add @bitrise/react-native-sdk
```

## Quick Start

```typescript
import { BitriseSDK } from '@bitrise/react-native-sdk'

// Configure the SDK with your workspace slug
// The SDK constructs the server URL as: https://{workspaceSlug}.codepush.bitrise.io
BitriseSDK.configure({
  apiToken: 'your-bitrise-api-token',
  appSlug: 'your-app-slug',
  workspaceSlug: 'your-workspace-slug', // Required for CodePush
  deploymentKey: 'your-deployment-key',
})

// Check for updates
const update = await BitriseSDK.codePush.checkForUpdate()
if (update) {
  console.log('Update available:', update.label)
}

// Sync with latest update
const status = await BitriseSDK.codePush.sync()
```

> **Finding your workspace slug:** Your workspace slug is visible in your Bitrise dashboard URL. See the [Bitrise CodePush documentation](https://docs.bitrise.io/en/release-management/codepush/configuring-your-app-for-codepush.html) for details.

## New Features

### Native Filesystem Storage

Packages are now stored in native filesystem instead of memory, removing the 50 MB size limit:

- **Automatic**: Works out of the box with zero configuration
- **Graceful fallback**: Falls back to in-memory storage if native modules unavailable
- **Persistent**: Survives app restarts
- **Large packages**: No size limitations

### Smart Download Queue

Multiple concurrent download requests are automatically queued and processed sequentially:

```typescript
import { DownloadQueue, QueueEvent } from '@bitrise/react-native-sdk'

// Get queue instance
const queue = DownloadQueue.getInstance({
  maxRetries: 3,           // Retry failed downloads (default: 3)
  baseRetryDelay: 1000,    // Base delay for exponential backoff (default: 1000ms)
  maxRetryDelay: 30000,    // Maximum retry delay cap (default: 30000ms)
  debug: false             // Enable debug logging (default: false)
})

// Listen to queue events
queue.on(QueueEvent.DOWNLOAD_STARTED, (data) => {
  console.log('Download started:', data.item.remotePackage.packageHash)
})

queue.on(QueueEvent.DOWNLOAD_COMPLETED, (data) => {
  console.log('Download completed:', data.package.packageHash)
})

queue.on(QueueEvent.DOWNLOAD_FAILED, (data) => {
  console.error('Download failed:', data.error)
})

// Get queue statistics
const stats = queue.getStatistics()
console.log('Success rate:', stats.successRate)
console.log('Average download time:', stats.averageDownloadTime)
```

**Features:**
- ✅ Automatic FIFO (first-in-first-out) processing
- ✅ Built-in retry logic with exponential backoff
- ✅ Progress tracking and event emission
- ✅ Pause/resume/cancel capabilities
- ✅ No more "download already in progress" errors

## Migration from react-native-code-push

This SDK is designed to be backward compatible with react-native-code-push. The migration should require minimal code changes.

### Before (react-native-code-push)
```typescript
import codePush from 'react-native-code-push'

codePush.sync()
codePush.checkForUpdate()
codePush.notifyAppReady()
```

### After (Bitrise SDK)
```typescript
import { BitriseSDK } from '@bitrise/react-native-sdk'

BitriseSDK.configure({ apiToken: '...', appSlug: '...' })

BitriseSDK.codePush.sync()
BitriseSDK.codePush.checkForUpdate()
BitriseSDK.codePush.notifyAppReady()
```

## Expo Support

Full support for Expo managed workflow via config plugin! The SDK automatically integrates with Expo's prebuild system to inject deployment keys into native configuration files.

### Installation (Expo Managed Workflow)

1. **Install the SDK:**

```bash
npm install @bitrise/react-native-sdk
```

2. **Add the config plugin to your `app.json`:**

```json
{
  "expo": {
    "plugins": [
      [
        "@bitrise/react-native-sdk",
        {
          "ios": {
            "deploymentKey": "YOUR_IOS_DEPLOYMENT_KEY",
            "serverUrl": "https://YOUR_WORKSPACE_SLUG.codepush.bitrise.io"
          },
          "android": {
            "deploymentKey": "YOUR_ANDROID_DEPLOYMENT_KEY",
            "serverUrl": "https://YOUR_WORKSPACE_SLUG.codepush.bitrise.io"
          }
        }
      ]
    ]
  }
}
```

> **Note:** Replace `YOUR_WORKSPACE_SLUG` with your Bitrise workspace slug.

3. **Run prebuild to generate native code:**

```bash
npx expo prebuild
```

4. **Initialize the SDK in your app:**

```typescript
import { BitriseSDK } from '@bitrise/react-native-sdk'

BitriseSDK.configure({
  apiToken: 'your-api-token',
  appSlug: 'your-app-slug'
  // deploymentKey is automatically read from native config
})
```

### Dynamic Configuration with Environment Variables

For different environments (development, staging, production), use `app.config.js`:

```javascript
// Server URL format: https://{workspaceSlug}.codepush.bitrise.io
const workspaceSlug = process.env.BITRISE_WORKSPACE_SLUG || 'your-workspace-slug'
const serverUrl = `https://${workspaceSlug}.codepush.bitrise.io`

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    [
      '@bitrise/react-native-sdk',
      {
        ios: {
          deploymentKey: process.env.BITRISE_IOS_DEPLOYMENT_KEY,
          serverUrl,
        },
        android: {
          deploymentKey: process.env.BITRISE_ANDROID_DEPLOYMENT_KEY,
          serverUrl,
        },
      },
    ],
  ],
})
```

### EAS Build Integration

Configure different deployment keys for each build profile in `eas.json`:

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

Then build with:

```bash
eas build --profile production --platform all
```

### Expo Compatibility

✅ **Supported:**
- Expo Development Builds (`expo run:ios`, `expo run:android`)
- EAS Build (cloud builds)
- Bare workflow (with `expo prebuild`)

❌ **Not Supported:**
- Expo Go (requires custom native code)

### Example Apps

See the [examples](./examples) directory for complete working examples:

- **[Expo Example](./examples/expo)** - Expo managed workflow with config plugin
- **[React Native Example](./examples/react-native)** - Bare React Native setup

Both examples demonstrate:
- CodePush integration and sync operations
- Progress tracking and status callbacks
- Update dialogs and install modes
- Error handling patterns

## API Reference

### `BitriseSDK.configure(config)`

Configure the SDK with your Bitrise credentials.

**Parameters:**
- `config.apiToken` (string, required) - Your Bitrise API token
- `config.appSlug` (string, required) - Your Bitrise app slug
- `config.apiEndpoint` (string, optional) - Custom API endpoint

### `BitriseSDK.codePush.checkForUpdate()`

Check for available updates.

**Returns:** `Promise<UpdateInfo | null>`

### `BitriseSDK.codePush.sync()`

Synchronize with the latest available update.

**Returns:** `Promise<UpdateStatus>`

### `BitriseSDK.codePush.notifyAppReady()`

Notify the SDK that the app has successfully launched.

### Download Queue API

The SDK includes a smart download queue for managing concurrent downloads. See [full API reference](./docs/api-reference.md) for detailed documentation.

**Quick reference:**
- `DownloadQueue.getInstance(config?)` - Get queue instance
- `queue.getStatistics()` - Get download stats (success rate, avg time)
- `queue.getState()` - Get current queue state
- `queue.pause()` / `queue.resume()` / `queue.clear()` - Control queue
- `queue.on(event, callback)` - Subscribe to events

## Troubleshooting

### Expo Issues

#### "BitriseFileSystem module not found"

This error occurs when native modules aren't properly linked after adding the plugin.

**Solution:**
```bash
npx expo prebuild --clean
npx expo run:ios  # or expo run:android
```

#### "Deployment key not configured"

The plugin configuration is missing or incorrectly formatted in `app.json`.

**Solution:**

Check that your `app.json` includes the plugin configuration:

```json
{
  "expo": {
    "plugins": [
      [
        "@bitrise/react-native-sdk",
        {
          "ios": { "deploymentKey": "YOUR_IOS_KEY" },
          "android": { "deploymentKey": "YOUR_ANDROID_KEY" }
        }
      ]
    ]
  }
}
```

#### Config plugin changes not taking effect

Native code needs to be regenerated after plugin configuration changes.

**Solution:**
```bash
rm -rf ios android
npx expo prebuild
npx expo run:ios  # or expo run:android
```

#### EAS Build fails

Environment variables might not be configured correctly in `eas.json`.

**Solution:**

Ensure your `eas.json` includes the deployment keys:

```json
{
  "build": {
    "production": {
      "env": {
        "BITRISE_IOS_DEPLOYMENT_KEY": "your-ios-key",
        "BITRISE_ANDROID_DEPLOYMENT_KEY": "your-android-key"
      }
    }
  }
}
```

#### Metro bundler "Unable to resolve module"

Metro cache might be stale after installing the SDK.

**Solution:**
```bash
npm start -- --clear
# or
npx expo start --clear
```

### General Issues

#### Updates not downloading

Check that:
1. Your deployment key is correct
2. Server URL is accessible
3. Network connection is available
4. The update exists on the server

**Debug:**
```typescript
const update = await BitriseSDK.codePush.checkForUpdate()
console.log('Update info:', update)
```

#### App crashes after update

The update might be incompatible with the current native code.

**Solution:**
- Ensure you're only pushing JavaScript/asset changes
- Binary changes require a new app store release
- Test updates thoroughly before releasing

#### Download queue statistics show high failure rate

**Possible causes:**
- Network connectivity issues
- Server availability problems
- Invalid package URLs

**Debug:**
```typescript
const stats = DownloadQueue.getInstance().getStatistics()
console.log('Stats:', stats)

DownloadQueue.getInstance().on(QueueEvent.DOWNLOAD_FAILED, (data) => {
  console.error('Download failed:', data.error)
})
```

## Development

See [claude.md](./claude.md) for development guidelines.

```bash
# Install dependencies
npm install

# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint

# Build
npm run build
```

## Requirements

- React Native >= 0.72.0
- Node >= 18.0.0
- TypeScript >= 5.0.0

## Compatibility

| SDK Version | React Native | Expo SDK | Node |
|-------------|--------------|----------|------|
| 0.2.x       | 0.72+        | 50+      | 18+  |
| 0.1.x       | 0.72+        | 50+      | 18+  |

## License

MIT

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## Support

For issues and questions, please use the GitHub issue tracker.
