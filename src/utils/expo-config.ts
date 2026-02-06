/**
 * Utility for reading native configuration values injected by the Expo config plugin.
 *
 * In Expo managed workflow, the config plugin injects deployment keys and server URLs
 * into native configuration files:
 * - iOS: Info.plist
 * - Android: strings.xml
 *
 * This utility provides methods to read these values at runtime.
 */

import { NativeModules, Platform } from 'react-native'

/**
 * ExpoConfig provides methods to read Bitrise configuration from native files.
 *
 * These values are injected by the Expo config plugin during `expo prebuild`.
 *
 * @example
 * ```typescript
 * import { ExpoConfig } from '@bitrise/react-native-sdk'
 *
 * const deploymentKey = ExpoConfig.getDeploymentKey()
 * const serverUrl = ExpoConfig.getServerUrl()
 *
 * if (deploymentKey) {
 *   BitriseSDK.configure({
 *     apiToken: 'your-token',
 *     appSlug: 'your-slug',
 *     deploymentKey, // Automatically read from native config
 *   })
 * }
 * ```
 */
export class ExpoConfig {
  /**
   * Get the deployment key from native configuration.
   *
   * This reads:
   * - iOS: `CodePushDeploymentKey` from Info.plist
   * - Android: `CodePushDeploymentKey` from strings.xml
   *
   * @returns The deployment key if configured, null otherwise
   */
  static getDeploymentKey(): string | null {
    if (Platform.OS === 'ios') {
      return this.getInfoPlistValue('CodePushDeploymentKey')
    } else if (Platform.OS === 'android') {
      return this.getAndroidStringResource('CodePushDeploymentKey')
    }
    return null
  }

  /**
   * Get the server URL from native configuration.
   *
   * This reads:
   * - iOS: `CodePushServerURL` from Info.plist
   * - Android: `CodePushServerURL` from strings.xml
   *
   * @returns The server URL if configured, null otherwise
   */
  static getServerUrl(): string | null {
    if (Platform.OS === 'ios') {
      return this.getInfoPlistValue('CodePushServerURL')
    } else if (Platform.OS === 'android') {
      return this.getAndroidStringResource('CodePushServerURL')
    }
    return null
  }

  /**
   * Read a value from iOS Info.plist.
   *
   * @param key - The key to read from Info.plist
   * @returns The value if it exists, null otherwise
   * @internal
   */
  private static getInfoPlistValue(key: string): string | null {
    try {
      // React Native exposes Info.plist values via NativeModules.RNBundle
      // However, this module may not be available in all React Native versions
      // so we need to handle it gracefully
      const RNBundle = NativeModules.RNBundle
      if (RNBundle && typeof RNBundle[key] === 'string') {
        return RNBundle[key]
      }

      // Fallback: try to access via constants (alternative approach)
      // Some React Native versions expose Info.plist differently
      const InfoPlist = NativeModules.InfoPlistReader
      if (InfoPlist && typeof InfoPlist[key] === 'string') {
        return InfoPlist[key]
      }

      return null
    } catch (error) {
      // Silently fail if we can't read from Info.plist
      // This is expected in bare React Native apps without Expo plugin
      return null
    }
  }

  /**
   * Read a string resource from Android strings.xml.
   *
   * @param key - The resource name to read
   * @returns The string value if it exists, null otherwise
   * @internal
   */
  private static getAndroidStringResource(key: string): string | null {
    try {
      // Use BitriseFileSystem native module which has methods to read string resources
      const BitriseFileSystem = NativeModules.BitriseFileSystem
      if (BitriseFileSystem && typeof BitriseFileSystem.getStringResource === 'function') {
        return BitriseFileSystem.getStringResource(key)
      }

      return null
    } catch (error) {
      // Silently fail if we can't read from strings.xml
      // This is expected in bare React Native apps without Expo plugin
      return null
    }
  }
}
