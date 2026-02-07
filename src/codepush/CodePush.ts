import { Alert } from 'react-native'
import type { BitriseConfig } from '../types/config'
import type {
  RemotePackage,
  SyncOptions,
  Configuration,
  Package,
  UpdateDialogOptions,
  SyncStatusChangedCallback,
  DownloadProgressCallback,
  HandleBinaryVersionMismatchCallback,
} from '../types/package'
import { SyncStatus, UpdateState } from '../types/enums'
import { ConfigurationError, UpdateError, TimeoutError } from '../types/errors'
import { BitriseClient, CheckUpdateResult } from '../network/BitriseClient'
import { PackageStorage } from '../storage/PackageStorage'
import { getAppVersion } from '../utils/platform'
import { RestartQueue } from './RestartQueue'
import { restartApp as nativeRestart } from '../native/Restart'
import { RollbackManager } from './RollbackManager'
import { MetricsClient, MetricEvent } from '../metrics/MetricsClient'
import { getErrorMessage } from '../utils/error'

/**
 * CodePush functionality for over-the-air updates
 * Compatible with react-native-code-push API
 */
/** Default sync timeout: 5 minutes */
const DEFAULT_SYNC_TIMEOUT_MS = 5 * 60 * 1000

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
   * Compatible with react-native-code-push checkForUpdate() signature
   *
   * @param deploymentKey - Optional deployment key to override configured key
   * @param handleBinaryVersionMismatchCallback - Optional callback when binary update is required
   * @returns Promise resolving to RemotePackage or null if no update available
   *
   * @example
   * ```typescript
   * const update = await codePush.checkForUpdate()
   * if (update) {
   *   console.log('Update available:', update.label)
   * }
   * ```
   *
   * @example
   * ```typescript
   * // With binary mismatch callback
   * const update = await codePush.checkForUpdate(undefined, (mismatchedUpdate) => {
   *   console.log('Binary update required for version:', mismatchedUpdate.appVersion)
   * })
   * ```
   */
  async checkForUpdate(
    deploymentKey?: string,
    handleBinaryVersionMismatchCallback?: HandleBinaryVersionMismatchCallback
  ): Promise<RemotePackage | null> {
    // Use internal method that provides mismatch info
    const result = await this.checkForUpdateWithMismatchInfo(deploymentKey)

    // Call mismatch callback if provided and mismatch detected
    if (result.binaryVersionMismatch && result.remotePackage) {
      handleBinaryVersionMismatchCallback?.(result.remotePackage)
    }

    // Return null for mismatches (backward compatible behavior)
    if (result.binaryVersionMismatch) {
      return null
    }

    return result.remotePackage
  }

  /**
   * Check for available updates with binary version mismatch information
   * @internal Used by sync() to support mismatch callbacks
   */
  private async checkForUpdateWithMismatchInfo(deploymentKey?: string): Promise<CheckUpdateResult> {
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

    // Check for update with mismatch info
    const result = await client.checkForUpdateWithMismatchInfo(currentHash)

    // Report UPDATE_CHECK metric
    MetricsClient.getInstance()?.reportEvent(MetricEvent.UPDATE_CHECK, {
      packageHash: result.remotePackage?.packageHash,
      label: result.remotePackage?.label,
      metadata: {
        isAvailable: !!result.remotePackage,
        isMandatory: result.remotePackage?.isMandatory,
        binaryVersionMismatch: result.binaryVersionMismatch,
      },
    })

    return result
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

    let pkg: Package | null = null

    switch (state) {
      case UpdateState.RUNNING:
        pkg = await PackageStorage.getCurrentPackage()
        break

      case UpdateState.PENDING:
        pkg = await PackageStorage.getPendingPackage()
        break

      case UpdateState.LATEST:
        // Return pending if available, otherwise current
        const pending = await PackageStorage.getPendingPackage()
        if (pending) {
          pkg = pending
        } else {
          pkg = await PackageStorage.getCurrentPackage()
        }
        break

      default:
        return null
    }

    // Calculate isFirstRun dynamically
    return this.withIsFirstRun(pkg)
  }

  /**
   * Calculate isFirstRun for a package
   * isFirstRun is true if the package hash differs from the last notified hash
   * @internal
   */
  private async withIsFirstRun(pkg: Package | null): Promise<Package | null> {
    if (!pkg) {
      return null
    }

    const notifiedHash = await PackageStorage.getNotifiedPackageHash()
    const isFirstRun = notifiedHash !== pkg.packageHash

    return { ...pkg, isFirstRun }
  }

  /**
   * Get the currently installed package
   * @deprecated Use getUpdateMetadata(UpdateState.LATEST) instead
   */
  async getCurrentPackage(): Promise<Package | null> {
    return this.getUpdateMetadata(UpdateState.LATEST)
  }

  /**
   * Show native alert for updates
   * For optional updates: shows ignore and install buttons
   * For mandatory updates: shows only continue button (cannot be dismissed)
   */
  private async showUpdateDialog(
    options: UpdateDialogOptions | boolean,
    remotePackage: RemotePackage
  ): Promise<boolean> {
    const dialogOptions = typeof options === 'boolean' ? {} : options
    const isMandatory = remotePackage.isMandatory

    return new Promise(resolve => {
      const message = this.buildDialogMessage(dialogOptions, remotePackage, isMandatory)
      const title = dialogOptions.title || 'Update available'

      const buttons = isMandatory
        ? [
            {
              text: dialogOptions.mandatoryContinueButtonLabel || 'Continue',
              onPress: () => resolve(true),
            },
          ]
        : [
            {
              text: dialogOptions.optionalIgnoreButtonLabel || 'Not Now',
              onPress: () => resolve(false),
              style: 'cancel' as const,
            },
            {
              text: dialogOptions.optionalInstallButtonLabel || 'Install',
              onPress: () => resolve(true),
            },
          ]

      Alert.alert(title, message, buttons, { cancelable: !isMandatory })
    })
  }

  /**
   * Build dialog message with optional release notes
   */
  private buildDialogMessage(
    options: Partial<UpdateDialogOptions>,
    remotePackage: RemotePackage,
    isMandatory: boolean
  ): string {
    const defaultMessage = isMandatory
      ? 'An update is available that must be installed.'
      : 'An update is available. Would you like to install it?'

    const baseMessage = isMandatory
      ? options.mandatoryUpdateMessage || defaultMessage
      : options.optionalUpdateMessage || defaultMessage

    if (options.appendReleaseDescription && remotePackage.description) {
      const prefix = options.descriptionPrefix || '\n\nRelease notes:\n'
      return baseMessage + prefix + remotePackage.description
    }

    return baseMessage
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
   * @param syncStatusChangedCallback - Optional callback for sync status changes
   * @param downloadProgressCallback - Optional callback for download progress
   * @param handleBinaryVersionMismatchCallback - Optional callback when binary update is required
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
   * // With callbacks (react-native-code-push compatible)
   * await codePush.sync(
   *   { installMode: InstallMode.IMMEDIATE },
   *   (status) => console.log('Status:', status),
   *   (progress) => console.log('Progress:', progress.receivedBytes, '/', progress.totalBytes),
   *   (update) => console.log('Binary update required:', update.appVersion)
   * )
   * ```
   */
  async sync(
    options?: SyncOptions,
    syncStatusChangedCallback?: SyncStatusChangedCallback,
    downloadProgressCallback?: DownloadProgressCallback,
    handleBinaryVersionMismatchCallback?: HandleBinaryVersionMismatchCallback
  ): Promise<SyncStatus> {
    // GUARD: Prevent concurrent syncs
    if (this.isSyncing) {
      syncStatusChangedCallback?.(SyncStatus.SYNC_IN_PROGRESS)
      return SyncStatus.SYNC_IN_PROGRESS
    }

    // Apply timeout if configured (default: 5 minutes, 0 = disabled)
    const timeoutMs = options?.syncTimeoutMs ?? DEFAULT_SYNC_TIMEOUT_MS
    if (timeoutMs > 0) {
      return this.syncWithTimeout(
        options,
        timeoutMs,
        syncStatusChangedCallback,
        downloadProgressCallback,
        handleBinaryVersionMismatchCallback
      )
    }

    return this.performSync(
      options,
      syncStatusChangedCallback,
      downloadProgressCallback,
      handleBinaryVersionMismatchCallback
    )
  }

  /**
   * Perform sync with a timeout wrapper
   */
  private async syncWithTimeout(
    options: SyncOptions | undefined,
    timeoutMs: number,
    syncStatusChangedCallback?: SyncStatusChangedCallback,
    downloadProgressCallback?: DownloadProgressCallback,
    handleBinaryVersionMismatchCallback?: HandleBinaryVersionMismatchCallback
  ): Promise<SyncStatus> {
    return new Promise<SyncStatus>((resolve, reject) => {
      let settled = false

      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true
          this.isSyncing = false
          reject(
            new TimeoutError(`Sync operation timed out after ${timeoutMs}ms`, {
              timeoutMs,
              operation: 'sync',
            })
          )
        }
      }, timeoutMs)

      this.performSync(
        options,
        syncStatusChangedCallback,
        downloadProgressCallback,
        handleBinaryVersionMismatchCallback
      )
        .then(result => {
          if (!settled) {
            settled = true
            clearTimeout(timeoutId)
            resolve(result)
          }
        })
        .catch(error => {
          if (!settled) {
            settled = true
            clearTimeout(timeoutId)
            reject(error)
          }
        })
    })
  }

  /**
   * Perform the actual sync operation
   */
  private async performSync(
    options?: SyncOptions,
    syncStatusChangedCallback?: SyncStatusChangedCallback,
    downloadProgressCallback?: DownloadProgressCallback,
    handleBinaryVersionMismatchCallback?: HandleBinaryVersionMismatchCallback
  ): Promise<SyncStatus> {
    try {
      this.isSyncing = true

      // PHASE 1: Notify if needed (lifecycle management)
      if (!this.notifyAppReadyCalled) {
        this.notifyAppReady()
      }

      // PHASE 2: Check for updates
      syncStatusChangedCallback?.(SyncStatus.CHECKING_FOR_UPDATE)

      const updateResult = await this.checkForUpdateWithMismatchInfo(options?.deploymentKey)

      // Handle binary version mismatch
      if (updateResult.binaryVersionMismatch && updateResult.remotePackage) {
        handleBinaryVersionMismatchCallback?.(updateResult.remotePackage)
        return SyncStatus.UP_TO_DATE
      }

      const remotePackage = updateResult.remotePackage

      if (!remotePackage) {
        syncStatusChangedCallback?.(SyncStatus.UP_TO_DATE)
        return SyncStatus.UP_TO_DATE
      }

      // PHASE 3: Determine install mode
      const installMode = this.resolveInstallMode(remotePackage.isMandatory, options)

      // PHASE 4: Check if should ignore failed updates
      if (options?.ignoreFailedUpdates) {
        const failedUpdates = await PackageStorage.getFailedUpdates()
        if (failedUpdates.includes(remotePackage.packageHash)) {
          syncStatusChangedCallback?.(SyncStatus.UPDATE_IGNORED)
          return SyncStatus.UPDATE_IGNORED
        }
      }

      // PHASE 5: Show update dialog if configured
      if (options?.updateDialog) {
        syncStatusChangedCallback?.(SyncStatus.AWAITING_USER_ACTION)
        const userApproved = await this.showUpdateDialog(options.updateDialog, remotePackage)
        if (!userApproved) {
          syncStatusChangedCallback?.(SyncStatus.UPDATE_IGNORED)
          return SyncStatus.UPDATE_IGNORED
        }
      }

      // PHASE 6: Download package
      syncStatusChangedCallback?.(SyncStatus.DOWNLOADING_PACKAGE)
      const localPackage = await remotePackage.download(downloadProgressCallback)

      // PHASE 7: Install package
      syncStatusChangedCallback?.(SyncStatus.INSTALLING_UPDATE)
      await localPackage.install(installMode, options?.minimumBackgroundDuration)

      syncStatusChangedCallback?.(SyncStatus.UPDATE_INSTALLED)
      return SyncStatus.UPDATE_INSTALLED
    } catch (error) {
      // Let ConfigurationError and TimeoutError bubble up
      if (error instanceof ConfigurationError || error instanceof TimeoutError) {
        throw error
      }

      console.error('[CodePush] sync() failed:', error)
      syncStatusChangedCallback?.(SyncStatus.UNKNOWN_ERROR)
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
      // Check if there's a pending package that should be promoted to current
      const pendingPackage = await PackageStorage.getPendingPackage()

      if (pendingPackage) {
        // Promote pending package to current (this is the key step after restart!)
        await PackageStorage.setCurrentPackage(pendingPackage)
        await PackageStorage.clearPendingPackage()
        console.log('[CodePush] Promoted pending package to current:', pendingPackage.packageHash)
      }

      // Get current running package (now includes newly promoted package)
      const currentPackage = await PackageStorage.getCurrentPackage()

      if (!currentPackage) {
        // No package installed, nothing more to notify
        return
      }

      // Clear failed update flag for this package (if it exists)
      const failedUpdates = await PackageStorage.getFailedUpdates()
      if (failedUpdates.includes(currentPackage.packageHash)) {
        const updated = failedUpdates.filter(hash => hash !== currentPackage.packageHash)
        await PackageStorage.setFailedUpdates(updated)
      }

      // Cancel rollback timer (app is ready)
      const rollbackManager = RollbackManager.getInstance()
      await rollbackManager.cancelTimer()

      // Mark this package as notified (isFirstRun will be false on next check)
      await PackageStorage.setNotifiedPackageHash(currentPackage.packageHash)

      // Report APP_READY metric
      MetricsClient.getInstance()?.reportEvent(MetricEvent.APP_READY, {
        packageHash: currentPackage.packageHash,
        label: currentPackage.label,
        metadata: {
          wasPending: !!pendingPackage,
        },
      })
    } catch (error) {
      // Never throw, just log
      console.error('[CodePush] performNotifyAppReady() error:', error)
    }
  }

  /**
   * Restart the app to apply a pending update
   *
   * Respects restart queue - if restarts are disallowed, the restart will be queued.
   * Call allowRestart() to execute the queued restart.
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

    // Use RestartQueue to respect disallowRestart() calls
    const restartQueue = RestartQueue.getInstance()
    restartQueue.queueRestart(() => {
      nativeRestart()
    })
  }

  /**
   * Allow queued restarts to proceed
   *
   * If a restart was queued while disallowed, it will execute immediately.
   * Use this after critical operations complete.
   *
   * @example
   * ```typescript
   * codePush.disallowRestart()
   * await processPayment()
   * codePush.allowRestart() // Any queued restart will execute now
   * ```
   */
  allowRestart(): void {
    RestartQueue.getInstance().allowRestart()
  }

  /**
   * Prevent restarts and queue them instead
   *
   * Call this during critical operations (payments, transactions, animations).
   * Restarts will be queued and execute when allowRestart() is called.
   *
   * @example
   * ```typescript
   * codePush.disallowRestart()
   * await processPayment()
   * codePush.allowRestart()
   * ```
   */
  disallowRestart(): void {
    RestartQueue.getInstance().disallowRestart()
  }

  /**
   * Clear all downloaded updates to free disk space
   *
   * Deletes package data and clears metadata for all packages.
   * Useful for storage management.
   *
   * @example
   * ```typescript
   * await codePush.clearUpdates()
   * console.log('All updates cleared')
   * ```
   */
  async clearUpdates(): Promise<void> {
    try {
      // Get all packages to clean up
      const currentPackage = await PackageStorage.getCurrentPackage()
      const pendingPackage = await PackageStorage.getPendingPackage()

      // Collect all package hashes
      const hashes: string[] = []
      if (currentPackage) {
        hashes.push(currentPackage.packageHash)
      }
      if (pendingPackage) {
        hashes.push(pendingPackage.packageHash)
      }

      // Delete package data for all packages
      for (const hash of hashes) {
        await PackageStorage.deletePackageData(hash)
      }

      // Clear all metadata
      await PackageStorage.clearPendingPackage()
      await PackageStorage.clearFailedUpdates()

      console.log('[CodePush] Cleared all updates')
    } catch (error) {
      console.error('[CodePush] Failed to clear updates:', error)
      throw new UpdateError('Failed to clear updates', {
        originalError: getErrorMessage(error),
      })
    }
  }

  /**
   * Custom JSON serialization to prevent exposing sensitive data
   * Deployment keys and tokens should never appear in logs or error reports
   * @internal
   */
  toJSON(): object {
    return {
      serverUrl: this.bitriseConfig.serverUrl,
      configured: !!this.client,
      notifyAppReadyCalled: this.notifyAppReadyCalled,
      isSyncing: this.isSyncing,
    }
  }
}
