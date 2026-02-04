import type { LocalPackage, Package } from '../types/package'
import { InstallMode } from '../types/enums'
import { UpdateError } from '../types/errors'
import { PackageStorage } from '../storage/PackageStorage'

/**
 * Implementation of LocalPackage interface
 * Provides install functionality for downloaded CodePush packages
 */
export class LocalPackageImpl implements LocalPackage {
  appVersion: string
  deploymentKey: string
  description: string
  failedInstall: boolean
  isFirstRun: boolean
  isMandatory: boolean
  isPending: boolean
  label: string
  packageHash: string
  packageSize: number
  localPath: string

  constructor(packageData: Package & { localPath: string }) {
    this.appVersion = packageData.appVersion
    this.deploymentKey = packageData.deploymentKey
    this.description = packageData.description
    this.failedInstall = packageData.failedInstall
    this.isFirstRun = packageData.isFirstRun
    this.isMandatory = packageData.isMandatory
    this.isPending = packageData.isPending
    this.label = packageData.label
    this.packageHash = packageData.packageHash
    this.packageSize = packageData.packageSize
    this.localPath = packageData.localPath
  }

  /**
   * Install this package
   * Marks the package as pending and queues it for installation based on InstallMode
   *
   * @param installMode - When to apply the update (default: ON_NEXT_RESTART)
   * @param minimumBackgroundDuration - Minimum time in background before applying (for ON_NEXT_RESUME/SUSPEND)
   * @returns Promise resolving when install is queued
   *
   * @example
   * ```typescript
   * const localPackage = await update.download()
   *
   * // Install on next restart
   * await localPackage.install(InstallMode.ON_NEXT_RESTART)
   *
   * // Install immediately (restarts app)
   * await localPackage.install(InstallMode.IMMEDIATE)
   *
   * // Install when app resumes from background
   * await localPackage.install(InstallMode.ON_NEXT_RESUME, 60)
   * ```
   */
  async install(installMode?: number, minimumBackgroundDuration?: number): Promise<void> {
    try {
      // Default to ON_NEXT_RESTART if not specified
      const mode = installMode ?? InstallMode.ON_NEXT_RESTART

      // Validate install mode
      if (![InstallMode.IMMEDIATE, InstallMode.ON_NEXT_RESTART, InstallMode.ON_NEXT_RESUME, InstallMode.ON_NEXT_SUSPEND].includes(mode)) {
        console.warn(
          `[CodePush] Invalid install mode: ${mode}. Defaulting to ON_NEXT_RESTART.`
        )
      }

      // Verify package data exists
      const packageData = await PackageStorage.getPackageData(this.packageHash)
      if (!packageData) {
        throw new UpdateError('Package data not found. Download may have failed.', {
          packageHash: this.packageHash,
          localPath: this.localPath,
        })
      }

      // Mark package as pending
      await this.markAsPending()

      // Store install metadata
      await PackageStorage.setInstallMetadata(this.packageHash, {
        installMode: mode,
        timestamp: Date.now(),
        minimumBackgroundDuration,
      })

      // Handle IMMEDIATE mode - trigger restart
      if (mode === InstallMode.IMMEDIATE) {
        // Dynamic import to avoid circular dependency
        const { CodePush } = await import('./CodePush')
        // This will trigger restart (or log warning for MVP)
        // We need to access the CodePush instance, but for now we'll just log
        // TODO: Implement proper restart trigger in Phase 3
        console.log('[CodePush] Immediate restart requested. Call restartApp() to apply update.')
      }
    } catch (error) {
      if (error instanceof UpdateError) {
        throw error
      }
      throw new UpdateError('Failed to install package', {
        packageHash: this.packageHash,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Mark this package as pending in storage
   */
  private async markAsPending(): Promise<void> {
    try {
      // Update isPending flag
      this.isPending = true

      // Store in PackageStorage
      await PackageStorage.setPendingPackage(this)
    } catch (error) {
      throw new UpdateError('Failed to mark package as pending', {
        packageHash: this.packageHash,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
