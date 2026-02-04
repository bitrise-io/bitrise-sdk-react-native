# Bitrise React Native SDK - Expo Config Plugin

Expo config plugin for the Bitrise React Native SDK. This plugin automatically configures your Expo managed workflow app to work with Bitrise CodePush.

## What does this plugin do?

During `expo prebuild`, this plugin:

1. **iOS**: Adds `BitriseCodePushDeploymentKey` and `BitriseCodePushServerURL` to `Info.plist`
2. **Android**: Adds `BitriseCodePushDeploymentKey` and `BitriseCodePushServerURL` to `strings.xml`
3. Enables the SDK to automatically read these values at runtime

## Installation

This plugin is included with `@bitrise/react-native-sdk`. No separate installation needed.

```bash
npm install @bitrise/react-native-sdk
```

## Configuration

Add the plugin to your `app.json` or `app.config.js`:

### Simple Format (Same Key for Both Platforms)

```json
{
  "expo": {
    "plugins": [
      [
        "@bitrise/react-native-sdk",
        {
          "deploymentKey": "YOUR_DEPLOYMENT_KEY",
          "serverUrl": "https://api.bitrise.io"
        }
      ]
    ]
  }
}
```

### Platform-Specific Format (Recommended)

```json
{
  "expo": {
    "plugins": [
      [
        "@bitrise/react-native-sdk",
        {
          "ios": {
            "deploymentKey": "YOUR_IOS_DEPLOYMENT_KEY",
            "serverUrl": "https://api.bitrise.io"
          },
          "android": {
            "deploymentKey": "YOUR_ANDROID_DEPLOYMENT_KEY",
            "serverUrl": "https://api.bitrise.io"
          }
        }
      ]
    ]
  }
}
```

### Dynamic Configuration with Environment Variables

Use `app.config.js` for environment-based configuration:

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

## Configuration Options

### `BitrisePluginOptions`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `deploymentKey` | `string` | Yes* | Deployment key used for both platforms if platform-specific keys are not provided |
| `serverUrl` | `string` | No | Server URL (default: `https://api.bitrise.io`) |
| `ios` | `PlatformConfig` | No | iOS-specific configuration (takes precedence over top-level) |
| `android` | `PlatformConfig` | No | Android-specific configuration (takes precedence over top-level) |

\* Required unless `ios.deploymentKey` and `android.deploymentKey` are both provided

### `PlatformConfig`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `deploymentKey` | `string` | Yes | Platform-specific deployment key |
| `serverUrl` | `string` | No | Platform-specific server URL (default: `https://api.bitrise.io`) |

## Usage

After configuring the plugin, run prebuild:

```bash
npx expo prebuild
```

This generates the native `ios/` and `android/` directories with Bitrise configuration injected.

Then initialize the SDK in your app:

```typescript
import { BitriseSDK } from '@bitrise/react-native-sdk'

BitriseSDK.configure({
  apiToken: 'your-api-token',
  appSlug: 'your-app-slug',
  // deploymentKey is automatically read from native config
})
```

## How it Works

1. You configure the plugin in `app.json` with your deployment keys
2. `expo prebuild` runs and the plugin modifies native files:
   - **iOS**: Adds keys to `Info.plist`
   - **Android**: Adds keys to `strings.xml`
3. At runtime, the SDK reads these values automatically
4. You don't need to provide `deploymentKey` when calling `BitriseSDK.configure()`

## Building with EAS Build

Configure `eas.json`:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
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

Then build:

```bash
eas build --profile production --platform all
```

## Troubleshooting

### "BitriseFileSystem module not found"

Run prebuild again with clean flag:

```bash
npx expo prebuild --clean
```

### "Deployment key is required" error

Ensure your `app.json` or `app.config.js` has the plugin configured with a `deploymentKey`:

```json
{
  "expo": {
    "plugins": [
      [
        "@bitrise/react-native-sdk",
        { "deploymentKey": "YOUR_KEY" }
      ]
    ]
  }
}
```

### Changes not taking effect

After modifying plugin configuration:

1. Clean the native directories: `rm -rf ios android`
2. Run prebuild again: `npx expo prebuild`
3. Rebuild your app

## Advanced Usage

### Using Individual Plugins

You can use the iOS and Android plugins separately:

```javascript
import { withBitriseIos, withBitriseAndroid } from '@bitrise/react-native-sdk/plugin'

// In your custom config plugin
export default function myCustomPlugin(config, options) {
  // Only apply iOS configuration
  config = withBitriseIos(config, {
    ios: { deploymentKey: options.iosKey }
  })

  return config
}
```

## Requirements

- Expo SDK 50 or later
- React Native 0.72 or later
- Node.js 18+

## Compatibility

✅ **Supported:**
- Expo Development Builds
- EAS Build
- Bare workflow (with `expo prebuild`)

❌ **Not Supported:**
- Expo Go (requires custom native code)

## Support

For issues or questions:
- GitHub Issues: https://github.com/bitrise-io/bitrise-sdk-react-native/issues
- Documentation: https://github.com/bitrise-io/bitrise-sdk-react-native#readme
