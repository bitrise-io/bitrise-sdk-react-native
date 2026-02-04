import type { BitriseConfig } from '../types/config'
import type {
  RemotePackage,
  SyncOptions,
  Configuration,
  Package,
} from '../types/package'
import { SyncStatus, UpdateState } from '../types/enums'
import { ConfigurationError } from '../types/errors'
import { BitriseClient } from '../network/BitriseClient'
import { PackageStorage } from '../storage/PackageStorage'
import { getAppVersion } from '../utils/platform'

/**
 * CodePush functionality for over-the-air updates
 * Compatible with react-native-code-push API
 */
export class CodePush {
  private client: BitriseClient | null = null
  private config: Configuration | null = null
  private notifyAppReadyCalled = false

  constructor(private readonly bitriseConfig: BitriseConfig) {}

  /**
   * Get or create the Bitrise client
   */
  private getClient(): BitriseClient {
    if (!this.client) {
      if (!this.bitriseConfig.deploymentKey) {
        throw new ConfigurationError(
          'deploymentKey is required for CodePush operations. Add it to BitriseSDK.configure()'
        )
      }
      const serverUrl = this.bitriseConfig.serverUrl || 'https://api.bitrise.io'
      const appVersion = getAppVersion()
      this.client = new BitriseClient(serverUrl, this.bitriseConfig.deploymentKey, appVersion)
    }
    return this.client
  }

  /**
   * Check for available updates from Bitrise Release Management
   *
   * @param deploymentKey - Optional deployment key to override configured key
   * @returns Promise resolving to RemotePackage or null if no update available
   *
   * @example
   * ```typescript
   * const update = await codePush.checkForUpdate()
   * if (update) {
   *   console.log('Update available:', update.label)
   * }
   * ```
   */
  async checkForUpdate(deploymentKey?: string): Promise<RemotePackage | null> {
    // Use custom deployment key if provided
    const client = deploymentKey
      ? new BitriseClient(
          this.bitriseConfig.serverUrl || 'https://api.bitrise.io',
          deploymentKey,
          getAppVersion()
        )
      : this.getClient()

    // Get current package hash
    const currentPackage = await PackageStorage.getCurrentPackage()
    const currentHash = currentPackage?.packageHash

    // Check for update
    return await client.checkForUpdate(currentHash)
  }

  /**
   * Get the current SDK configuration
   *
   * @returns Configuration object
   *
   * @example
   * ```typescript
   * const config = codePush.getConfiguration()
   * console.log('App version:', config.appVersion)
   * ```
   */
  getConfiguration(): Configuration {
    if (!this.config) {
      if (!this.bitriseConfig.deploymentKey) {
        throw new ConfigurationError(
          'deploymentKey is required. Add it to BitriseSDK.configure()'
        )
      }

      this.config = {
        appVersion: getAppVersion(),
        deploymentKey: this.bitriseConfig.deploymentKey,
        serverUrl: this.bitriseConfig.serverUrl || 'https://api.bitrise.io',
      }
    }
    return this.config
  }

  /**
   * Get metadata about an installed update
   *
   * @param updateState - Which update to get (RUNNING, PENDING, or LATEST)
   * @returns Promise resolving to Package or null
   *
   * @example
   * ```typescript
   * const current = await codePush.getUpdateMetadata(UpdateState.RUNNING)
   * const pending = await codePush.getUpdateMetadata(UpdateState.PENDING)
   * ```
   */
  async getUpdateMetadata(updateState?: UpdateState): Promise<Package | null> {
    const state = updateState ?? UpdateState.RUNNING

    switch (state) {
      case UpdateState.RUNNING:
        return await PackageStorage.getCurrentPackage()

      case UpdateState.PENDING:
        return await PackageStorage.getPendingPackage()

      case UpdateState.LATEST:
        // Return pending if available, otherwise current
        const pending = await PackageStorage.getPendingPackage()
        if (pending) {
          return pending
        }
        return await PackageStorage.getCurrentPackage()

      default:
        return null
    }
  }

  /**
   * Get the currently installed package
   * @deprecated Use getUpdateMetadata(UpdateState.LATEST) instead
   */
  async getCurrentPackage(): Promise<Package | null> {
    return this.getUpdateMetadata(UpdateState.LATEST)
  }

  /**
   * Synchronize the app with the latest update
   * Compatible with react-native-code-push sync() method
   *
   * @param options - Sync options
   * @returns Promise resolving to SyncStatus
   *
   * @example
   * ```typescript
   * const status = await codePush.sync({
   *   installMode: InstallMode.ON_NEXT_RESTART
   * })
   * ```
   */
  async sync(options?: SyncOptions): Promise<SyncStatus> {
    // TODO: Implement sync logic in Phase 4
    return SyncStatus.UP_TO_DATE
  }

  /**
   * Notify the SDK that the app is ready
   * Should be called when the app has successfully launched
   *
   * Compatible with react-native-code-push notifyAppReady() method
   *
   * @example
   * ```typescript
   * codePush.notifyAppReady()
   * ```
   */
  notifyAppReady(): void {
    // Ensure this is only called once per instance
    if (this.notifyAppReadyCalled) {
      return
    }
    this.notifyAppReadyCalled = true

    // TODO: Implement app ready notification in Phase 4
    // This should:
    // 1. Mark current package as successfully installed
    // 2. Clear failed installation flag
    // 3. Report to Bitrise server (metrics)
  }

  /**
   * Restart the app to apply a pending update
   *
   * @param onlyIfUpdateIsPending - Only restart if an update is pending (default: false)
   *
   * @example
   * ```typescript
   * // Restart immediately
   * codePush.restartApp()
   *
   * // Only restart if update is pending
   * codePush.restartApp(true)
   * ```
   */
  async restartApp(onlyIfUpdateIsPending?: boolean): Promise<void> {
    // Check if pending update exists (if requested)
    if (onlyIfUpdateIsPending) {
      const pendingPackage = await PackageStorage.getPendingPackage()
      if (!pendingPackage) {
        // No pending update, don't restart
        return
      }
    }

    // TODO: Implement native restart bridge
    // For MVP, log warning that restart is required manually
    // Future enhancement: Add native module for platform-specific restart
    // iOS: Use RCTReloadCommand or RCTBridge reload
    // Android: Use ReactInstanceManager recreateReactContextInBackground
    console.warn(
      '[CodePush] Restart required to apply update. ' +
        'Native restart not yet implemented. ' +
        'Please restart the app manually or use developer menu reload.'
    )
  }

  /**
   * Allow queued restarts to proceed
   */
  allowRestart(): void {
    // TODO: Implement in Phase 5
    throw new Error('allowRestart not yet implemented')
  }

  /**
   * Prevent restarts and queue them instead
   */
  disallowRestart(): void {
    // TODO: Implement in Phase 5
    throw new Error('disallowRestart not yet implemented')
  }

  /**
   * Clear all downloaded updates
   */
  async clearUpdates(): Promise<void> {
    // TODO: Implement in Phase 5
    throw new Error('clearUpdates not yet implemented')
  }
}
