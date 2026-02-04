/**
 * Bitrise React Native SDK - Expo Config Plugin
 *
 * This plugin configures the Bitrise SDK for Expo managed workflow by:
 * 1. Injecting deployment keys into native configuration files
 * 2. Configuring server URLs for both iOS and Android
 * 3. Enabling the SDK to read configuration at runtime
 *
 * The plugin modifies:
 * - iOS: Info.plist
 * - Android: strings.xml
 *
 * @example
 * Add to your app.json or app.config.js:
 * ```json
 * {
 *   "expo": {
 *     "plugins": [
 *       ["@bitrise/react-native-sdk", {
 *         "ios": { "deploymentKey": "YOUR_IOS_KEY" },
 *         "android": { "deploymentKey": "YOUR_ANDROID_KEY" }
 *       }]
 *     ]
 *   }
 * }
 * ```
 */

import { ConfigPlugin, createRunOncePlugin } from 'expo/config-plugins'
import { withBitriseIos } from './withBitriseIos'
import { withBitriseAndroid } from './withBitriseAndroid'
import type { BitrisePluginOptions } from './types'

/**
 * Main Bitrise SDK config plugin.
 *
 * Orchestrates iOS and Android configuration modifications.
 * This plugin runs during `expo prebuild` to inject deployment keys
 * and server URLs into native configuration files.
 *
 * @param config - The Expo config object
 * @param options - Plugin configuration options
 * @returns Modified config with iOS and Android changes
 */
const withBitriseSDK: ConfigPlugin<BitrisePluginOptions> = (config, options = {}) => {
  // Apply iOS configuration
  config = withBitriseIos(config, options)

  // Apply Android configuration
  config = withBitriseAndroid(config, options)

  return config
}

// Package metadata for the plugin
const pkg = {
  name: '@bitrise/react-native-sdk',
  version: '1.0.0',
}

/**
 * Export the plugin wrapped in createRunOncePlugin to ensure it only runs once
 * even if added multiple times to the plugin array.
 */
export default createRunOncePlugin(withBitriseSDK, pkg.name, pkg.version)

// Export types for TypeScript users
export type { BitrisePluginOptions, PlatformConfig } from './types'

// Export individual plugins for advanced use cases
export { withBitriseIos, withBitriseAndroid }
