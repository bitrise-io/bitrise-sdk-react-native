"use strict";
/**
 * Expo config plugin for Android - modifies strings.xml with Bitrise configuration.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.withBitriseAndroid = void 0;
const config_plugins_1 = require("expo/config-plugins");
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
const withBitriseAndroid = (config, options) => {
    return (0, config_plugins_1.withStringsXml)(config, (config) => {
        var _a, _b;
        // Platform-specific config takes precedence over top-level config
        const deploymentKey = ((_a = options.android) === null || _a === void 0 ? void 0 : _a.deploymentKey) || options.deploymentKey;
        const serverUrl = ((_b = options.android) === null || _b === void 0 ? void 0 : _b.serverUrl) || options.serverUrl || 'https://api.bitrise.io';
        if (!deploymentKey) {
            throw new Error('[BitriseSDK] Android deployment key is required. ' +
                'Provide it via plugin options: { android: { deploymentKey: "YOUR_KEY" } } or { deploymentKey: "YOUR_KEY" }');
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
        ];
        // Merge with existing strings
        config.modResults = config_plugins_1.AndroidConfig.Strings.setStringItem(stringItems, config.modResults);
        return config;
    });
};
exports.withBitriseAndroid = withBitriseAndroid;
