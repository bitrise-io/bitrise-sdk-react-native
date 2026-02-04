# Expo Configuration Guide

Complete guide for configuring the Bitrise React Native SDK in Expo managed workflow.

## Table of Contents

- [Basic Configuration](#basic-configuration)
- [Advanced Configuration](#advanced-configuration)
- [Environment-Based Configuration](#environment-based-configuration)
- [EAS Build Integration](#eas-build-integration)
- [Configuration Options](#configuration-options)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)

## Basic Configuration

### Simple Setup (Same Key for Both Platforms)

Use when you have a single deployment key for both iOS and Android:

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

**Pros:**
- Simple configuration
- Good for development/testing

**Cons:**
- Can't differentiate between platforms
- Limited flexibility for production

### Platform-Specific Configuration (Recommended)

Use different deployment keys for iOS and Android:

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

**Pros:**
- Platform-specific rollout control
- Better production setup
- Track metrics separately

**Cons:**
- Slightly more configuration

## Advanced Configuration

### Custom Server URL

If you're using a custom Bitrise server or proxy:

```json
{
  "expo": {
    "plugins": [
      [
        "@bitrise/react-native-sdk",
        {
          "ios": {
            "deploymentKey": "ios-key",
            "serverUrl": "https://custom.bitrise.server"
          },
          "android": {
            "deploymentKey": "android-key",
            "serverUrl": "https://custom.bitrise.server"
          }
        }
      ]
    ]
  }
}
```

### Default Server URL

If you omit `serverUrl`, it defaults to `https://api.bitrise.io`:

```json
{
  "expo": {
    "plugins": [
      [
        "@bitrise/react-native-sdk",
        {
          "ios": { "deploymentKey": "ios-key" },
          "android": { "deploymentKey": "android-key" }
        }
      ]
    ]
  }
}
```

## Environment-Based Configuration

### Using app.config.js

For different environments (development, staging, production), use `app.config.js`:

**Step 1:** Rename `app.json` to `app.config.js` (or create both)

**Step 2:** Export dynamic configuration:

```javascript
module.exports = ({ config }) => {
  const environment = process.env.APP_ENV || 'development'

  return {
    ...config,
    name: 'Bitrise SDK Example',
    slug: 'bitrise-sdk-example',
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
  }
}
```

**Step 3:** Set environment variables:

```bash
# Development
export BITRISE_IOS_DEPLOYMENT_KEY="dev-ios-key"
export BITRISE_ANDROID_DEPLOYMENT_KEY="dev-android-key"
export APP_ENV="development"

# Run prebuild
npx expo prebuild
```

### Environment-Specific Keys

```javascript
module.exports = ({ config }) => {
  const environment = process.env.APP_ENV || 'development'

  const deploymentKeys = {
    development: {
      ios: 'dev-ios-key',
      android: 'dev-android-key',
    },
    staging: {
      ios: 'staging-ios-key',
      android: 'staging-android-key',
    },
    production: {
      ios: 'prod-ios-key',
      android: 'prod-android-key',
    },
  }

  const keys = deploymentKeys[environment]

  return {
    ...config,
    plugins: [
      [
        '@bitrise/react-native-sdk',
        {
          ios: {
            deploymentKey: keys.ios,
            serverUrl: 'https://api.bitrise.io',
          },
          android: {
            deploymentKey: keys.android,
            serverUrl: 'https://api.bitrise.io',
          },
        },
      ],
    ],
  }
}
```

Usage:

```bash
APP_ENV=production npx expo prebuild
APP_ENV=staging npx expo prebuild
```

### dotenv Integration

**Step 1:** Install dotenv:

```bash
npm install --save-dev dotenv
```

**Step 2:** Create `.env` files:

`.env.development`:
```
BITRISE_IOS_DEPLOYMENT_KEY=dev-ios-key
BITRISE_ANDROID_DEPLOYMENT_KEY=dev-android-key
BITRISE_SERVER_URL=https://api.bitrise.io
```

`.env.production`:
```
BITRISE_IOS_DEPLOYMENT_KEY=prod-ios-key
BITRISE_ANDROID_DEPLOYMENT_KEY=prod-android-key
BITRISE_SERVER_URL=https://api.bitrise.io
```

**Step 3:** Load in `app.config.js`:

```javascript
require('dotenv').config({
  path: `.env.${process.env.APP_ENV || 'development'}`
})

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    [
      '@bitrise/react-native-sdk',
      {
        ios: {
          deploymentKey: process.env.BITRISE_IOS_DEPLOYMENT_KEY,
          serverUrl: process.env.BITRISE_SERVER_URL,
        },
        android: {
          deploymentKey: process.env.BITRISE_ANDROID_DEPLOYMENT_KEY,
          serverUrl: process.env.BITRISE_SERVER_URL,
        },
      },
    ],
  ],
})
```

## EAS Build Integration

### Basic EAS Configuration

Create or update `eas.json`:

```json
{
  "cli": {
    "version": ">= 5.9.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "BITRISE_IOS_DEPLOYMENT_KEY": "dev-ios-key",
        "BITRISE_ANDROID_DEPLOYMENT_KEY": "dev-android-key"
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "BITRISE_IOS_DEPLOYMENT_KEY": "preview-ios-key",
        "BITRISE_ANDROID_DEPLOYMENT_KEY": "preview-android-key"
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

### Using EAS Secrets

For sensitive keys, use EAS Secrets instead of plain text:

**Step 1:** Create secrets:

```bash
eas secret:create --scope project --name BITRISE_IOS_DEPLOYMENT_KEY_PROD --value "your-ios-key"
eas secret:create --scope project --name BITRISE_ANDROID_DEPLOYMENT_KEY_PROD --value "your-android-key"
```

**Step 2:** Reference in `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "BITRISE_IOS_DEPLOYMENT_KEY": "$BITRISE_IOS_DEPLOYMENT_KEY_PROD",
        "BITRISE_ANDROID_DEPLOYMENT_KEY": "$BITRISE_ANDROID_DEPLOYMENT_KEY_PROD"
      }
    }
  }
}
```

### Multiple Build Variants

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "env": {
        "BITRISE_IOS_DEPLOYMENT_KEY": "dev-ios-key",
        "BITRISE_ANDROID_DEPLOYMENT_KEY": "dev-android-key"
      }
    },
    "staging-ios": {
      "extends": "staging",
      "ios": {
        "simulator": false
      },
      "env": {
        "BITRISE_IOS_DEPLOYMENT_KEY": "staging-ios-key"
      }
    },
    "staging-android": {
      "extends": "staging",
      "android": {
        "buildType": "apk"
      },
      "env": {
        "BITRISE_ANDROID_DEPLOYMENT_KEY": "staging-android-key"
      }
    },
    "production": {
      "env": {
        "BITRISE_IOS_DEPLOYMENT_KEY": "$BITRISE_IOS_KEY_PROD",
        "BITRISE_ANDROID_DEPLOYMENT_KEY": "$BITRISE_ANDROID_KEY_PROD"
      }
    }
  }
}
```

Build with:

```bash
eas build --profile staging-ios --platform ios
eas build --profile staging-android --platform android
eas build --profile production --platform all
```

## Configuration Options

### BitrisePluginOptions

```typescript
interface BitrisePluginOptions {
  // Top-level configuration (fallback if platform-specific not provided)
  deploymentKey?: string
  serverUrl?: string

  // iOS-specific configuration (takes precedence)
  ios?: {
    deploymentKey: string
    serverUrl?: string
  }

  // Android-specific configuration (takes precedence)
  android?: {
    deploymentKey: string
    serverUrl?: string
  }
}
```

### Precedence Order

1. **Platform-specific config** (e.g., `ios.deploymentKey`)
2. **Top-level config** (e.g., `deploymentKey`)
3. **Default values** (e.g., `serverUrl` defaults to `https://api.bitrise.io`)

Example:

```json
{
  "deploymentKey": "fallback-key",
  "serverUrl": "https://fallback.server",
  "ios": {
    "deploymentKey": "ios-key",
    "serverUrl": "https://ios-server"
  },
  "android": {
    "deploymentKey": "android-key"
  }
}
```

Results in:
- iOS: `deploymentKey="ios-key"`, `serverUrl="https://ios-server"`
- Android: `deploymentKey="android-key"`, `serverUrl="https://fallback.server"`

## Best Practices

### 1. Use Platform-Specific Keys

Always use different deployment keys for iOS and Android in production:

```json
{
  "ios": { "deploymentKey": "ios-prod-key" },
  "android": { "deploymentKey": "android-prod-key" }
}
```

### 2. Never Commit Sensitive Keys

Add keys to `.gitignore`:

```
.env*
!.env.example
```

Provide `.env.example`:

```
BITRISE_IOS_DEPLOYMENT_KEY=your-ios-key-here
BITRISE_ANDROID_DEPLOYMENT_KEY=your-android-key-here
```

### 3. Use EAS Secrets for Production

Store production keys as EAS Secrets, not in plain text.

### 4. Separate Environments

Use different keys for development, staging, and production:

```
- dev-ios-key, dev-android-key
- staging-ios-key, staging-android-key
- prod-ios-key, prod-android-key
```

### 5. Document Your Configuration

Add comments in `app.config.js`:

```javascript
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    [
      '@bitrise/react-native-sdk',
      {
        // Development keys - safe to commit
        // Production keys are set via EAS Secrets
        ios: {
          deploymentKey: process.env.BITRISE_IOS_DEPLOYMENT_KEY || 'dev-ios-key',
        },
        android: {
          deploymentKey: process.env.BITRISE_ANDROID_DEPLOYMENT_KEY || 'dev-android-key',
        },
      },
    ],
  ],
})
```

### 6. Validate Configuration

Add validation to catch errors early:

```javascript
module.exports = ({ config }) => {
  const iosKey = process.env.BITRISE_IOS_DEPLOYMENT_KEY
  const androidKey = process.env.BITRISE_ANDROID_DEPLOYMENT_KEY

  if (!iosKey || !androidKey) {
    throw new Error(
      'Missing deployment keys. Set BITRISE_IOS_DEPLOYMENT_KEY and BITRISE_ANDROID_DEPLOYMENT_KEY'
    )
  }

  return {
    ...config,
    plugins: [
      [
        '@bitrise/react-native-sdk',
        {
          ios: { deploymentKey: iosKey },
          android: { deploymentKey: androidKey },
        },
      ],
    ],
  }
}
```

## Common Patterns

### Pattern 1: Multi-Stage Deployment

```javascript
const DEPLOYMENT_KEYS = {
  development: {
    ios: 'dev-ios-key',
    android: 'dev-android-key',
  },
  staging: {
    ios: process.env.STAGING_IOS_KEY,
    android: process.env.STAGING_ANDROID_KEY,
  },
  production: {
    ios: process.env.PROD_IOS_KEY,
    android: process.env.PROD_ANDROID_KEY,
  },
}

module.exports = ({ config }) => {
  const env = process.env.APP_ENV || 'development'
  const keys = DEPLOYMENT_KEYS[env]

  return {
    ...config,
    extra: { environment: env },
    plugins: [
      [
        '@bitrise/react-native-sdk',
        {
          ios: { deploymentKey: keys.ios },
          android: { deploymentKey: keys.android },
        },
      ],
    ],
  }
}
```

### Pattern 2: Feature Flags

```javascript
module.exports = ({ config }) => {
  const codePushEnabled = process.env.CODEPUSH_ENABLED !== 'false'

  const plugins = [
    // ... other plugins
  ]

  if (codePushEnabled) {
    plugins.push([
      '@bitrise/react-native-sdk',
      {
        ios: { deploymentKey: process.env.BITRISE_IOS_KEY },
        android: { deploymentKey: process.env.BITRISE_ANDROID_KEY },
      },
    ])
  }

  return {
    ...config,
    plugins,
  }
}
```

### Pattern 3: Shared Configuration

```javascript
// config/bitrise.config.js
module.exports = {
  serverUrl: 'https://api.bitrise.io',
  deploymentKeys: {
    development: {
      ios: 'dev-ios-key',
      android: 'dev-android-key',
    },
    production: {
      ios: process.env.PROD_IOS_KEY,
      android: process.env.PROD_ANDROID_KEY,
    },
  },
}

// app.config.js
const bitriseConfig = require('./config/bitrise.config')

module.exports = ({ config }) => {
  const env = process.env.APP_ENV || 'development'
  const keys = bitriseConfig.deploymentKeys[env]

  return {
    ...config,
    plugins: [
      [
        '@bitrise/react-native-sdk',
        {
          ios: {
            deploymentKey: keys.ios,
            serverUrl: bitriseConfig.serverUrl,
          },
          android: {
            deploymentKey: keys.android,
            serverUrl: bitriseConfig.serverUrl,
          },
        },
      ],
    ],
  }
}
```

## Verification

After configuring the plugin, verify it's working:

**Step 1:** Run prebuild:

```bash
npx expo prebuild --clean
```

**Step 2:** Check generated files:

iOS:
```bash
cat ios/YourApp/Info.plist | grep BitriseCodePush
```

Expected output:
```xml
<key>BitriseCodePushDeploymentKey</key>
<string>your-ios-key</string>
<key>BitriseCodePushServerURL</key>
<string>https://api.bitrise.io</string>
```

Android:
```bash
cat android/app/src/main/res/values/strings.xml | grep BitriseCodePush
```

Expected output:
```xml
<string name="BitriseCodePushDeploymentKey" translatable="false">your-android-key</string>
<string name="BitriseCodePushServerURL" translatable="false">https://api.bitrise.io</string>
```

**Step 3:** Test runtime configuration:

```typescript
import { ExpoConfig } from '@bitrise/react-native-sdk'

const deploymentKey = ExpoConfig.getDeploymentKey()
const serverUrl = ExpoConfig.getServerUrl()

console.log('Deployment Key:', deploymentKey)
console.log('Server URL:', serverUrl)
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/bitrise-io/bitrise-sdk-react-native/issues
- Documentation: https://github.com/bitrise-io/bitrise-sdk-react-native#readme
- Plugin README: [plugin/README.md](../plugin/README.md)
