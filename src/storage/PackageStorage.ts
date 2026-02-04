import type { Package, LocalPackage } from '../types/package'

/**
 * Storage keys for CodePush metadata
 */
const STORAGE_KEYS = {
  CURRENT_PACKAGE: '@bitrise/codepush/currentPackage',
  PENDING_PACKAGE: '@bitrise/codepush/pendingPackage',
  FAILED_UPDATES: '@bitrise/codepush/failedUpdates',
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
    const data = this.cache.get(STORAGE_KEYS.CURRENT_PACKAGE)
    if (!data) {
      return null
    }
    try {
      return JSON.parse(data)
    } catch {
      return null
    }
  }

  /**
   * Set the currently running package
   */
  static async setCurrentPackage(pkg: Package): Promise<void> {
    this.cache.set(STORAGE_KEYS.CURRENT_PACKAGE, JSON.stringify(pkg))
  }

  /**
   * Get the pending package (installed but not yet running)
   */
  static async getPendingPackage(): Promise<LocalPackage | null> {
    const data = this.cache.get(STORAGE_KEYS.PENDING_PACKAGE)
    if (!data) {
      return null
    }
    try {
      return JSON.parse(data)
    } catch {
      return null
    }
  }

  /**
   * Set the pending package
   */
  static async setPendingPackage(pkg: LocalPackage): Promise<void> {
    this.cache.set(STORAGE_KEYS.PENDING_PACKAGE, JSON.stringify(pkg))
  }

  /**
   * Clear the pending package
   */
  static async clearPendingPackage(): Promise<void> {
    this.cache.delete(STORAGE_KEYS.PENDING_PACKAGE)
  }

  /**
   * Get the list of failed update hashes
   */
  static async getFailedUpdates(): Promise<string[]> {
    const data = this.cache.get(STORAGE_KEYS.FAILED_UPDATES)
    if (!data) {
      return []
    }
    try {
      return JSON.parse(data)
    } catch {
      return []
    }
  }

  /**
   * Mark an update as failed
   */
  static async markUpdateFailed(packageHash: string): Promise<void> {
    const failed = await this.getFailedUpdates()
    if (!failed.includes(packageHash)) {
      failed.push(packageHash)
      this.cache.set(STORAGE_KEYS.FAILED_UPDATES, JSON.stringify(failed))
    }
  }

  /**
   * Clear failed updates list
   */
  static async clearFailedUpdates(): Promise<void> {
    this.cache.delete(STORAGE_KEYS.FAILED_UPDATES)
  }

  /**
   * Clear all storage
   */
  static async clear(): Promise<void> {
    this.cache.clear()
  }
}
