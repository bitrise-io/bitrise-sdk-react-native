/**
 * Expo config plugin for iOS - modifies Info.plist with Bitrise configuration.
 */
import { ConfigPlugin } from 'expo/config-plugins'
import type { BitrisePluginOptions } from './types'
/**
 * Config plugin that adds Bitrise CodePush configuration to iOS Info.plist.
 *
 * This plugin:
 * 1. Reads deployment key from plugin options (ios.deploymentKey or top-level deploymentKey)
 * 2. Reads server URL from plugin options (ios.serverUrl or top-level serverUrl)
 * 3. Adds CodePushDeploymentKey to Info.plist
 * 4. Adds CodePushServerURL to Info.plist
 *
 * The deployment key is required. If not provided, an error is thrown.
 *
 * @param config - The Expo config object
 * @param options - Plugin configuration options
 * @returns Modified config with Info.plist changes
 * @throws Error if deployment key is not provided
 */
export declare const withBitriseIos: ConfigPlugin<BitrisePluginOptions>
//# sourceMappingURL=withBitriseIos.d.ts.map
