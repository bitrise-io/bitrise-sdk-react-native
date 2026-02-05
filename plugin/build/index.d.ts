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
import { ConfigPlugin } from 'expo/config-plugins'
import { withBitriseIos } from './withBitriseIos'
import { withBitriseAndroid } from './withBitriseAndroid'
import type { BitrisePluginOptions } from './types'
/**
 * Export the plugin wrapped in createRunOncePlugin to ensure it only runs once
 * even if added multiple times to the plugin array.
 */
declare const _default: ConfigPlugin<BitrisePluginOptions>
export default _default
export type { BitrisePluginOptions, PlatformConfig } from './types'
export { withBitriseIos, withBitriseAndroid }
//# sourceMappingURL=index.d.ts.map
