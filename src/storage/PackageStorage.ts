import type { Package, LocalPackage } from '../types/package'
import { PersistentStorage } from '../utils/storage'
import { FileSystem } from '../native/FileSystem'
import { FileSystemStorage } from './FileSystemStorage'

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
 * Failed update entry with timestamp for time-based expiration
 */
export interface FailedUpdateEntry {
  packageHash: string
  failedAt: number
  reason?: string
}

/**
 * Default expiration time for failed updates: 7 days in milliseconds
 */
const FAILED_UPDATE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Package storage using persistent filesystem-backed storage with in-memory cache
 * Provides thread-safe operations through operation queuing
 */
export class PackageStorage {
  /**
   * Get the currently running package
   */
  static async getCurrentPackage(): Promise<Package | null> {
    return PersistentStorage.getItem<Package>(STORAGE_KEYS.CURRENT_PACKAGE, null)
  }

  /**
   * Set the currently running package
   */
  static async setCurrentPackage(pkg: Package): Promise<void> {
    await PersistentStorage.setItem(STORAGE_KEYS.CURRENT_PACKAGE, pkg)
  }

  /**
   * Get the pending package (installed but not yet running)
   */
  static async getPendingPackage(): Promise<LocalPackage | null> {
    return PersistentStorage.getItem<LocalPackage>(STORAGE_KEYS.PENDING_PACKAGE, null)
  }

  /**
   * Set the pending package
   */
  static async setPendingPackage(pkg: LocalPackage): Promise<void> {
    await PersistentStorage.setItem(STORAGE_KEYS.PENDING_PACKAGE, pkg)
  }

  /**
   * Clear the pending package
   */
  static async clearPendingPackage(): Promise<void> {
    await PersistentStorage.removeItem(STORAGE_KEYS.PENDING_PACKAGE)
  }

  /**
   * Get the list of failed update hashes (filtered by expiration)
   * Automatically cleans up expired entries
   */
  static async getFailedUpdates(): Promise<string[]> {
    const entries = await this.getFailedUpdateEntries()
    return entries.map(e => e.packageHash)
  }

  /**
   * Get failed update entries with full metadata
   * Filters out expired entries and persists the cleanup
   */
  static async getFailedUpdateEntries(): Promise<FailedUpdateEntry[]> {
    const raw = await PersistentStorage.getItem<FailedUpdateEntry[] | string[]>(
      STORAGE_KEYS.FAILED_UPDATES,
      []
    )

    if (!raw || raw.length === 0) {
      return []
    }

    // Handle migration from old string[] format
    if (typeof raw[0] === 'string') {
      const migrated = (raw as string[]).map(hash => ({
        packageHash: hash,
        failedAt: Date.now(), // Assume failed recently during migration
      }))
      await this.setFailedUpdateEntries(migrated)
      return migrated
    }

    const entries = raw as FailedUpdateEntry[]
    const now = Date.now()

    // Filter out expired entries
    const validEntries = entries.filter(entry => now - entry.failedAt < FAILED_UPDATE_EXPIRY_MS)

    // Clean up expired entries if any were removed
    if (validEntries.length !== entries.length) {
      await this.setFailedUpdateEntries(validEntries)
    }

    return validEntries
  }

  /**
   * Mark an update as failed with timestamp
   */
  static async markUpdateFailed(packageHash: string, reason?: string): Promise<void> {
    const entries = await this.getFailedUpdateEntries()

    // Check if already exists
    if (entries.some(e => e.packageHash === packageHash)) {
      return // Already marked as failed
    }

    entries.push({
      packageHash,
      failedAt: Date.now(),
      reason,
    })

    await this.setFailedUpdateEntries(entries)
  }

  /**
   * Set the list of failed update hashes
   * Allows removing specific hashes or updating the entire list
   */
  static async setFailedUpdates(hashes: string[]): Promise<void> {
    if (hashes.length === 0) {
      await PersistentStorage.removeItem(STORAGE_KEYS.FAILED_UPDATES)
    } else {
      // Convert simple hashes to full entries (preserve existing timestamps if available)
      const existingEntries = await this.getFailedUpdateEntries()
      const now = Date.now()

      const entries: FailedUpdateEntry[] = hashes.map(hash => {
        const existing = existingEntries.find(e => e.packageHash === hash)
        return existing || { packageHash: hash, failedAt: now }
      })

      await this.setFailedUpdateEntries(entries)
    }
  }

  /**
   * Set failed update entries (internal)
   */
  private static async setFailedUpdateEntries(entries: FailedUpdateEntry[]): Promise<void> {
    if (entries.length === 0) {
      await PersistentStorage.removeItem(STORAGE_KEYS.FAILED_UPDATES)
    } else {
      await PersistentStorage.setItem(STORAGE_KEYS.FAILED_UPDATES, entries)
    }
  }

  /**
   * Clear failed updates list
   */
  static async clearFailedUpdates(): Promise<void> {
    await PersistentStorage.removeItem(STORAGE_KEYS.FAILED_UPDATES)
  }

  /**
   * Clear all storage
   */
  static async clear(): Promise<void> {
    await PersistentStorage.clear()
  }

  /**
   * Store package binary data (base64 encoded)
   * Automatically uses filesystem if available, otherwise falls back to in-memory
   */
  static async setPackageData(packageHash: string, base64Data: string): Promise<void> {
    if (FileSystem.isAvailable()) {
      try {
        const data = this.base64ToUint8Array(base64Data)
        await FileSystemStorage.setPackageData(packageHash, data)
        return
      } catch (error) {
        console.warn('[CodePush] Filesystem write failed, using persistent storage:', error)
      }
    }

    const key = `${STORAGE_KEYS.PACKAGE_DATA_PREFIX}${packageHash}`
    await PersistentStorage.setItem(key, base64Data)
  }

  /**
   * Retrieve package binary data
   * Automatically uses filesystem if available, otherwise falls back to in-memory
   */
  static async getPackageData(packageHash: string): Promise<string | null> {
    if (FileSystem.isAvailable()) {
      try {
        const data = await FileSystemStorage.getPackageData(packageHash)
        if (data !== null) {
          return this.uint8ArrayToBase64(data)
        }
      } catch (error) {
        console.warn('[CodePush] Filesystem read failed, using persistent storage:', error)
      }
    }

    const key = `${STORAGE_KEYS.PACKAGE_DATA_PREFIX}${packageHash}`
    return PersistentStorage.getItem<string>(key, null)
  }

  /**
   * Delete package binary data
   * Automatically uses filesystem if available, otherwise falls back to in-memory
   */
  static async deletePackageData(packageHash: string): Promise<void> {
    if (FileSystem.isAvailable()) {
      try {
        await FileSystemStorage.deletePackageData(packageHash)
      } catch (error) {
        console.warn('[CodePush] Filesystem delete failed:', error)
      }
    }

    const key = `${STORAGE_KEYS.PACKAGE_DATA_PREFIX}${packageHash}`
    await PersistentStorage.removeItem(key)
  }

  /**
   * Convert base64 string to Uint8Array
   */
  private static base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64)
    const len = binary.length
    const bytes = new Uint8Array(len)

    for (let i = 0; i < len; i++) {
      const code = binary.charCodeAt(i)
      if (!isNaN(code)) {
        bytes[i] = code
      }
    }

    return bytes
  }

  /**
   * Convert Uint8Array to base64 string
   */
  private static uint8ArrayToBase64(data: Uint8Array): string {
    let binary = ''
    const len = data.length

    for (let i = 0; i < len; i++) {
      const byte = data[i]
      if (byte !== undefined) {
        binary += String.fromCharCode(byte)
      }
    }

    return btoa(binary)
  }

  /**
   * Store install metadata for a package
   */
  static async setInstallMetadata(
    packageHash: string,
    metadata: { installMode: number; timestamp: number; minimumBackgroundDuration?: number }
  ): Promise<void> {
    const key = `${STORAGE_KEYS.INSTALL_METADATA_PREFIX}${packageHash}`
    await PersistentStorage.setItem(key, metadata)
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
    return PersistentStorage.getItem(key, null)
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
    await PersistentStorage.setItem(key, metadata)
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
    return PersistentStorage.getItem(key, null)
  }

  /**
   * Clear rollback metadata for a package
   */
  static async clearRollbackMetadata(packageHash?: string): Promise<void> {
    if (packageHash) {
      const key = `${STORAGE_KEYS.ROLLBACK_METADATA_PREFIX}${packageHash}`
      await PersistentStorage.removeItem(key)
    } else {
      // Clear all rollback metadata
      const keys = await PersistentStorage.getKeys(STORAGE_KEYS.ROLLBACK_METADATA_PREFIX)
      for (const key of keys) {
        await PersistentStorage.removeItem(key)
      }
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
    await PersistentStorage.setItem(STORAGE_KEYS.PACKAGE_HISTORY, trimmed)
  }

  /**
   * Get package history (up to last 3 versions)
   */
  static async getPackageHistory(): Promise<Package[]> {
    return (await PersistentStorage.getItem<Package[]>(STORAGE_KEYS.PACKAGE_HISTORY, [])) || []
  }

  /**
   * Get a specific package by hash from history
   */
  static async getPackageByHash(packageHash: string): Promise<Package | null> {
    const history = await this.getPackageHistory()
    return history.find(p => p.packageHash === packageHash) || null
  }

  /**
   * Reset storage state (for testing)
   * @internal
   */
  static reset(): void {
    PersistentStorage.reset()
  }
}
