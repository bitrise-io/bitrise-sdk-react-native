import { FileSystem } from '../native/FileSystem'
import { encodeText, decodeText } from '../utils/text'

/**
 * FileSystemStorage provides persistent file system storage for CodePush packages
 * Stores packages and metadata in native filesystem
 *
 * Storage structure:
 * - {storageDir}/packages/{hash}.dat - Package binary data
 * - {storageDir}/metadata/{hash}.json - Package metadata
 *
 * @example
 * ```typescript
 * await FileSystemStorage.setPackageData(hash, data)
 * const data = await FileSystemStorage.getPackageData(hash)
 * ```
 */
export class FileSystemStorage {
  private static storageDir: string | null = null

  /**
   * Get the storage directory, initializing if needed
   */
  private static async getStorageDir(): Promise<string> {
    if (this.storageDir === null) {
      this.storageDir = await FileSystem.getStorageDirectory()
      await FileSystem.createDirectory(`${this.storageDir}/packages`)
      await FileSystem.createDirectory(`${this.storageDir}/metadata`)
    }
    return this.storageDir
  }

  /**
   * Get package file path
   */
  private static async getPackagePath(hash: string): Promise<string> {
    const storageDir = await this.getStorageDir()
    return `${storageDir}/packages/${hash}.dat`
  }

  /**
   * Get metadata file path
   */
  private static async getMetadataPath(hash: string): Promise<string> {
    const storageDir = await this.getStorageDir()
    return `${storageDir}/metadata/${hash}.json`
  }

  /**
   * Store package data
   * @param hash Package hash
   * @param data Binary data as Uint8Array
   */
  static async setPackageData(hash: string, data: Uint8Array): Promise<void> {
    const path = await this.getPackagePath(hash)
    await FileSystem.writeFile(path, data)
  }

  /**
   * Retrieve package data
   * @param hash Package hash
   * @returns Binary data as Uint8Array, or null if not found
   */
  static async getPackageData(hash: string): Promise<Uint8Array | null> {
    const path = await this.getPackagePath(hash)
    return FileSystem.readFile(path)
  }

  /**
   * Delete package data
   * @param hash Package hash
   * @returns true if deleted, false if not found
   */
  static async deletePackageData(hash: string): Promise<boolean> {
    const path = await this.getPackagePath(hash)
    return FileSystem.deleteFile(path)
  }

  /**
   * Check if package data exists
   * @param hash Package hash
   */
  static async hasPackageData(hash: string): Promise<boolean> {
    const path = await this.getPackagePath(hash)
    return FileSystem.fileExists(path)
  }

  /**
   * Get package data size in bytes
   * @param hash Package hash
   * @returns Size in bytes, or 0 if not found
   */
  static async getPackageSize(hash: string): Promise<number> {
    const path = await this.getPackagePath(hash)
    return FileSystem.getFileSize(path)
  }

  /**
   * Store package metadata
   * @param hash Package hash
   * @param metadata Metadata object
   */
  static async setPackageMetadata(hash: string, metadata: unknown): Promise<void> {
    const path = await this.getMetadataPath(hash)
    const json = JSON.stringify(metadata)
    const data = encodeText(json)
    await FileSystem.writeFile(path, data)
  }

  /**
   * Retrieve package metadata
   * @param hash Package hash
   * @returns Metadata object, or null if not found
   */
  static async getPackageMetadata(hash: string): Promise<unknown | null> {
    const path = await this.getMetadataPath(hash)
    const data = await FileSystem.readFile(path)

    if (data === null) {
      return null
    }

    const json = decodeText(data)
    return JSON.parse(json)
  }

  /**
   * Delete package metadata
   * @param hash Package hash
   * @returns true if deleted, false if not found
   */
  static async deletePackageMetadata(hash: string): Promise<boolean> {
    const path = await this.getMetadataPath(hash)
    return FileSystem.deleteFile(path)
  }

  /**
   * Delete all package data and metadata
   * @param hash Package hash
   */
  static async deletePackage(hash: string): Promise<void> {
    await Promise.all([this.deletePackageData(hash), this.deletePackageMetadata(hash)])
  }

  /**
   * List all stored package hashes
   * @returns Array of package hashes
   */
  static async listPackages(): Promise<string[]> {
    const storageDir = await this.getStorageDir()
    const files = await FileSystem.listDirectory(`${storageDir}/packages`)

    return files.filter(file => file.endsWith('.dat')).map(file => file.replace('.dat', ''))
  }

  /**
   * Clear all stored packages and metadata
   */
  static async clearAll(): Promise<void> {
    const hashes = await this.listPackages()
    await Promise.all(hashes.map(hash => this.deletePackage(hash)))
  }
}
