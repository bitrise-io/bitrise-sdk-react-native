import type { BitriseConfig } from '../types/config'
import { ConfigurationError } from '../types/errors'
import { CodePush } from '../codepush/CodePush'
import { RollbackManager } from '../codepush/RollbackManager'
import { MetricsClient } from '../metrics/MetricsClient'
import { getAppVersion } from '../utils/platform'
import { ExpoConfig } from '../utils/expo-config'

/**
 * Main SDK class for Bitrise integration
 */
export class BitriseSDK {
  private static config: BitriseConfig | null = null
  private static _codePush: CodePush | null = null

  /**
   * Configure the Bitrise SDK
   *
   * @param config - Configuration options
   * @throws {ConfigurationError} If configuration is invalid
   *
   * @example
   * ```typescript
   * BitriseSDK.configure({
   *   apiToken: 'your-token',
   *   appSlug: 'your-app-slug'
   * })
   * ```
   *
   * @example
   * Expo managed workflow (deployment key automatically read from native config):
   * ```typescript
   * BitriseSDK.configure({
   *   apiToken: 'your-token',
   *   appSlug: 'your-app-slug'
   *   // deploymentKey automatically read from Info.plist/strings.xml
   * })
   * ```
   */
  static configure(config: BitriseConfig): void {
    // Auto-read deployment key and server URL from native config (Expo plugin)
    // if not explicitly provided in the config
    const deploymentKey = config.deploymentKey ?? ExpoConfig.getDeploymentKey() ?? undefined
    const serverUrl = config.serverUrl ?? ExpoConfig.getServerUrl() ?? 'https://api.bitrise.io'

    // Create final config with auto-read values
    const finalConfig: BitriseConfig = {
      ...config,
      deploymentKey,
      apiEndpoint: config.apiEndpoint ?? 'https://api.bitrise.io/v0.1',
      serverUrl,
    }

    this.validateConfig(finalConfig)
    this.config = finalConfig

    // Reset CodePush instance when config changes
    this._codePush = null

    // Initialize MetricsClient if deployment key is provided
    if (deploymentKey && serverUrl) {
      // Get or generate client ID
      // Note: This uses a session-based UUID. Apps can provide a persistent ID
      // by calling BitriseClient.setClientId() after SDK initialization.
      const appVersion = getAppVersion()
      const clientId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`
      MetricsClient.initialize(serverUrl, deploymentKey, clientId, appVersion)
    }

    // Check for pending rollback on app start
    // This handles cases where the app was terminated while a rollback timer was active
    RollbackManager.getInstance()
      .checkPendingRollback()
      .catch(error => {
        console.error('[CodePush] Failed to check pending rollback:', error)
      })
  }

  /**
   * Get the CodePush instance
   */
  static get codePush(): CodePush {
    if (!this._codePush) {
      this._codePush = new CodePush(this.getConfig())
    }
    return this._codePush
  }

  /**
   * Get the current configuration
   * @throws {ConfigurationError} If SDK is not configured
   */
  static getConfig(): BitriseConfig {
    if (!this.config) {
      throw new ConfigurationError('SDK not configured. Call BitriseSDK.configure() first.')
    }
    return this.config
  }

  private static validateConfig(config: BitriseConfig): void {
    if (!config.apiToken || config.apiToken.trim().length === 0) {
      throw new ConfigurationError('apiToken is required and cannot be empty')
    }

    if (!config.appSlug || config.appSlug.trim().length === 0) {
      throw new ConfigurationError('appSlug is required and cannot be empty')
    }

    // Validate deployment key if provided (should be non-empty string)
    if (config.deploymentKey !== undefined) {
      if (typeof config.deploymentKey !== 'string' || config.deploymentKey.trim().length === 0) {
        throw new ConfigurationError('deploymentKey must be a non-empty string')
      }
    }
  }
}
