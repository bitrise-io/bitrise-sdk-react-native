/**
 * Dynamic Expo configuration with environment variable support
 *
 * To use environment-based configuration, rename this file from app.config.js.example
 * to app.config.js and remove app.json
 */

module.exports = ({ config }) => {
  return {
    ...config,
    name: 'Bitrise SDK Example',
    slug: 'bitrise-sdk-expo-example',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'io.bitrise.sdk.example',
    },
    android: {
      package: 'io.bitrise.sdk.example',
    },
    plugins: [
      [
        '@bitrise/react-native-sdk',
        {
          ios: {
            deploymentKey: process.env.BITRISE_IOS_DEPLOYMENT_KEY || 'test-ios-deployment-key',
            serverUrl: process.env.BITRISE_SERVER_URL || 'https://api.bitrise.io',
          },
          android: {
            deploymentKey: process.env.BITRISE_ANDROID_DEPLOYMENT_KEY || 'test-android-deployment-key',
            serverUrl: process.env.BITRISE_SERVER_URL || 'https://api.bitrise.io',
          },
        },
      ],
    ],
  }
}
