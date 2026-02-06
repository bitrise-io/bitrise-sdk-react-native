# Migration Guide: Bare React Native to Expo

This guide helps you migrate an existing Bitrise SDK implementation from bare React Native to Expo managed workflow.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Migration Steps](#migration-steps)
- [Configuration Changes](#configuration-changes)
- [Code Changes](#code-changes)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before starting the migration:

- [ ] Expo SDK 50 or later installed
- [ ] EAS CLI installed (`npm install -g eas-cli`)
- [ ] Bitrise SDK 0.1.0 or later
- [ ] Existing React Native app with Bitrise SDK
- [ ] Git repository with committed changes

## Migration Steps

### Step 1: Install Expo

If you're not already using Expo:

```bash
npx install-expo-modules@latest
```

This command:
- Installs Expo modules
- Updates native project files
- Configures auto-linking

### Step 2: Create Expo Configuration

Create `app.json` in your project root:

```json
{
  "expo": {
    "name": "Your App Name",
    "slug": "your-app-slug",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.yourcompany.yourapp"
    },
    "android": {
      "package": "com.yourcompany.yourapp"
    },
    "plugins": []
  }
}
```

### Step 3: Add Bitrise Config Plugin

Update `app.json` to include the Bitrise plugin:

```json
{
  "expo": {
    "name": "Your App Name",
    "slug": "your-app-slug",
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

**Important:** Use the same deployment keys you were using in your bare React Native setup.

### Step 4: Remove Manual Native Configuration

Since the Expo plugin now handles native configuration automatically, you can remove manual setup:

#### iOS

Remove from `Info.plist` (if you added them manually):
- `CodePushDeploymentKey`
- `CodePushServerURL`

The plugin will add these automatically during prebuild.

#### Android

Remove from `strings.xml` (if you added them manually):
- `CodePushDeploymentKey`
- `CodePushServerURL`

The plugin will add these automatically during prebuild.

### Step 5: Update SDK Initialization

**Before (Bare React Native):**
```typescript
import { BitriseSDK } from '@bitrise/react-native-sdk'

BitriseSDK.configure({
  apiToken: 'your-api-token',
  appSlug: 'your-app-slug',
  deploymentKey: 'your-deployment-key', // Manually specified
  serverUrl: 'https://api.bitrise.io'
})
```

**After (Expo):**
```typescript
import { BitriseSDK } from '@bitrise/react-native-sdk'

BitriseSDK.configure({
  apiToken: 'your-api-token',
  appSlug: 'your-app-slug'
  // deploymentKey automatically read from native config
  // serverUrl automatically read from native config
})
```

The deployment key and server URL are now automatically read from the native configuration injected by the plugin.

### Step 6: Run Prebuild

Generate native projects with Expo configuration:

```bash
npx expo prebuild --clean
```

This will:
- Generate `ios/` and `android/` directories
- Apply the Bitrise config plugin
- Inject deployment keys into native files
- Configure auto-linking

### Step 7: Verify Configuration

Check that the plugin correctly configured the native files:

**iOS:**
```bash
cat ios/YourApp/Info.plist | grep CodePush
```

**Android:**
```bash
cat android/app/src/main/res/values/strings.xml | grep CodePush
```

### Step 8: Test the App

```bash
# iOS
npx expo run:ios

# Android
npx expo run:android
```

Verify that:
- App launches successfully
- CodePush check works
- Updates download and install
- No runtime errors

## Configuration Changes

### Environment Variables

**Before:** Environment variables in `.env` files loaded manually

**After:** Use `app.config.js` for dynamic configuration:

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

### Build Configuration

**Before:** Native build scripts in `package.json`:
```json
{
  "scripts": {
    "ios": "react-native run-ios",
    "android": "react-native run-android"
  }
}
```

**After:** Expo build commands:
```json
{
  "scripts": {
    "ios": "expo run:ios",
    "android": "expo run:android",
    "prebuild": "expo prebuild"
  }
}
```

### CI/CD Changes

**Before:** Direct native builds in CI:
```yaml
- xcodebuild -workspace ios/App.xcworkspace ...
```

**After:** EAS Build or expo commands:
```yaml
- npx expo prebuild
- npx expo run:ios
```

Or use EAS Build:
```yaml
- eas build --profile production --platform all
```

## Code Changes

### No Code Changes Required

The good news: Your application code doesn't need to change! The Bitrise SDK API remains the same:

```typescript
// This code works in both bare and Expo
const update = await BitriseSDK.codePush.checkForUpdate()
if (update) {
  await update.download((progress) => {
    console.log(`Progress: ${progress.receivedBytes}/${progress.totalBytes}`)
  })
  await update.install(InstallMode.IMMEDIATE)
}
```

### Optional: Use ExpoConfig

You can optionally use the new `ExpoConfig` utility to read deployment keys:

```typescript
import { ExpoConfig } from '@bitrise/react-native-sdk'

const deploymentKey = ExpoConfig.getDeploymentKey()
const serverUrl = ExpoConfig.getServerUrl()

console.log('Configured with:', { deploymentKey, serverUrl })
```

## Testing

### Local Testing

1. **Clean build:**
   ```bash
   rm -rf ios android node_modules
   npm install
   npx expo prebuild
   ```

2. **Run on iOS:**
   ```bash
   npx expo run:ios
   ```

3. **Run on Android:**
   ```bash
   npx expo run:android
   ```

4. **Test CodePush flow:**
   - Check for updates
   - Download update
   - Install update
   - Verify app restarts with new version

### EAS Build Testing

1. **Configure EAS:**
   ```bash
   eas build:configure
   ```

2. **Create `eas.json`:**
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

3. **Build:**
   ```bash
   eas build --profile development --platform all
   ```

4. **Test on device:**
   ```bash
   eas build:run --profile development --platform ios
   ```

## Troubleshooting

### Issue: "BitriseFileSystem module not found"

**Cause:** Native modules not linked after migration

**Solution:**
```bash
npx expo prebuild --clean
npx expo run:ios  # or expo run:android
```

### Issue: Deployment key not working

**Cause:** Old deployment key still in native files

**Solution:**
```bash
# Remove old native directories
rm -rf ios android

# Regenerate with plugin
npx expo prebuild

# Verify configuration
cat ios/YourApp/Info.plist | grep CodePush
```

### Issue: App builds but CodePush fails

**Cause:** Deployment keys don't match server configuration

**Solution:**
1. Verify keys in `app.json` match your Bitrise dashboard
2. Check server URL is correct
3. Test with direct configuration:
   ```typescript
   BitriseSDK.configure({
     apiToken: '...',
     appSlug: '...',
     deploymentKey: 'test-key-directly',  // Test direct config
   })
   ```

### Issue: EAS Build fails

**Cause:** Environment variables not set

**Solution:**

Check `eas.json` includes deployment keys:
```json
{
  "build": {
    "production": {
      "env": {
        "BITRISE_IOS_DEPLOYMENT_KEY": "your-key",
        "BITRISE_ANDROID_DEPLOYMENT_KEY": "your-key"
      }
    }
  }
}
```

Or use EAS Secrets:
```bash
eas secret:create --name BITRISE_IOS_KEY --value "your-key"
```

### Issue: Metro bundler errors after migration

**Cause:** Stale cache

**Solution:**
```bash
# Clear Metro cache
npx expo start --clear

# Or
npm start -- --reset-cache
```

### Issue: Native modules version mismatch

**Cause:** Incompatible versions after migration

**Solution:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Rebuild native code
npx expo prebuild --clean
```

## Rollback Plan

If migration fails, you can rollback:

1. **Restore from Git:**
   ```bash
   git checkout HEAD -- .
   ```

2. **Remove Expo files:**
   ```bash
   rm -rf ios android app.json eas.json
   ```

3. **Reinstall dependencies:**
   ```bash
   rm -rf node_modules
   npm install
   ```

4. **Return to bare React Native:**
   ```bash
   npx react-native run-ios
   npx react-native run-android
   ```

## Post-Migration Checklist

After successful migration:

- [ ] App builds and runs on iOS
- [ ] App builds and runs on Android
- [ ] CodePush check for updates works
- [ ] CodePush download works
- [ ] CodePush install works
- [ ] App restarts with new bundle
- [ ] EAS Build works (if using)
- [ ] CI/CD pipeline updated
- [ ] Team members informed
- [ ] Documentation updated
- [ ] Old native configuration removed
- [ ] Git repository cleaned up

## Benefits of Migration

After migrating to Expo with the Bitrise SDK:

✅ **Automatic Configuration**
- No manual native code changes
- Plugin handles all native setup
- Consistent across team members

✅ **Environment Management**
- Easy environment-based configuration
- Dynamic deployment keys
- Secure secrets with EAS

✅ **Better Developer Experience**
- `expo prebuild` handles native setup
- Faster iterations
- Less context switching

✅ **Production Ready**
- EAS Build for reliable builds
- Over-the-air updates
- Professional deployment workflow

## Next Steps

1. **Update CI/CD**: Migrate build scripts to use Expo commands
2. **Team Training**: Ensure team understands new workflow
3. **Documentation**: Update internal docs with new setup
4. **Monitoring**: Watch for any issues in production
5. **Optimization**: Explore EAS Build features (build caching, etc.)

## Support

Need help with migration?

- GitHub Issues: https://github.com/bitrise-io/bitrise-sdk-react-native/issues
- Documentation: [expo-configuration.md](./expo-configuration.md)
- Example App: [example-expo/](../example-expo/)

## Additional Resources

- [Expo Prebuild Documentation](https://docs.expo.dev/workflow/prebuild/)
- [Expo Config Plugins](https://docs.expo.dev/guides/config-plugins/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Bitrise SDK API Reference](../README.md#api-reference)
