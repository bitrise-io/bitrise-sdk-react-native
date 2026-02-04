import { UpdateError } from '../types/errors'
import { PackageStorage } from '../storage/PackageStorage'

/**
 * Get platform-specific CodePush storage directory
 * For MVP, returns placeholder path (actual filesystem storage deferred to future phase)
 * @returns Directory path for CodePush packages
 */
export function getCodePushDirectory(): string {
  // TODO: Implement platform-specific paths when filesystem storage is added
  // iOS: ${DocumentDirectory}/codepush/
  // Android: ${CacheDirectory}/codepush/
  return '/codepush'
}

/**
 * Calculate SHA-256 hash of data
 * Uses Web Crypto API if available, otherwise returns "unverified"
 *
 * @param data - Data to hash
 * @returns Promise resolving to hex-encoded hash string
 */
export async function calculateHash(data: Uint8Array): Promise<string> {
  try {
    // Check if Web Crypto API is available
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      // Create a new buffer to ensure compatibility
      const buffer = new Uint8Array(data).buffer
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      return hashHex
    }

    // Fallback: Web Crypto not available
    console.warn(
      '[CodePush] Web Crypto API not available. Hash verification disabled. HTTPS provides transport security.'
    )
    return 'unverified'
  } catch (error) {
    console.warn(
      '[CodePush] Hash calculation failed:',
      error instanceof Error ? error.message : String(error)
    )
    return 'unverified'
  }
}

/**
 * Save package data to storage
 * MVP: Stores as base64 in PackageStorage (limited to ~5 MB packages)
 * Future: Use filesystem storage for larger packages
 *
 * @param packageHash - Unique hash identifier for the package
 * @param data - Package binary data
 * @returns Promise resolving to local path (logical path for MVP)
 */
export async function savePackage(packageHash: string, data: Uint8Array): Promise<string> {
  try {
    // TODO: Support larger packages (>5 MB) with proper filesystem storage
    // Current limitation: base64 storage limited to ~5 MB packages
    // Future enhancement: Use react-native-fs or Expo FileSystem for file storage

    // Check package size (warn if >5 MB)
    const sizeInMB = data.length / (1024 * 1024)
    if (sizeInMB > 5) {
      console.warn(
        `[CodePush] Package size (${sizeInMB.toFixed(2)} MB) exceeds recommended limit (5 MB). ` +
          'Large packages may cause memory issues with base64 storage.'
      )
    }

    // Convert to base64 and store in PackageStorage
    const base64Data = uint8ArrayToBase64(data)
    await PackageStorage.setPackageData(packageHash, base64Data)

    // Return logical path (not actual filesystem path for MVP)
    const localPath = `${getCodePushDirectory()}/${packageHash}/index.bundle`
    return localPath
  } catch (error) {
    throw new UpdateError('Failed to save package data', {
      packageHash,
      error: error instanceof Error ? error.message : String(error),
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
    console.error(
      '[CodePush] Failed to load package:',
      error instanceof Error ? error.message : String(error)
    )
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
    console.error(
      '[CodePush] Failed to delete package:',
      error instanceof Error ? error.message : String(error)
    )
  }
}

/**
 * Extract package hash from logical path
 * Path format: /codepush/{packageHash}/index.bundle
 */
function extractPackageHashFromPath(localPath: string): string | null {
  const match = localPath.match(/\/codepush\/([^/]+)\//)
  return match && match[1] ? match[1] : null
}

/**
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(data: Uint8Array): string {
  let binary = ''
  const len = data.length
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(data[i] as number)
  }
  return btoa(binary)
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i) & 0xff
  }
  return bytes
}
