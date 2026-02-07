import { UpdateError } from '../types/errors'
import { PackageStorage } from '../storage/PackageStorage'
import { getErrorMessage } from './error'
import { uint8ArrayToBase64, base64ToUint8Array } from './base64'

import { Platform } from 'react-native'

/**
 * Get platform-specific CodePush storage directory
 * Returns logical path for current in-memory storage
 * When filesystem storage is implemented, these paths will map to actual directories:
 * - iOS: ${DocumentDirectory}/CodePush/
 * - Android: ${FilesDir}/CodePush/
 *
 * @returns Directory path for CodePush packages
 *
 * @example
 * ```typescript
 * const dir = getCodePushDirectory()
 * // Returns: "file:///var/mobile/Containers/Data/Application/.../Documents/CodePush" (iOS)
 * // Returns: "file:///data/user/0/com.app/files/CodePush" (Android)
 * ```
 */
export function getCodePushDirectory(): string {
  // Platform-specific logical paths
  // These will be used when filesystem storage is implemented
  if (Platform.OS === 'ios') {
    // iOS: Use Documents directory (persisted, backed up to iCloud)
    // In production: will map to NSDocumentDirectory/CodePush
    return '/Documents/CodePush'
  } else if (Platform.OS === 'android') {
    // Android: Use internal files directory (persisted, private to app)
    // In production: will map to Context.getFilesDir()/CodePush
    return '/files/CodePush'
  }

  // Fallback for other platforms (web, windows, etc.)
  return '/CodePush'
}

/**
 * Calculate SHA-256 hash of data
 * Uses Web Crypto API if available, otherwise returns "unverified"
 * Note: React Native doesn't have Web Crypto API by default
 *
 * @param data - Data to hash
 * @returns Promise resolving to hex-encoded hash string
 */
export async function calculateHash(data: Uint8Array): Promise<string> {
  try {
    // Check if Web Crypto API is available (not available in React Native by default)
    if (
      typeof crypto !== 'undefined' &&
      crypto.subtle &&
      typeof crypto.subtle.digest === 'function'
    ) {
      // Create a new buffer to ensure compatibility
      const buffer = new Uint8Array(data).buffer
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      return hashHex
    }
  } catch {
    // crypto.subtle threw - fall through to unverified
  }

  // Fallback: Web Crypto not available (common in React Native)
  // HTTPS provides transport security, hash verification is optional
  return 'unverified'
}

/**
 * Maximum recommended package size for in-memory storage (10 MB)
 * Larger packages should use filesystem storage when available
 */
const MAX_RECOMMENDED_SIZE_MB = 10

/**
 * Maximum supported package size for in-memory storage (50 MB)
 * Packages larger than this will be rejected
 */
const MAX_SUPPORTED_SIZE_MB = 50

/**
 * Save package data to storage
 * Current: Stores as base64 in PackageStorage (supports up to 50 MB)
 * Recommended: Keep packages under 10 MB for optimal performance
 * Future: Will use filesystem storage for larger packages automatically
 *
 * @param packageHash - Unique hash identifier for the package
 * @param data - Package binary data
 * @returns Promise resolving to local path (logical path for current implementation)
 * @throws UpdateError if package is too large or storage fails
 *
 * @example
 * ```typescript
 * const data = new Uint8Array([...])
 * const path = await savePackage('abc123', data)
 * // Returns: "/Documents/CodePush/abc123/index.bundle" (iOS)
 * ```
 */
export async function savePackage(packageHash: string, data: Uint8Array): Promise<string> {
  try {
    // Validate package size
    const sizeInMB = data.length / (1024 * 1024)

    // Reject packages that are too large for in-memory storage
    if (sizeInMB > MAX_SUPPORTED_SIZE_MB) {
      throw new UpdateError(
        `Package size (${sizeInMB.toFixed(2)} MB) exceeds maximum supported size (${MAX_SUPPORTED_SIZE_MB} MB)`,
        {
          packageHash,
          error: 'Package too large for in-memory storage',
        }
      )
    }

    // Warn if package exceeds recommended size
    if (sizeInMB > MAX_RECOMMENDED_SIZE_MB) {
      console.warn(
        `[CodePush] Package size (${sizeInMB.toFixed(2)} MB) exceeds recommended limit ` +
          `(${MAX_RECOMMENDED_SIZE_MB} MB). Consider reducing bundle size for better performance.`
      )
    }

    // Convert to base64 and store in PackageStorage
    // Note: This uses ~33% more memory due to base64 encoding
    const base64Data = uint8ArrayToBase64(data)
    await PackageStorage.setPackageData(packageHash, base64Data)

    // Return logical path that will map to actual filesystem when implemented
    const localPath = `${getCodePushDirectory()}/${packageHash}/index.bundle`
    return localPath
  } catch (error) {
    if (error instanceof UpdateError) {
      throw error
    }
    throw new UpdateError('Failed to save package data', {
      packageHash,
      error: getErrorMessage(error),
    })
  }
}

/**
 * Load package data from storage
 * MVP: Retrieves base64 data from PackageStorage
 *
 * @param localPath - Local path to the package (logical path for MVP)
 * @returns Promise resolving to package data or null if not found
 */
export async function loadPackage(localPath: string): Promise<Uint8Array | null> {
  try {
    // Extract packageHash from path
    const packageHash = extractPackageHashFromPath(localPath)
    if (!packageHash) {
      return null
    }

    // Retrieve from PackageStorage
    const base64Data = await PackageStorage.getPackageData(packageHash)
    if (!base64Data) {
      return null
    }

    // Convert from base64 to Uint8Array
    return base64ToUint8Array(base64Data)
  } catch (error) {
    console.error('[CodePush] Failed to load package:', getErrorMessage(error))
    return null
  }
}

/**
 * Delete package from storage
 *
 * @param localPath - Local path to the package
 */
export async function deletePackage(localPath: string): Promise<void> {
  try {
    // Extract packageHash from path
    const packageHash = extractPackageHashFromPath(localPath)
    if (!packageHash) {
      return
    }

    // Delete from PackageStorage
    await PackageStorage.deletePackageData(packageHash)
  } catch (error) {
    // Don't throw - deletion failures should not crash the app
    console.error('[CodePush] Failed to delete package:', getErrorMessage(error))
  }
}

/**
 * Extract package hash from logical path
 * Supports multiple path formats:
 * - Legacy: /codepush/{packageHash}/index.bundle
 * - iOS: /Documents/CodePush/{packageHash}/index.bundle
 * - Android: /files/CodePush/{packageHash}/index.bundle
 * - Generic: /CodePush/{packageHash}/index.bundle
 *
 * @param localPath - The path to extract hash from
 * @returns Package hash or null if not found
 */
function extractPackageHashFromPath(localPath: string): string | null {
  // Try all supported path patterns
  const patterns = [
    /\/CodePush\/([^/]+)\//i, // New format (case-insensitive)
    /\/codepush\/([^/]+)\//, // Legacy format
  ]

  for (const pattern of patterns) {
    const match = localPath.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

