import { NativeModules } from 'react-native'
import { FileSystemError } from '../types/errors'

/**
 * Native module interface for file system operations
 */
interface FileSystemNativeModule {
  getDocumentsDirectory(): Promise<string>
  writeFile(path: string, base64Data: string): Promise<boolean>
  readFile(path: string): Promise<string | null>
  deleteFile(path: string): Promise<boolean>
  fileExists(path: string): Promise<boolean>
  getFileSize(path: string): Promise<number>
  createDirectory(path: string): Promise<boolean>
  listDirectory(path: string): Promise<string[]>
}

/**
 * FileSystem provides native file system operations for storing CodePush packages
 * Falls back gracefully if native module is unavailable
 *
 * @example
 * ```typescript
 * if (FileSystem.isAvailable()) {
 *   await FileSystem.writeFile('/path/to/file', data)
 *   const data = await FileSystem.readFile('/path/to/file')
 * }
 * ```
 */
export class FileSystem {
  private static _nativeModule: FileSystemNativeModule | null | undefined = undefined

  /**
   * Get native module instance (lazy initialization)
   */
  private static get nativeModule(): FileSystemNativeModule | null {
    if (this._nativeModule === undefined) {
      this._nativeModule = (NativeModules.BitriseFileSystem as FileSystemNativeModule) || null
    }
    return this._nativeModule
  }

  /**
   * Check if native file system module is available
   * Returns false in environments without native modules (e.g., web)
   */
  static isAvailable(): boolean {
    return this.nativeModule !== null && this.nativeModule !== undefined
  }

  /**
   * Get the CodePush storage directory path
   * @throws {FileSystemError} If native module is unavailable
   */
  static async getStorageDirectory(): Promise<string> {
    if (!this.isAvailable()) {
      throw new FileSystemError('FileSystem not available', {
        code: 'NOT_AVAILABLE',
      })
    }

    try {
      return await this.nativeModule!.getDocumentsDirectory()
    } catch (error) {
      throw new FileSystemError('Failed to get storage directory', {
        code: 'GET_DIR_ERROR',
        originalError: error,
      })
    }
  }

  /**
   * Write data to file
   * @param path Absolute file path
   * @param data Binary data as Uint8Array
   * @throws {FileSystemError} If write fails
   */
  static async writeFile(path: string, data: Uint8Array): Promise<void> {
    if (!this.isAvailable()) {
      throw new FileSystemError('FileSystem not available', {
        code: 'NOT_AVAILABLE',
        path,
      })
    }

    try {
      const base64 = this.uint8ArrayToBase64(data)
      await this.nativeModule!.writeFile(path, base64)
    } catch (error) {
      throw new FileSystemError('Failed to write file', {
        code: 'WRITE_ERROR',
        path,
        originalError: error,
      })
    }
  }

  /**
   * Read file contents
   * @param path Absolute file path
   * @returns Binary data as Uint8Array, or null if file doesn't exist
   * @throws {FileSystemError} If read fails
   */
  static async readFile(path: string): Promise<Uint8Array | null> {
    if (!this.isAvailable()) {
      throw new FileSystemError('FileSystem not available', {
        code: 'NOT_AVAILABLE',
        path,
      })
    }

    try {
      const base64 = await this.nativeModule!.readFile(path)

      if (base64 === null) {
        return null
      }

      return this.base64ToUint8Array(base64)
    } catch (error) {
      throw new FileSystemError('Failed to read file', {
        code: 'READ_ERROR',
        path,
        originalError: error,
      })
    }
  }

  /**
   * Delete file
   * @param path Absolute file path
   * @returns true if file was deleted, false if file didn't exist
   * @throws {FileSystemError} If delete fails
   */
  static async deleteFile(path: string): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new FileSystemError('FileSystem not available', {
        code: 'NOT_AVAILABLE',
        path,
      })
    }

    try {
      return await this.nativeModule!.deleteFile(path)
    } catch (error) {
      throw new FileSystemError('Failed to delete file', {
        code: 'DELETE_ERROR',
        path,
        originalError: error,
      })
    }
  }

  /**
   * Check if file exists
   * @param path Absolute file path
   * @throws {FileSystemError} If check fails
   */
  static async fileExists(path: string): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new FileSystemError('FileSystem not available', {
        code: 'NOT_AVAILABLE',
        path,
      })
    }

    try {
      return await this.nativeModule!.fileExists(path)
    } catch (error) {
      throw new FileSystemError('Failed to check file existence', {
        code: 'EXISTS_ERROR',
        path,
        originalError: error,
      })
    }
  }

  /**
   * Get file size in bytes
   * @param path Absolute file path
   * @returns File size in bytes, or 0 if file doesn't exist
   * @throws {FileSystemError} If stat fails
   */
  static async getFileSize(path: string): Promise<number> {
    if (!this.isAvailable()) {
      throw new FileSystemError('FileSystem not available', {
        code: 'NOT_AVAILABLE',
        path,
      })
    }

    try {
      return await this.nativeModule!.getFileSize(path)
    } catch (error) {
      throw new FileSystemError('Failed to get file size', {
        code: 'STAT_ERROR',
        path,
        originalError: error,
      })
    }
  }

  /**
   * Create directory with intermediate directories
   * @param path Absolute directory path
   * @throws {FileSystemError} If creation fails
   */
  static async createDirectory(path: string): Promise<void> {
    if (!this.isAvailable()) {
      throw new FileSystemError('FileSystem not available', {
        code: 'NOT_AVAILABLE',
        path,
      })
    }

    try {
      await this.nativeModule!.createDirectory(path)
    } catch (error) {
      throw new FileSystemError('Failed to create directory', {
        code: 'CREATE_DIR_ERROR',
        path,
        originalError: error,
      })
    }
  }

  /**
   * List directory contents
   * @param path Absolute directory path
   * @returns Array of file/directory names (not full paths)
   * @throws {FileSystemError} If listing fails
   */
  static async listDirectory(path: string): Promise<string[]> {
    if (!this.isAvailable()) {
      throw new FileSystemError('FileSystem not available', {
        code: 'NOT_AVAILABLE',
        path,
      })
    }

    try {
      return await this.nativeModule!.listDirectory(path)
    } catch (error) {
      throw new FileSystemError('Failed to list directory', {
        code: 'LIST_ERROR',
        path,
        originalError: error,
      })
    }
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
}
