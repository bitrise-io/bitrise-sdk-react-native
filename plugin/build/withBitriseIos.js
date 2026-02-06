"use strict";
/**
 * Expo config plugin for iOS - modifies Info.plist with Bitrise configuration.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.withBitriseIos = void 0;
const config_plugins_1 = require("expo/config-plugins");
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
const withBitriseIos = (config, options) => {
    return (0, config_plugins_1.withInfoPlist)(config, (config) => {
        var _a, _b;
        // Platform-specific config takes precedence over top-level config
        const deploymentKey = ((_a = options.ios) === null || _a === void 0 ? void 0 : _a.deploymentKey) || options.deploymentKey;
        const serverUrl = ((_b = options.ios) === null || _b === void 0 ? void 0 : _b.serverUrl) || options.serverUrl || 'https://api.bitrise.io';
        if (!deploymentKey) {
            throw new Error('[BitriseSDK] iOS deployment key is required. ' +
                'Provide it via plugin options: { ios: { deploymentKey: "YOUR_KEY" } } or { deploymentKey: "YOUR_KEY" }');
        }
        // Add Bitrise configuration to Info.plist
        config.modResults.CodePushDeploymentKey = deploymentKey;
        config.modResults.CodePushServerURL = serverUrl;
        return config;
    });
};
exports.withBitriseIos = withBitriseIos;
