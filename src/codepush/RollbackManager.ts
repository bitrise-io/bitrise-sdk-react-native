import { PackageStorage } from '../storage/PackageStorage'
import type { Package } from '../types/package'
import type { RollbackRetryOptions } from '../types/package'
import { MetricsClient, MetricEvent } from '../metrics/MetricsClient'

/**
 * Rollback metadata stored for each installed package
 */
interface RollbackMetadata {
  installedAt: number
  timeoutMinutes: number
  maxRetries: number
  retryCount: number
  previousPackageHash: string
}

/**
 * Manages automatic rollback of failed CodePush updates
 *
 * If notifyAppReady() is not called within a configurable timeout after
 * installing an update, the RollbackManager will automatically revert
 * to the previous working version.
 *
 * @example
 * ```typescript
 * // Start rollback timer after install
 * await RollbackManager.getInstance().startRollbackTimer(
 *   installedPackageHash,
 *   { delayInHours: 0.5, maxRetryAttempts: 3 }
 * )
 *
 * // Cancel timer when app is ready
 * await RollbackManager.getInstance().cancelTimer()
 * ```
 */
export class RollbackManager {
  private static instance: RollbackManager | null = null
  private rollbackTimer: NodeJS.Timeout | null = null
  private currentPackageHash: string | null = null

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): RollbackManager {
    if (!this.instance) {
      this.instance = new RollbackManager()
    }
    return this.instance
  }

  /**
   * Start rollback timer after installing a package
   *
   * This should be called immediately after LocalPackage.install().
   * If notifyAppReady() is not called within the timeout period,
   * the package will be rolled back to the previous version.
   *
   * @param installedPackageHash - Hash of the newly installed package
   * @param options - Rollback configuration options
   */
  async startRollbackTimer(
    installedPackageHash: string,
    options?: RollbackRetryOptions
  ): Promise<void> {
    // Cancel any existing timer
    this.cancelTimerSync()

    // Get current package (will be the rollback target)
    const currentPackage = await PackageStorage.getCurrentPackage()
    if (!currentPackage) {
      console.log('[CodePush] No previous package to rollback to')
      return
    }

    // Check if this package has already failed too many times
    const existingMetadata = await PackageStorage.getRollbackMetadata(installedPackageHash)
    if (existingMetadata && existingMetadata.retryCount >= existingMetadata.maxRetries) {
      console.warn(
        `[CodePush] Package ${installedPackageHash} has exceeded max retry attempts, skipping rollback timer`
      )
      await PackageStorage.markUpdateFailed(installedPackageHash)
      return
    }

    const timeoutMinutes = options?.delayInHours ? options.delayInHours * 60 : 5
    const metadata: RollbackMetadata = {
      installedAt: Date.now(),
      timeoutMinutes,
      maxRetries: options?.maxRetryAttempts ?? 3,
      retryCount: existingMetadata ? existingMetadata.retryCount + 1 : 0,
      previousPackageHash: currentPackage.packageHash,
    }

    this.currentPackageHash = installedPackageHash
    await PackageStorage.setRollbackMetadata(installedPackageHash, metadata)

    // Start timer
    const timeoutMs = timeoutMinutes * 60 * 1000
    this.rollbackTimer = setTimeout(() => {
      this.performRollback(installedPackageHash)
    }, timeoutMs)

    console.log(`[CodePush] Rollback timer started: ${timeoutMinutes} minutes for ${installedPackageHash}`)
  }

  /**
   * Cancel rollback timer
   *
   * This should be called from notifyAppReady() to indicate that
   * the app successfully initialized with the new package.
   */
  async cancelTimer(): Promise<void> {
    this.cancelTimerSync()

    // Clear rollback metadata
    if (this.currentPackageHash) {
      await PackageStorage.clearRollbackMetadata(this.currentPackageHash)
      console.log(`[CodePush] Rollback timer cancelled for ${this.currentPackageHash}`)
      this.currentPackageHash = null
    }
  }

  /**
   * Synchronously cancel the timer (internal helper)
   */
  private cancelTimerSync(): void {
    if (this.rollbackTimer) {
      clearTimeout(this.rollbackTimer)
      this.rollbackTimer = null
    }
  }

  /**
   * Execute rollback to previous version
   *
   * This is called automatically when the rollback timer expires,
   * or can be called manually to force a rollback.
   *
   * @param failedPackageHash - Hash of the package that failed
   */
  private async performRollback(failedPackageHash: string): Promise<void> {
    try {
      console.warn(`[CodePush] Rollback triggered for package: ${failedPackageHash}`)

      const metadata = await PackageStorage.getRollbackMetadata(failedPackageHash)
      if (!metadata) {
        console.error('[CodePush] No rollback metadata found')
        return
      }

      // Mark update as failed
      await PackageStorage.markUpdateFailed(failedPackageHash)

      // Restore previous package
      const previousHash = metadata.previousPackageHash
      const previousPackage = await PackageStorage.getPackageByHash(previousHash)

      if (previousPackage) {
        await PackageStorage.setCurrentPackage(previousPackage)
        await PackageStorage.clearPendingPackage()
        await PackageStorage.clearRollbackMetadata(failedPackageHash)

        console.log(`[CodePush] Rolled back to package: ${previousHash}`)

        // Report rollback metric
        MetricsClient.getInstance()?.reportEvent(MetricEvent.ROLLBACK, {
          packageHash: failedPackageHash,
          label: previousPackage.label,
          metadata: {
            previousPackageHash: previousHash,
            retryCount: metadata.retryCount,
          },
        })

        // Note: App restart is handled by InstallMode logic
        // The rollback will take effect on next app restart
      } else {
        console.error(`[CodePush] Previous package not found in history: ${previousHash}`)
      }
    } catch (error) {
      console.error('[CodePush] Rollback failed:', error)
    } finally {
      this.currentPackageHash = null
    }
  }

  /**
   * Check for pending rollback on app start
   *
   * This should be called during SDK initialization to handle cases
   * where the app was terminated while a rollback timer was active.
   */
  async checkPendingRollback(): Promise<void> {
    const pendingPackage = await PackageStorage.getPendingPackage()
    if (!pendingPackage) {
      return
    }

    const metadata = await PackageStorage.getRollbackMetadata(pendingPackage.packageHash)
    if (!metadata) {
      return
    }

    const elapsed = Date.now() - metadata.installedAt
    const timeoutMs = metadata.timeoutMinutes * 60 * 1000

    if (elapsed > timeoutMs) {
      // Timeout exceeded, trigger rollback immediately
      console.warn('[CodePush] Pending rollback timeout exceeded, executing rollback')
      await this.performRollback(pendingPackage.packageHash)
    } else {
      // Restart timer for remaining time
      const remainingMs = timeoutMs - elapsed
      console.log(
        `[CodePush] Restarting rollback timer with ${Math.floor(remainingMs / 60000)} minutes remaining`
      )

      this.currentPackageHash = pendingPackage.packageHash
      this.rollbackTimer = setTimeout(() => {
        this.performRollback(pendingPackage.packageHash)
      }, remainingMs)
    }
  }

  /**
   * Manually trigger rollback for a specific package
   *
   * @param packageHash - Hash of the package to rollback
   * @returns true if rollback was successful, false otherwise
   */
  async manualRollback(packageHash: string): Promise<boolean> {
    try {
      await this.performRollback(packageHash)
      return true
    } catch (error) {
      console.error('[CodePush] Manual rollback failed:', error)
      return false
    }
  }

  /**
   * Clear all rollback timers and metadata
   * Used for testing and cleanup
   */
  async clearAll(): Promise<void> {
    this.cancelTimerSync()
    this.currentPackageHash = null
    await PackageStorage.clearRollbackMetadata()
  }

  /**
   * Get current rollback status
   * Used for testing and debugging
   */
  getRollbackStatus(): {
    hasActiveTimer: boolean
    currentPackageHash: string | null
  } {
    return {
      hasActiveTimer: this.rollbackTimer !== null,
      currentPackageHash: this.currentPackageHash,
    }
  }
}
