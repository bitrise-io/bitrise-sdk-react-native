/**
 * Configuration options for the Bitrise React Native SDK Expo config plugin.
 */
/**
 * Platform-specific configuration for iOS or Android.
 */
export interface PlatformConfig {
  /**
   * The deployment key for CodePush updates.
   * This key identifies your app and environment (staging/production) on Bitrise.
   */
  deploymentKey: string
  /**
   * The Bitrise server URL.
   * @default "https://api.bitrise.io"
   */
  serverUrl?: string
}
/**
 * Bitrise SDK Expo config plugin options.
 *
 * You can provide either:
 * 1. Simple format: `deploymentKey` (same for both platforms)
 * 2. Platform-specific format: `ios` and `android` objects
 *
 * @example
 * Simple format (same key for both platforms):
 * ```json
 * {
 *   "plugins": [
 *     ["@bitrise/react-native-sdk", {
 *       "deploymentKey": "YOUR_KEY",
 *       "serverUrl": "https://api.bitrise.io"
 *     }]
 *   ]
 * }
 * ```
 *
 * @example
 * Platform-specific format (recommended):
 * ```json
 * {
 *   "plugins": [
 *     ["@bitrise/react-native-sdk", {
 *       "ios": {
 *         "deploymentKey": "YOUR_IOS_KEY",
 *         "serverUrl": "https://api.bitrise.io"
 *       },
 *       "android": {
 *         "deploymentKey": "YOUR_ANDROID_KEY",
 *         "serverUrl": "https://api.bitrise.io"
 *       }
 *     }]
 *   ]
 * }
 * ```
 */
export interface BitrisePluginOptions {
  /**
   * iOS-specific configuration.
   * If provided, takes precedence over top-level `deploymentKey` for iOS.
   */
  ios?: PlatformConfig
  /**
   * Android-specific configuration.
   * If provided, takes precedence over top-level `deploymentKey` for Android.
   */
  android?: PlatformConfig
  /**
   * Deployment key used for both platforms if platform-specific keys are not provided.
   */
  deploymentKey?: string
  /**
   * Server URL used for both platforms if platform-specific URLs are not provided.
   * @default "https://api.bitrise.io"
   */
  serverUrl?: string
}
//# sourceMappingURL=types.d.ts.map
