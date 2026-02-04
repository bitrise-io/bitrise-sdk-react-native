import {
  getCodePushDirectory,
  calculateHash,
  savePackage,
  loadPackage,
  deletePackage,
} from '../file'
import { PackageStorage } from '../../storage/PackageStorage'
import { UpdateError } from '../../types/errors'

// Mock PackageStorage
jest.mock('../../storage/PackageStorage', () => ({
  PackageStorage: {
    setPackageData: jest.fn(),
    getPackageData: jest.fn(),
    deletePackageData: jest.fn(),
  },
}))

describe('file utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'warn').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getCodePushDirectory', () => {
    it('should return platform-specific directory path', () => {
      const dir = getCodePushDirectory()
      // Platform.OS defaults to 'ios' in Jest environment
      expect(dir).toMatch(/CodePush/)
      expect(typeof dir).toBe('string')
    })

    it('should return iOS path when on iOS', () => {
      // Platform.OS is 'ios' in test environment
      const dir = getCodePushDirectory()
      expect(dir).toBe('/Documents/CodePush')
    })
  })

  describe('calculateHash', () => {
    it('should calculate SHA-256 hash using Web Crypto API', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5])
      const hash = await calculateHash(data)

      // Should return a 64-character hex string (SHA-256)
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should return "unverified" if Web Crypto API is unavailable', async () => {
      const originalCrypto = global.crypto
      // @ts-expect-error - Testing unavailable crypto
      delete global.crypto

      const data = new Uint8Array([1, 2, 3])
      const hash = await calculateHash(data)

      expect(hash).toBe('unverified')
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Web Crypto API not available')
      )

      global.crypto = originalCrypto
    })

    it('should return "unverified" if hash calculation throws error', async () => {
      const originalCrypto = global.crypto
      // @ts-expect-error - Mock crypto with failing digest
      global.crypto = {
        subtle: {
          digest: jest.fn().mockRejectedValue(new Error('Hash failed')),
        },
      }

      const data = new Uint8Array([1, 2, 3])
      const hash = await calculateHash(data)

      expect(hash).toBe('unverified')
      expect(console.warn).toHaveBeenCalledWith(
        '[CodePush] Hash calculation failed:',
        'Hash failed'
      )

      global.crypto = originalCrypto
    })
  })

  describe('savePackage', () => {
    it('should save package data as base64', async () => {
      const packageHash = 'abc123'
      const data = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"

      const localPath = await savePackage(packageHash, data)

      expect(PackageStorage.setPackageData).toHaveBeenCalledWith(packageHash, expect.any(String))
      // Platform-specific path (iOS in test env)
      expect(localPath).toBe('/Documents/CodePush/abc123/index.bundle')
    })

    it('should not warn for packages under 10 MB', async () => {
      const packageHash = 'medium123'
      const mediumData = new Uint8Array(6 * 1024 * 1024) // 6 MB

      await savePackage(packageHash, mediumData)

      // Should not warn for 6 MB (under 10 MB threshold)
      expect(console.warn).not.toHaveBeenCalled()
    })

    it('should warn for large packages (>10 MB)', async () => {
      const packageHash = 'large123'
      const largeData = new Uint8Array(15 * 1024 * 1024) // 15 MB

      await savePackage(packageHash, largeData)

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Package size (15.00 MB) exceeds recommended limit')
      )
    })

    it('should reject very large packages (>50 MB)', async () => {
      const packageHash = 'huge123'
      const hugeData = new Uint8Array(60 * 1024 * 1024) // 60 MB

      await expect(savePackage(packageHash, hugeData)).rejects.toThrow(UpdateError)
      await expect(savePackage(packageHash, hugeData)).rejects.toThrow(
        'exceeds maximum supported size'
      )
    })

    it('should throw UpdateError if storage fails', async () => {
      const packageHash = 'fail123'
      const data = new Uint8Array([1, 2, 3])

      ;(PackageStorage.setPackageData as jest.Mock).mockRejectedValue(new Error('Storage error'))

      await expect(savePackage(packageHash, data)).rejects.toThrow(UpdateError)
      await expect(savePackage(packageHash, data)).rejects.toThrow('Failed to save package data')
    })
  })

  describe('loadPackage', () => {
    it('should load package data from storage', async () => {
      const localPath = '/Documents/CodePush/abc123/index.bundle'
      const base64Data = 'SGVsbG8=' // "Hello" in base64

      ;(PackageStorage.getPackageData as jest.Mock).mockResolvedValue(base64Data)

      const data = await loadPackage(localPath)

      expect(PackageStorage.getPackageData).toHaveBeenCalledWith('abc123')
      expect(data).toBeInstanceOf(Uint8Array)
      expect(data).toEqual(new Uint8Array([72, 101, 108, 108, 111]))
    })

    it('should return null if package not found', async () => {
      const localPath = '/Documents/CodePush/notfound/index.bundle'

      ;(PackageStorage.getPackageData as jest.Mock).mockResolvedValue(null)

      const data = await loadPackage(localPath)

      expect(data).toBeNull()
    })

    it('should return null if path is invalid', async () => {
      const invalidPath = '/invalid/path'

      const data = await loadPackage(invalidPath)

      expect(data).toBeNull()
      expect(PackageStorage.getPackageData).not.toHaveBeenCalled()
    })

    it('should return null and log error if load fails', async () => {
      const localPath = '/Documents/CodePush/error123/index.bundle'

      ;(PackageStorage.getPackageData as jest.Mock).mockRejectedValue(new Error('Load error'))

      const data = await loadPackage(localPath)

      expect(data).toBeNull()
      expect(console.error).toHaveBeenCalledWith('[CodePush] Failed to load package:', 'Load error')
    })

    it('should work with legacy paths', async () => {
      const legacyPath = '/codepush/abc123/index.bundle'
      const base64Data = 'SGVsbG8='

      ;(PackageStorage.getPackageData as jest.Mock).mockResolvedValue(base64Data)

      const data = await loadPackage(legacyPath)

      expect(data).not.toBeNull()
      expect(PackageStorage.getPackageData).toHaveBeenCalledWith('abc123')
    })
  })

  describe('deletePackage', () => {
    it('should delete package from storage', async () => {
      const localPath = '/Documents/CodePush/abc123/index.bundle'

      await deletePackage(localPath)

      expect(PackageStorage.deletePackageData).toHaveBeenCalledWith('abc123')
    })

    it('should not throw if package not found', async () => {
      const localPath = '/Documents/CodePush/notfound/index.bundle'

      ;(PackageStorage.deletePackageData as jest.Mock).mockRejectedValue(new Error('Not found'))

      // Should not throw
      await expect(deletePackage(localPath)).resolves.toBeUndefined()

      expect(console.error).toHaveBeenCalledWith(
        '[CodePush] Failed to delete package:',
        'Not found'
      )
    })

    it('should handle invalid path gracefully', async () => {
      const invalidPath = '/invalid/path'

      // Should not throw
      await expect(deletePackage(invalidPath)).resolves.toBeUndefined()

      expect(PackageStorage.deletePackageData).not.toHaveBeenCalled()
    })

    it('should work with legacy paths', async () => {
      const legacyPath = '/codepush/abc123/index.bundle'

      await deletePackage(legacyPath)

      expect(PackageStorage.deletePackageData).toHaveBeenCalledWith('abc123')
    })
  })
})
