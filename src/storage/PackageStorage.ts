import type { Package, LocalPackage } from '../types/package'
import { getStorageItem, setStorageItem, removeStorageItem, clearStorage } from '../utils/storage'

/**
 * Storage keys for CodePush metadata
 */
const STORAGE_KEYS = {
  CURRENT_PACKAGE: '@bitrise/codepush/currentPackage',
  PENDING_PACKAGE: '@bitrise/codepush/pendingPackage',
  FAILED_UPDATES: '@bitrise/codepush/failedUpdates',
  PACKAGE_DATA_PREFIX: '@bitrise/codepush/packageData/',
  INSTALL_METADATA_PREFIX: '@bitrise/codepush/installMetadata/',
  ROLLBACK_METADATA_PREFIX: '@bitrise/codepush/rollbackMetadata/',
  PACKAGE_HISTORY: '@bitrise/codepush/packageHistory',
} as const

/**
 * Package storage using in-memory cache
 * In production, this should use AsyncStorage or similar persistent storage
 */
export class PackageStorage {
  private static cache: Map<string, string> = new Map()

  /**
   * Get the currently running package
   */
  static async getCurrentPackage(): Promise<Package | null> {
    return getStorageItem<Package>(this.cache, STORAGE_KEYS.CURRENT_PACKAGE, null)
  }

  /**
   * Set the currently running package
   */
  static async setCurrentPackage(pkg: Package): Promise<void> {
    setStorageItem(this.cache, STORAGE_KEYS.CURRENT_PACKAGE, pkg)
  }

  /**
   * Get the pending package (installed but not yet running)
   */
  static async getPendingPackage(): Promise<LocalPackage | null> {
    return getStorageItem<LocalPackage>(this.cache, STORAGE_KEYS.PENDING_PACKAGE, null)
  }

  /**
   * Set the pending package
   */
  static async setPendingPackage(pkg: LocalPackage): Promise<void> {
    setStorageItem(this.cache, STORAGE_KEYS.PENDING_PACKAGE, pkg)
  }

  /**
   * Clear the pending package
   */
  static async clearPendingPackage(): Promise<void> {
    removeStorageItem(this.cache, STORAGE_KEYS.PENDING_PACKAGE)
  }

  /**
   * Get the list of failed update hashes
   */
  static async getFailedUpdates(): Promise<string[]> {
    return getStorageItem<string[]>(this.cache, STORAGE_KEYS.FAILED_UPDATES, []) || []
  }

  /**
   * Mark an update as failed
   */
  static async markUpdateFailed(packageHash: string): Promise<void> {
    const failed = await this.getFailedUpdates()
    if (!failed.includes(packageHash)) {
      failed.push(packageHash)
      setStorageItem(this.cache, STORAGE_KEYS.FAILED_UPDATES, failed)
    }
  }

  /**
   * Set the list of failed update hashes
   * Allows removing specific hashes or updating the entire list
   */
  static async setFailedUpdates(hashes: string[]): Promise<void> {
    if (hashes.length === 0) {
      removeStorageItem(this.cache, STORAGE_KEYS.FAILED_UPDATES)
    } else {
      setStorageItem(this.cache, STORAGE_KEYS.FAILED_UPDATES, hashes)
    }
  }

  /**
   * Clear failed updates list
   */
  static async clearFailedUpdates(): Promise<void> {
    removeStorageItem(this.cache, STORAGE_KEYS.FAILED_UPDATES)
  }

  /**
   * Clear all storage
   */
  static async clear(): Promise<void> {
    clearStorage(this.cache)
  }

  /**
   * Store package binary data (base64 encoded)
   */
  static async setPackageData(packageHash: string, base64Data: string): Promise<void> {
    const key = `${STORAGE_KEYS.PACKAGE_DATA_PREFIX}${packageHash}`
    this.cache.set(key, base64Data)
  }

  /**
   * Retrieve package binary data
   */
  static async getPackageData(packageHash: string): Promise<string | null> {
    const key = `${STORAGE_KEYS.PACKAGE_DATA_PREFIX}${packageHash}`
    return this.cache.get(key) || null
  }

  /**
   * Delete package binary data
   */
  static async deletePackageData(packageHash: string): Promise<void> {
    const key = `${STORAGE_KEYS.PACKAGE_DATA_PREFIX}${packageHash}`
    this.cache.delete(key)
  }

  /**
   * Store install metadata for a package
   */
  static async setInstallMetadata(
    packageHash: string,
    metadata: { installMode: number; timestamp: number; minimumBackgroundDuration?: number }
  ): Promise<void> {
    const key = `${STORAGE_KEYS.INSTALL_METADATA_PREFIX}${packageHash}`
    setStorageItem(this.cache, key, metadata)
  }

  /**
   * Retrieve install metadata for a package
   */
  static async getInstallMetadata(packageHash: string): Promise<{
    installMode: number
    timestamp: number
    minimumBackgroundDuration?: number
  } | null> {
    const key = `${STORAGE_KEYS.INSTALL_METADATA_PREFIX}${packageHash}`
    return getStorageItem(this.cache, key, null)
  }

  /**
   * Store rollback metadata for a package
   */
  static async setRollbackMetadata(
    packageHash: string,
    metadata: {
      installedAt: number
      timeoutMinutes: number
      maxRetries: number
      retryCount: number
      previousPackageHash: string
    }
  ): Promise<void> {
    const key = `${STORAGE_KEYS.ROLLBACK_METADATA_PREFIX}${packageHash}`
    setStorageItem(this.cache, key, metadata)
  }

  /**
   * Retrieve rollback metadata for a package
   */
  static async getRollbackMetadata(packageHash: string): Promise<{
    installedAt: number
    timeoutMinutes: number
    maxRetries: number
    retryCount: number
    previousPackageHash: string
  } | null> {
    const key = `${STORAGE_KEYS.ROLLBACK_METADATA_PREFIX}${packageHash}`
    return getStorageItem(this.cache, key, null)
  }

  /**
   * Clear rollback metadata for a package
   */
  static async clearRollbackMetadata(packageHash?: string): Promise<void> {
    if (packageHash) {
      const key = `${STORAGE_KEYS.ROLLBACK_METADATA_PREFIX}${packageHash}`
      removeStorageItem(this.cache, key)
    } else {
      // Clear all rollback metadata
      const keys = Array.from(this.cache.keys()).filter(key =>
        key.startsWith(STORAGE_KEYS.ROLLBACK_METADATA_PREFIX)
      )
      keys.forEach(key => removeStorageItem(this.cache, key))
    }
  }

  /**
   * Store package history (up to last 3 versions)
   */
  static async addToPackageHistory(pkg: Package): Promise<void> {
    const history = await this.getPackageHistory()
    // Add to front, remove if already exists
    const filtered = history.filter(p => p.packageHash !== pkg.packageHash)
    filtered.unshift(pkg)
    // Keep only last 3
    const trimmed = filtered.slice(0, 3)
    setStorageItem(this.cache, STORAGE_KEYS.PACKAGE_HISTORY, trimmed)
  }

  /**
   * Get package history (up to last 3 versions)
   */
  static async getPackageHistory(): Promise<Package[]> {
    return getStorageItem<Package[]>(this.cache, STORAGE_KEYS.PACKAGE_HISTORY, []) || []
  }

  /**
   * Get a specific package by hash from history
   */
  static async getPackageByHash(packageHash: string): Promise<Package | null> {
    const history = await this.getPackageHistory()
    return history.find(p => p.packageHash === packageHash) || null
  }
}
