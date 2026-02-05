import { getErrorMessage } from './error'
import { FileSystem } from '../native/FileSystem'

/**
 * Storage utilities for JSON serialization/deserialization
 * Provides consistent storage operations with error handling across the SDK
 * Supports both in-memory cache and persistent filesystem storage
 */

/** Operation queue for ensuring thread-safe writes */
const operationQueue: Map<string, Promise<unknown>> = new Map()

/**
 * Execute an operation with mutex-like behavior per key
 * Ensures sequential writes to the same key
 */
async function withLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const existingOperation = operationQueue.get(key)

  const newOperation = (async () => {
    if (existingOperation) {
      try {
        await existingOperation
      } catch {
        // Ignore errors from previous operation
      }
    }
    return operation()
  })()

  operationQueue.set(key, newOperation)

  try {
    return await newOperation
  } finally {
    if (operationQueue.get(key) === newOperation) {
      operationQueue.delete(key)
    }
  }
}

/**
 * Retrieves and parses JSON data from storage
 * Returns default value if key doesn't exist or parse fails
 *
 * @param storage - Storage map (e.g., Map<string, string>)
 * @param key - Storage key
 * @param defaultValue - Value to return if key not found or parse fails
 * @returns Parsed value or default value
 *
 * @example
 * ```typescript
 * const cache = new Map<string, string>()
 * const pkg = getStorageItem<Package>(cache, 'currentPackage', null)
 * ```
 */
export function getStorageItem<T>(
  storage: Map<string, string>,
  key: string,
  defaultValue: T | null = null
): T | null {
  const data = storage.get(key)
  if (!data) {
    return defaultValue
  }

  try {
    return JSON.parse(data) as T
  } catch (error) {
    console.warn(`[CodePush] Failed to parse ${key}:`, getErrorMessage(error))
    return defaultValue
  }
}

/**
 * Serializes and saves data to storage
 * Does not throw - logs errors and returns success status
 *
 * @param storage - Storage map
 * @param key - Storage key
 * @param value - Value to serialize and store
 * @returns Success status
 *
 * @example
 * ```typescript
 * const cache = new Map<string, string>()
 * setStorageItem(cache, 'currentPackage', packageData)
 * ```
 */
export function setStorageItem<T>(storage: Map<string, string>, key: string, value: T): boolean {
  try {
    storage.set(key, JSON.stringify(value))
    return true
  } catch (error) {
    console.warn(`[CodePush] Failed to save ${key}:`, getErrorMessage(error))
    return false
  }
}

/**
 * Removes item from storage
 * Does not throw - always succeeds
 *
 * @param storage - Storage map
 * @param key - Storage key
 *
 * @example
 * ```typescript
 * const cache = new Map<string, string>()
 * removeStorageItem(cache, 'pendingPackage')
 * ```
 */
export function removeStorageItem(storage: Map<string, string>, key: string): void {
  storage.delete(key)
}

/**
 * Clears all items from storage
 * Does not throw - always succeeds
 *
 * @param storage - Storage map
 *
 * @example
 * ```typescript
 * const cache = new Map<string, string>()
 * clearStorage(cache)
 * ```
 */
export function clearStorage(storage: Map<string, string>): void {
  storage.clear()
}

/**
 * PersistentStorage provides filesystem-backed storage with in-memory caching
 * Thread-safe through operation queuing
 */
export class PersistentStorage {
  private static cache: Map<string, string> = new Map()
  private static initialized = false
  private static initPromise: Promise<void> | null = null
  private static storageDir: string | null = null

  /**
   * Initialize persistent storage
   * Loads existing data from filesystem into memory cache
   */
  private static async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this.performInitialization()
    await this.initPromise
  }

  private static async performInitialization(): Promise<void> {
    if (!FileSystem.isAvailable()) {
      console.warn('[CodePush] FileSystem not available, using in-memory storage only')
      this.initialized = true
      return
    }

    try {
      this.storageDir = await FileSystem.getStorageDirectory()
      await FileSystem.createDirectory(`${this.storageDir}/sdk`)

      // Load existing metadata into cache
      const metadataPath = `${this.storageDir}/sdk/metadata.json`
      const data = await FileSystem.readFile(metadataPath)

      if (data !== null) {
        const json = new TextDecoder().decode(data)
        const parsed = JSON.parse(json) as Record<string, string>
        for (const [key, value] of Object.entries(parsed)) {
          this.cache.set(key, value)
        }
      }
    } catch (error) {
      console.warn('[CodePush] Failed to initialize persistent storage:', getErrorMessage(error))
    }

    this.initialized = true
  }

  /**
   * Persist the in-memory cache to filesystem
   */
  private static async persist(): Promise<void> {
    if (!FileSystem.isAvailable() || !this.storageDir) {
      return
    }

    const data: Record<string, string> = {}
    for (const [key, value] of this.cache.entries()) {
      data[key] = value
    }

    const json = JSON.stringify(data)
    const bytes = new TextEncoder().encode(json)
    const metadataPath = `${this.storageDir}/sdk/metadata.json`

    await FileSystem.writeFile(metadataPath, bytes)
  }

  /**
   * Get an item from persistent storage
   */
  static async getItem<T>(key: string, defaultValue: T | null = null): Promise<T | null> {
    await this.initialize()

    const data = this.cache.get(key)
    if (!data) {
      return defaultValue
    }

    try {
      return JSON.parse(data) as T
    } catch (error) {
      console.warn(`[CodePush] Failed to parse ${key}:`, getErrorMessage(error))
      return defaultValue
    }
  }

  /**
   * Set an item in persistent storage (thread-safe)
   */
  static async setItem<T>(key: string, value: T): Promise<boolean> {
    return withLock(key, async () => {
      await this.initialize()

      try {
        this.cache.set(key, JSON.stringify(value))
        await this.persist()
        return true
      } catch (error) {
        console.warn(`[CodePush] Failed to save ${key}:`, getErrorMessage(error))
        return false
      }
    })
  }

  /**
   * Remove an item from persistent storage (thread-safe)
   */
  static async removeItem(key: string): Promise<void> {
    await withLock(key, async () => {
      await this.initialize()
      this.cache.delete(key)
      await this.persist()
    })
  }

  /**
   * Clear all items from persistent storage
   */
  static async clear(): Promise<void> {
    await withLock('__clear__', async () => {
      await this.initialize()
      this.cache.clear()
      await this.persist()
    })
  }

  /**
   * Get all keys matching a prefix
   */
  static async getKeys(prefix?: string): Promise<string[]> {
    await this.initialize()

    const keys = Array.from(this.cache.keys())
    if (prefix) {
      return keys.filter(key => key.startsWith(prefix))
    }
    return keys
  }

  /**
   * Reset storage state (for testing)
   * @internal
   */
  static reset(): void {
    this.cache.clear()
    this.initialized = false
    this.initPromise = null
    this.storageDir = null
    operationQueue.clear()
  }
}
