import { getErrorMessage } from './error'

/**
 * Storage utilities for JSON serialization/deserialization
 * Provides consistent storage operations with error handling across the SDK
 */

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
