import type { BitriseConfig } from '../types/config'
import type { RemotePackage, SyncOptions, Configuration, Package } from '../types/package'
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
  private isSyncing = false

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
        throw new ConfigurationError('deploymentKey is required. Add it to BitriseSDK.configure()')
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
   * This is the primary method for implementing CodePush updates. It orchestrates
   * the full update lifecycle: check → download → install → restart.
   *
   * @param options - Optional configuration for sync behavior
   * @param options.deploymentKey - Override the configured deployment key
   * @param options.installMode - Install mode for optional updates (default: ON_NEXT_RESTART)
   * @param options.mandatoryInstallMode - Install mode for mandatory updates (default: IMMEDIATE)
   * @param options.minimumBackgroundDuration - Minimum seconds in background before installing (for ON_NEXT_SUSPEND)
   * @param options.ignoreFailedUpdates - Skip updates that previously failed (default: false)
   * @returns Promise resolving to SyncStatus indicating the result
   *
   * @example
   * ```typescript
   * // Basic usage
   * const status = await codePush.sync()
   * if (status === SyncStatus.UPDATE_INSTALLED) {
   *   console.log('Update installed, will apply on next restart')
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Custom install mode
   * await codePush.sync({
   *   installMode: InstallMode.IMMEDIATE,
   *   mandatoryInstallMode: InstallMode.IMMEDIATE
   * })
   * ```
   */
  async sync(options?: SyncOptions): Promise<SyncStatus> {
    // GUARD: Prevent concurrent syncs
    if (this.isSyncing) {
      return SyncStatus.SYNC_IN_PROGRESS
    }

    try {
      this.isSyncing = true

      // PHASE 1: Notify if needed (lifecycle management)
      if (!this.notifyAppReadyCalled) {
        this.notifyAppReady()
      }

      // PHASE 2: Check for updates
      const remotePackage = await this.checkForUpdate(options?.deploymentKey)

      if (!remotePackage) {
        return SyncStatus.UP_TO_DATE
      }

      // PHASE 3: Determine install mode
      const installMode = this.resolveInstallMode(remotePackage.isMandatory, options)

      // PHASE 4: Check if should ignore failed updates
      if (options?.ignoreFailedUpdates) {
        const failedUpdates = await PackageStorage.getFailedUpdates()
        if (failedUpdates.includes(remotePackage.packageHash)) {
          return SyncStatus.UPDATE_IGNORED
        }
      }

      // TODO Phase 5: Show update dialog if configured
      // if (options?.updateDialog && !remotePackage.isMandatory) {
      //   const userApproved = await this.showUpdateDialog(options.updateDialog, remotePackage)
      //   if (!userApproved) {
      //     return SyncStatus.UPDATE_IGNORED
      //   }
      // }

      // PHASE 5: Download package
      const localPackage = await remotePackage.download()

      // PHASE 6: Install package
      await localPackage.install(installMode, options?.minimumBackgroundDuration)

      return SyncStatus.UPDATE_INSTALLED
    } catch (error) {
      // Let ConfigurationError bubble up (user misconfiguration)
      if (error instanceof ConfigurationError) {
        throw error
      }

      console.error('[CodePush] sync() failed:', error)
      return SyncStatus.UNKNOWN_ERROR
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * Resolve the install mode based on update type and options
   * @param isMandatory - Whether the update is mandatory
   * @param options - Sync options
   * @returns Install mode to use
   */
  private resolveInstallMode(isMandatory: boolean, options?: SyncOptions): number {
    if (isMandatory) {
      return options?.mandatoryInstallMode ?? 0 // InstallMode.IMMEDIATE
    }
    return options?.installMode ?? 1 // InstallMode.ON_NEXT_RESTART
  }

  /**
   * Notify the SDK that the app is ready
   * Should be called when the app has successfully launched
   *
   * This marks the current update as successful and clears any failure flags.
   * It's safe to call multiple times - only the first call will execute.
   *
   * Compatible with react-native-code-push notifyAppReady() method
   *
   * @example
   * ```typescript
   * // Call once during app initialization
   * codePush.notifyAppReady()
   * ```
   */
  notifyAppReady(): void {
    // GUARD: Only execute once per instance
    if (this.notifyAppReadyCalled) {
      return
    }

    this.notifyAppReadyCalled = true

    // Async work in background (don't block caller)
    this.performNotifyAppReady().catch(error => {
      console.error('[CodePush] notifyAppReady() failed:', error)
    })
  }

  /**
   * Perform the actual app ready notification work
   * Runs asynchronously in background
   */
  private async performNotifyAppReady(): Promise<void> {
    try {
      // Get current running package
      const currentPackage = await PackageStorage.getCurrentPackage()

      if (!currentPackage) {
        // No package installed, nothing to notify
        return
      }

      // Check if this package was pending
      const pendingPackage = await PackageStorage.getPendingPackage()

      if (pendingPackage?.packageHash === currentPackage.packageHash) {
        // This WAS pending, now it's confirmed successful
        // Move from pending to current (already done by native restart)
        await PackageStorage.clearPendingPackage()
      }

      // Clear failed update flag for this package (if it exists)
      const failedUpdates = await PackageStorage.getFailedUpdates()
      if (failedUpdates.includes(currentPackage.packageHash)) {
        const updated = failedUpdates.filter(hash => hash !== currentPackage.packageHash)
        if (updated.length === 0) {
          await PackageStorage.clearFailedUpdates()
        } else {
          // TODO Phase 5: Add setFailedUpdates() method to PackageStorage
          // For now, leave partial list as-is (not blocking Phase 4 MVP)
        }
      }

      // TODO Phase 6: Report success metrics to Bitrise server
      // await this.reportMetrics({
      //   event: 'update_success',
      //   packageHash: currentPackage.packageHash,
      //   label: currentPackage.label
      // })
    } catch (error) {
      // Never throw, just log
      console.error('[CodePush] performNotifyAppReady() error:', error)
    }
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
