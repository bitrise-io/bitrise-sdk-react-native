/**
 * Expo config plugin for Android - modifies strings.xml with Bitrise configuration.
 */
import { ConfigPlugin } from 'expo/config-plugins'
import type { BitrisePluginOptions } from './types'
/**
 * Config plugin that adds Bitrise CodePush configuration to Android strings.xml.
 *
 * This plugin:
 * 1. Reads deployment key from plugin options (android.deploymentKey or top-level deploymentKey)
 * 2. Reads server URL from plugin options (android.serverUrl or top-level serverUrl)
 * 3. Adds BitriseCodePushDeploymentKey to strings.xml (non-translatable)
 * 4. Adds BitriseCodePushServerURL to strings.xml (non-translatable)
 *
 * The deployment key is required. If not provided, an error is thrown.
 *
 * @param config - The Expo config object
 * @param options - Plugin configuration options
 * @returns Modified config with strings.xml changes
 * @throws Error if deployment key is not provided
 */
export declare const withBitriseAndroid: ConfigPlugin<BitrisePluginOptions>
//# sourceMappingURL=withBitriseAndroid.d.ts.map
