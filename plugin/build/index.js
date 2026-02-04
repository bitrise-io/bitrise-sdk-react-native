"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.withBitriseAndroid = exports.withBitriseIos = void 0;
const config_plugins_1 = require("expo/config-plugins");
const withBitriseIos_1 = require("./withBitriseIos");
Object.defineProperty(exports, "withBitriseIos", { enumerable: true, get: function () { return withBitriseIos_1.withBitriseIos; } });
const withBitriseAndroid_1 = require("./withBitriseAndroid");
Object.defineProperty(exports, "withBitriseAndroid", { enumerable: true, get: function () { return withBitriseAndroid_1.withBitriseAndroid; } });
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
const withBitriseSDK = (config, options = {}) => {
    // Apply iOS configuration
    config = (0, withBitriseIos_1.withBitriseIos)(config, options);
    // Apply Android configuration
    config = (0, withBitriseAndroid_1.withBitriseAndroid)(config, options);
    return config;
};
// Package metadata for the plugin
const pkg = {
    name: '@bitrise/react-native-sdk',
    version: '1.0.0',
};
/**
 * Export the plugin wrapped in createRunOncePlugin to ensure it only runs once
 * even if added multiple times to the plugin array.
 */
exports.default = (0, config_plugins_1.createRunOncePlugin)(withBitriseSDK, pkg.name, pkg.version);
