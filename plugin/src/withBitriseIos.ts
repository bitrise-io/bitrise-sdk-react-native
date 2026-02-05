/**
 * Expo config plugin for iOS - modifies Info.plist with Bitrise configuration.
 */

import { ConfigPlugin, withInfoPlist } from 'expo/config-plugins'
import type { BitrisePluginOptions } from './types'

/**
 * Config plugin that adds Bitrise CodePush configuration to iOS Info.plist.
 *
 * This plugin:
 * 1. Reads deployment key from plugin options (ios.deploymentKey or top-level deploymentKey)
 * 2. Reads server URL from plugin options (ios.serverUrl or top-level serverUrl)
 * 3. Adds BitriseCodePushDeploymentKey to Info.plist
 * 4. Adds BitriseCodePushServerURL to Info.plist
 *
 * The deployment key is required. If not provided, an error is thrown.
 *
 * @param config - The Expo config object
 * @param options - Plugin configuration options
 * @returns Modified config with Info.plist changes
 * @throws Error if deployment key is not provided
 */
export const withBitriseIos: ConfigPlugin<BitrisePluginOptions> = (config, options) => {
  return withInfoPlist(config, config => {
    // Platform-specific config takes precedence over top-level config
    const deploymentKey = options.ios?.deploymentKey || options.deploymentKey
    const serverUrl = options.ios?.serverUrl || options.serverUrl || 'https://api.bitrise.io'

    if (!deploymentKey) {
      throw new Error(
        '[BitriseSDK] iOS deployment key is required. ' +
          'Provide it via plugin options: { ios: { deploymentKey: "YOUR_KEY" } } or { deploymentKey: "YOUR_KEY" }'
      )
    }

    // Add Bitrise configuration to Info.plist
    config.modResults.BitriseCodePushDeploymentKey = deploymentKey
    config.modResults.BitriseCodePushServerURL = serverUrl

    return config
  })
}
