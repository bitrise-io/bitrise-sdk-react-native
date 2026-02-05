/**
 * Expo config plugin for Android - modifies strings.xml with Bitrise configuration.
 */

import { ConfigPlugin, AndroidConfig, withStringsXml } from 'expo/config-plugins'
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
export const withBitriseAndroid: ConfigPlugin<BitrisePluginOptions> = (config, options) => {
  return withStringsXml(config, config => {
    // Platform-specific config takes precedence over top-level config
    const deploymentKey = options.android?.deploymentKey || options.deploymentKey
    const serverUrl = options.android?.serverUrl || options.serverUrl || 'https://api.bitrise.io'

    if (!deploymentKey) {
      throw new Error(
        '[BitriseSDK] Android deployment key is required. ' +
          'Provide it via plugin options: { android: { deploymentKey: "YOUR_KEY" } } or { deploymentKey: "YOUR_KEY" }'
      )
    }

    // Add Bitrise configuration to strings.xml
    // Using setStringItem to ensure proper XML structure
    const stringItems = [
      {
        $: { name: 'BitriseCodePushDeploymentKey', translatable: 'false' },
        _: deploymentKey,
      },
      {
        $: { name: 'BitriseCodePushServerURL', translatable: 'false' },
        _: serverUrl,
      },
    ]

    // Merge with existing strings
    config.modResults = AndroidConfig.Strings.setStringItem(stringItems, config.modResults)

    return config
  })
}
