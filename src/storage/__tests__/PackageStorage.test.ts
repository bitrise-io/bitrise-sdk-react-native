import { PackageStorage } from '../PackageStorage'
import type { Package, LocalPackage } from '../../types/package'
import { FileSystem } from '../../native/FileSystem'
import { FileSystemStorage } from '../FileSystemStorage'

// Mock FileSystem and FileSystemStorage
jest.mock('../../native/FileSystem')
jest.mock('../FileSystemStorage')

describe('PackageStorage', () => {
  const mockPackage: Package = {
    appVersion: '1.0.0',
    deploymentKey: 'test-key',
    description: 'Test package',
    failedInstall: false,
    isFirstRun: false,
    isMandatory: false,
    isPending: false,
    label: 'v1',
    packageHash: 'hash123',
    packageSize: 1024,
  }

  const createMockLocalPackage = (): LocalPackage => ({
    ...mockPackage,
    localPath: '/path/to/package',
    install: async () => {},
  })

  beforeEach(async () => {
    // Reset storage state before each test
    PackageStorage.reset()
    jest.clearAllMocks()

    // Default: FileSystem not available
    ;(FileSystem.isAvailable as jest.Mock).mockReturnValue(false)
  })

  describe('getCurrentPackage', () => {
    it('should return null when no package is stored', async () => {
      const result = await PackageStorage.getCurrentPackage()
      expect(result).toBeNull()
    })

    it('should return stored package', async () => {
      await PackageStorage.setCurrentPackage(mockPackage)
      const result = await PackageStorage.getCurrentPackage()
      expect(result).toEqual(mockPackage)
    })

    it('should return null after clear', async () => {
      await PackageStorage.setCurrentPackage(mockPackage)
      await PackageStorage.clear()
      const result = await PackageStorage.getCurrentPackage()
      expect(result).toBeNull()
    })
  })

  describe('setCurrentPackage', () => {
    it('should store package', async () => {
      await PackageStorage.setCurrentPackage(mockPackage)
      const result = await PackageStorage.getCurrentPackage()
      expect(result).toEqual(mockPackage)
    })
  })

  describe('getPendingPackage', () => {
    it('should return null when no package is pending', async () => {
      const result = await PackageStorage.getPendingPackage()
      expect(result).toBeNull()
    })

    it('should return pending package', async () => {
      const localPkg = createMockLocalPackage()
      await PackageStorage.setPendingPackage(localPkg)
      const result = await PackageStorage.getPendingPackage()
      expect(result).toMatchObject({
        ...mockPackage,
        localPath: '/path/to/package',
      })
    })

    it('should return null after clear', async () => {
      const localPkg = createMockLocalPackage()
      await PackageStorage.setPendingPackage(localPkg)
      await PackageStorage.clear()
      const result = await PackageStorage.getPendingPackage()
      expect(result).toBeNull()
    })
  })

  describe('setPendingPackage', () => {
    it('should store pending package', async () => {
      const localPkg = createMockLocalPackage()
      await PackageStorage.setPendingPackage(localPkg)
      const result = await PackageStorage.getPendingPackage()
      expect(result).toMatchObject({
        ...mockPackage,
        localPath: '/path/to/package',
      })
    })
  })

  describe('clearPendingPackage', () => {
    it('should clear pending package', async () => {
      const localPkg = createMockLocalPackage()
      await PackageStorage.setPendingPackage(localPkg)
      await PackageStorage.clearPendingPackage()
      const result = await PackageStorage.getPendingPackage()
      expect(result).toBeNull()
    })
  })

  describe('getFailedUpdates', () => {
    it('should return empty array when no failures', async () => {
      const result = await PackageStorage.getFailedUpdates()
      expect(result).toEqual([])
    })

    it('should return list of failed update hashes', async () => {
      await PackageStorage.markUpdateFailed('hash1')
      await PackageStorage.markUpdateFailed('hash2')

      const result = await PackageStorage.getFailedUpdates()
      expect(result).toEqual(['hash1', 'hash2'])
    })

    it('should return empty array after clearFailedUpdates', async () => {
      await PackageStorage.markUpdateFailed('hash1')
      await PackageStorage.clearFailedUpdates()
      const result = await PackageStorage.getFailedUpdates()
      expect(result).toEqual([])
    })
  })

  describe('markUpdateFailed', () => {
    it('should add hash to failed updates', async () => {
      await PackageStorage.markUpdateFailed('hash1')
      const result = await PackageStorage.getFailedUpdates()
      expect(result).toContain('hash1')
    })

    it('should not add duplicate hashes', async () => {
      await PackageStorage.markUpdateFailed('hash1')
      await PackageStorage.markUpdateFailed('hash1')
      const result = await PackageStorage.getFailedUpdates()
      expect(result).toEqual(['hash1'])
    })
  })

  describe('setFailedUpdates', () => {
    it('should set failed updates list', async () => {
      await PackageStorage.setFailedUpdates(['hash1', 'hash2', 'hash3'])

      const result = await PackageStorage.getFailedUpdates()
      expect(result).toEqual(['hash1', 'hash2', 'hash3'])
    })

    it('should replace existing failed updates', async () => {
      await PackageStorage.markUpdateFailed('hash1')
      await PackageStorage.markUpdateFailed('hash2')

      await PackageStorage.setFailedUpdates(['hash3', 'hash4'])

      const result = await PackageStorage.getFailedUpdates()
      expect(result).toEqual(['hash3', 'hash4'])
    })

    it('should clear storage when empty array provided', async () => {
      await PackageStorage.markUpdateFailed('hash1')
      await PackageStorage.markUpdateFailed('hash2')

      await PackageStorage.setFailedUpdates([])

      const result = await PackageStorage.getFailedUpdates()
      expect(result).toEqual([])
    })

    it('should allow removing specific hashes', async () => {
      await PackageStorage.setFailedUpdates(['hash1', 'hash2', 'hash3'])

      // Remove hash2
      const current = await PackageStorage.getFailedUpdates()
      const updated = current.filter(h => h !== 'hash2')
      await PackageStorage.setFailedUpdates(updated)

      const result = await PackageStorage.getFailedUpdates()
      expect(result).toEqual(['hash1', 'hash3'])
    })
  })

  describe('clearFailedUpdates', () => {
    it('should clear all failed updates', async () => {
      await PackageStorage.markUpdateFailed('hash1')
      await PackageStorage.markUpdateFailed('hash2')
      await PackageStorage.clearFailedUpdates()

      const result = await PackageStorage.getFailedUpdates()
      expect(result).toEqual([])
    })
  })

  describe('failed updates expiration', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-01-01T00:00:00Z'))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should include entries that are not expired', async () => {
      await PackageStorage.markUpdateFailed('hash1')

      // Advance time by 6 days (less than 7 day expiry)
      jest.advanceTimersByTime(6 * 24 * 60 * 60 * 1000)

      const result = await PackageStorage.getFailedUpdates()
      expect(result).toContain('hash1')
    })

    it('should exclude entries that have expired', async () => {
      await PackageStorage.markUpdateFailed('hash1')

      // Advance time by 8 days (more than 7 day expiry)
      jest.advanceTimersByTime(8 * 24 * 60 * 60 * 1000)

      const result = await PackageStorage.getFailedUpdates()
      expect(result).not.toContain('hash1')
    })

    it('should keep non-expired entries when some expire', async () => {
      await PackageStorage.markUpdateFailed('hash1')

      // Advance 4 days and add another
      jest.advanceTimersByTime(4 * 24 * 60 * 60 * 1000)
      await PackageStorage.markUpdateFailed('hash2')

      // Advance 4 more days (hash1 is now 8 days old, hash2 is 4 days old)
      jest.advanceTimersByTime(4 * 24 * 60 * 60 * 1000)

      const result = await PackageStorage.getFailedUpdates()
      expect(result).not.toContain('hash1')
      expect(result).toContain('hash2')
    })

    it('should return entries with full metadata via getFailedUpdateEntries', async () => {
      await PackageStorage.markUpdateFailed('hash1', 'Rollback timeout')

      const entries = await PackageStorage.getFailedUpdateEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0]).toEqual({
        packageHash: 'hash1',
        failedAt: expect.any(Number),
        reason: 'Rollback timeout',
      })
    })

    it('should migrate old string[] format to new format', async () => {
      // Directly set old format via internal storage
      const { PersistentStorage } = await import('../../utils/storage')
      await PersistentStorage.setItem('@bitrise/codepush/failedUpdates', ['oldHash1', 'oldHash2'])

      const result = await PackageStorage.getFailedUpdates()
      expect(result).toEqual(['oldHash1', 'oldHash2'])

      // After migration, entries should have timestamps
      const entries = await PackageStorage.getFailedUpdateEntries()
      expect(entries[0]).toHaveProperty('failedAt')
      expect(entries[0]).toHaveProperty('packageHash', 'oldHash1')
    })

    it('should clean up expired entries on read', async () => {
      await PackageStorage.markUpdateFailed('hash1')

      // Advance past expiry
      jest.advanceTimersByTime(8 * 24 * 60 * 60 * 1000)

      // Reading should trigger cleanup
      await PackageStorage.getFailedUpdates()

      // Add new entry
      await PackageStorage.markUpdateFailed('hash2')

      // Verify only new entry exists
      const entries = await PackageStorage.getFailedUpdateEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0].packageHash).toBe('hash2')
    })
  })

  describe('clear', () => {
    it('should clear all storage', async () => {
      const localPkg = createMockLocalPackage()
      await PackageStorage.setCurrentPackage(mockPackage)
      await PackageStorage.setPendingPackage(localPkg)
      await PackageStorage.markUpdateFailed('hash1')

      await PackageStorage.clear()

      expect(await PackageStorage.getCurrentPackage()).toBeNull()
      expect(await PackageStorage.getPendingPackage()).toBeNull()
      expect(await PackageStorage.getFailedUpdates()).toEqual([])
    })
  })

  describe('setPackageData', () => {
    it('should store package data in-memory when filesystem not available', async () => {
      const testData = btoa('test package data')
      await PackageStorage.setPackageData('hash123', testData)

      const retrieved = await PackageStorage.getPackageData('hash123')
      expect(retrieved).toBe(testData)
    })

    it('should store different package data separately', async () => {
      const data1 = btoa('package 1')
      const data2 = btoa('package 2')

      await PackageStorage.setPackageData('hash1', data1)
      await PackageStorage.setPackageData('hash2', data2)

      expect(await PackageStorage.getPackageData('hash1')).toBe(data1)
      expect(await PackageStorage.getPackageData('hash2')).toBe(data2)
    })

    it('should overwrite existing package data', async () => {
      const oldData = btoa('old data')
      const newData = btoa('new data')

      await PackageStorage.setPackageData('hash123', oldData)
      await PackageStorage.setPackageData('hash123', newData)

      expect(await PackageStorage.getPackageData('hash123')).toBe(newData)
    })
  })

  describe('getPackageData', () => {
    it('should return null when package data does not exist', async () => {
      const result = await PackageStorage.getPackageData('nonexistent')
      expect(result).toBeNull()
    })

    it('should retrieve stored package data', async () => {
      const testData = btoa('test package data')
      await PackageStorage.setPackageData('hash123', testData)

      const retrieved = await PackageStorage.getPackageData('hash123')
      expect(retrieved).toBe(testData)
    })
  })

  describe('deletePackageData', () => {
    it('should delete package data', async () => {
      const testData = btoa('test data')
      await PackageStorage.setPackageData('hash123', testData)

      await PackageStorage.deletePackageData('hash123')

      const retrieved = await PackageStorage.getPackageData('hash123')
      expect(retrieved).toBeNull()
    })

    it('should not error when deleting non-existent package', async () => {
      await expect(PackageStorage.deletePackageData('nonexistent')).resolves.not.toThrow()
    })

    it('should only delete specified package data', async () => {
      const data1 = btoa('package 1')
      const data2 = btoa('package 2')

      await PackageStorage.setPackageData('hash1', data1)
      await PackageStorage.setPackageData('hash2', data2)

      await PackageStorage.deletePackageData('hash1')

      expect(await PackageStorage.getPackageData('hash1')).toBeNull()
      expect(await PackageStorage.getPackageData('hash2')).toBe(data2)
    })
  })

  describe('setInstallMetadata', () => {
    it('should store install metadata', async () => {
      const metadata = {
        installMode: 1,
        timestamp: Date.now(),
      }

      await PackageStorage.setInstallMetadata('hash123', metadata)

      const retrieved = await PackageStorage.getInstallMetadata('hash123')
      expect(retrieved).toEqual(metadata)
    })

    it('should store install metadata with minimumBackgroundDuration', async () => {
      const metadata = {
        installMode: 2,
        timestamp: Date.now(),
        minimumBackgroundDuration: 60,
      }

      await PackageStorage.setInstallMetadata('hash123', metadata)

      const retrieved = await PackageStorage.getInstallMetadata('hash123')
      expect(retrieved).toEqual(metadata)
    })

    it('should overwrite existing install metadata', async () => {
      const oldMetadata = {
        installMode: 1,
        timestamp: Date.now() - 1000,
      }
      const newMetadata = {
        installMode: 2,
        timestamp: Date.now(),
      }

      await PackageStorage.setInstallMetadata('hash123', oldMetadata)
      await PackageStorage.setInstallMetadata('hash123', newMetadata)

      const retrieved = await PackageStorage.getInstallMetadata('hash123')
      expect(retrieved).toEqual(newMetadata)
    })
  })

  describe('getInstallMetadata', () => {
    it('should return null when metadata does not exist', async () => {
      const result = await PackageStorage.getInstallMetadata('nonexistent')
      expect(result).toBeNull()
    })

    it('should retrieve stored install metadata', async () => {
      const metadata = {
        installMode: 1,
        timestamp: Date.now(),
      }

      await PackageStorage.setInstallMetadata('hash123', metadata)

      const retrieved = await PackageStorage.getInstallMetadata('hash123')
      expect(retrieved).toEqual(metadata)
    })
  })

  describe('setRollbackMetadata', () => {
    it('should store rollback metadata', async () => {
      const metadata = {
        installedAt: Date.now(),
        timeoutMinutes: 5,
        maxRetries: 3,
        retryCount: 0,
        previousPackageHash: 'prev-hash',
      }

      await PackageStorage.setRollbackMetadata('hash123', metadata)

      const retrieved = await PackageStorage.getRollbackMetadata('hash123')
      expect(retrieved).toEqual(metadata)
    })

    it('should store rollback metadata for multiple packages', async () => {
      const metadata1 = {
        installedAt: Date.now(),
        timeoutMinutes: 5,
        maxRetries: 3,
        retryCount: 0,
        previousPackageHash: 'prev-1',
      }
      const metadata2 = {
        installedAt: Date.now(),
        timeoutMinutes: 10,
        maxRetries: 5,
        retryCount: 1,
        previousPackageHash: 'prev-2',
      }

      await PackageStorage.setRollbackMetadata('hash1', metadata1)
      await PackageStorage.setRollbackMetadata('hash2', metadata2)

      expect(await PackageStorage.getRollbackMetadata('hash1')).toEqual(metadata1)
      expect(await PackageStorage.getRollbackMetadata('hash2')).toEqual(metadata2)
    })

    it('should update retry count', async () => {
      const metadata = {
        installedAt: Date.now(),
        timeoutMinutes: 5,
        maxRetries: 3,
        retryCount: 0,
        previousPackageHash: 'prev-hash',
      }

      await PackageStorage.setRollbackMetadata('hash123', metadata)

      const updatedMetadata = {
        ...metadata,
        retryCount: 1,
      }

      await PackageStorage.setRollbackMetadata('hash123', updatedMetadata)

      const retrieved = await PackageStorage.getRollbackMetadata('hash123')
      expect(retrieved?.retryCount).toBe(1)
    })
  })

  describe('getRollbackMetadata', () => {
    it('should return null when metadata does not exist', async () => {
      const result = await PackageStorage.getRollbackMetadata('nonexistent')
      expect(result).toBeNull()
    })

    it('should retrieve stored rollback metadata', async () => {
      const metadata = {
        installedAt: Date.now(),
        timeoutMinutes: 5,
        maxRetries: 3,
        retryCount: 0,
        previousPackageHash: 'prev-hash',
      }

      await PackageStorage.setRollbackMetadata('hash123', metadata)

      const retrieved = await PackageStorage.getRollbackMetadata('hash123')
      expect(retrieved).toEqual(metadata)
    })
  })

  describe('clearRollbackMetadata', () => {
    it('should clear rollback metadata for specific package', async () => {
      const metadata = {
        installedAt: Date.now(),
        timeoutMinutes: 5,
        maxRetries: 3,
        retryCount: 0,
        previousPackageHash: 'prev-hash',
      }

      await PackageStorage.setRollbackMetadata('hash123', metadata)
      await PackageStorage.clearRollbackMetadata('hash123')

      const retrieved = await PackageStorage.getRollbackMetadata('hash123')
      expect(retrieved).toBeNull()
    })

    it('should clear all rollback metadata when no hash provided', async () => {
      const metadata1 = {
        installedAt: Date.now(),
        timeoutMinutes: 5,
        maxRetries: 3,
        retryCount: 0,
        previousPackageHash: 'prev-1',
      }
      const metadata2 = {
        installedAt: Date.now(),
        timeoutMinutes: 10,
        maxRetries: 5,
        retryCount: 1,
        previousPackageHash: 'prev-2',
      }

      await PackageStorage.setRollbackMetadata('hash1', metadata1)
      await PackageStorage.setRollbackMetadata('hash2', metadata2)

      await PackageStorage.clearRollbackMetadata()

      expect(await PackageStorage.getRollbackMetadata('hash1')).toBeNull()
      expect(await PackageStorage.getRollbackMetadata('hash2')).toBeNull()
    })

    it('should only clear rollback metadata, not other data', async () => {
      const metadata = {
        installedAt: Date.now(),
        timeoutMinutes: 5,
        maxRetries: 3,
        retryCount: 0,
        previousPackageHash: 'prev-hash',
      }

      await PackageStorage.setCurrentPackage(mockPackage)
      await PackageStorage.setRollbackMetadata('hash123', metadata)

      await PackageStorage.clearRollbackMetadata()

      expect(await PackageStorage.getRollbackMetadata('hash123')).toBeNull()
      expect(await PackageStorage.getCurrentPackage()).toEqual(mockPackage)
    })
  })

  describe('addToPackageHistory', () => {
    it('should add package to history', async () => {
      await PackageStorage.addToPackageHistory(mockPackage)

      const history = await PackageStorage.getPackageHistory()
      expect(history).toHaveLength(1)
      expect(history[0]).toEqual(mockPackage)
    })

    it('should add multiple packages to history', async () => {
      const pkg1 = { ...mockPackage, packageHash: 'hash1' }
      const pkg2 = { ...mockPackage, packageHash: 'hash2' }
      const pkg3 = { ...mockPackage, packageHash: 'hash3' }

      await PackageStorage.addToPackageHistory(pkg1)
      await PackageStorage.addToPackageHistory(pkg2)
      await PackageStorage.addToPackageHistory(pkg3)

      const history = await PackageStorage.getPackageHistory()
      expect(history).toHaveLength(3)
      expect(history[0]).toEqual(pkg3)
      expect(history[1]).toEqual(pkg2)
      expect(history[2]).toEqual(pkg1)
    })

    it('should keep only last 3 packages', async () => {
      const pkg1 = { ...mockPackage, packageHash: 'hash1' }
      const pkg2 = { ...mockPackage, packageHash: 'hash2' }
      const pkg3 = { ...mockPackage, packageHash: 'hash3' }
      const pkg4 = { ...mockPackage, packageHash: 'hash4' }

      await PackageStorage.addToPackageHistory(pkg1)
      await PackageStorage.addToPackageHistory(pkg2)
      await PackageStorage.addToPackageHistory(pkg3)
      await PackageStorage.addToPackageHistory(pkg4)

      const history = await PackageStorage.getPackageHistory()
      expect(history).toHaveLength(3)
      expect(history[0]).toEqual(pkg4)
      expect(history[1]).toEqual(pkg3)
      expect(history[2]).toEqual(pkg2)
      expect(history.find(p => p.packageHash === 'hash1')).toBeUndefined()
    })

    it('should not duplicate packages in history', async () => {
      const pkg = { ...mockPackage, packageHash: 'hash1' }
      const pkg2 = { ...mockPackage, packageHash: 'hash2' }

      await PackageStorage.addToPackageHistory(pkg)
      await PackageStorage.addToPackageHistory(pkg2)
      await PackageStorage.addToPackageHistory(pkg)

      const history = await PackageStorage.getPackageHistory()
      expect(history).toHaveLength(2)
      expect(history[0]).toEqual(pkg)
      expect(history[1]).toEqual(pkg2)
    })

    it('should move existing package to front', async () => {
      const pkg1 = { ...mockPackage, packageHash: 'hash1' }
      const pkg2 = { ...mockPackage, packageHash: 'hash2' }
      const pkg3 = { ...mockPackage, packageHash: 'hash3' }

      await PackageStorage.addToPackageHistory(pkg1)
      await PackageStorage.addToPackageHistory(pkg2)
      await PackageStorage.addToPackageHistory(pkg3)

      await PackageStorage.addToPackageHistory(pkg1)

      const history = await PackageStorage.getPackageHistory()
      expect(history).toHaveLength(3)
      expect(history[0]).toEqual(pkg1)
      expect(history[1]).toEqual(pkg3)
      expect(history[2]).toEqual(pkg2)
    })
  })

  describe('getPackageHistory', () => {
    it('should return empty array when no history', async () => {
      const history = await PackageStorage.getPackageHistory()
      expect(history).toEqual([])
    })

    it('should return all packages in history', async () => {
      const pkg1 = { ...mockPackage, packageHash: 'hash1' }
      const pkg2 = { ...mockPackage, packageHash: 'hash2' }

      await PackageStorage.addToPackageHistory(pkg1)
      await PackageStorage.addToPackageHistory(pkg2)

      const history = await PackageStorage.getPackageHistory()
      expect(history).toHaveLength(2)
      expect(history[0]).toEqual(pkg2)
      expect(history[1]).toEqual(pkg1)
    })
  })

  describe('getPackageByHash', () => {
    it('should return null when package not in history', async () => {
      const result = await PackageStorage.getPackageByHash('nonexistent')
      expect(result).toBeNull()
    })

    it('should retrieve package from history by hash', async () => {
      const pkg1 = { ...mockPackage, packageHash: 'hash1' }
      const pkg2 = { ...mockPackage, packageHash: 'hash2' }

      await PackageStorage.addToPackageHistory(pkg1)
      await PackageStorage.addToPackageHistory(pkg2)

      const retrieved = await PackageStorage.getPackageByHash('hash1')
      expect(retrieved).toEqual(pkg1)
    })

    it('should return correct package when multiple in history', async () => {
      const pkg1 = { ...mockPackage, packageHash: 'hash1', label: 'v1' }
      const pkg2 = { ...mockPackage, packageHash: 'hash2', label: 'v2' }
      const pkg3 = { ...mockPackage, packageHash: 'hash3', label: 'v3' }

      await PackageStorage.addToPackageHistory(pkg1)
      await PackageStorage.addToPackageHistory(pkg2)
      await PackageStorage.addToPackageHistory(pkg3)

      expect(await PackageStorage.getPackageByHash('hash1')).toEqual(pkg1)
      expect(await PackageStorage.getPackageByHash('hash2')).toEqual(pkg2)
      expect(await PackageStorage.getPackageByHash('hash3')).toEqual(pkg3)
    })
  })

  describe('FileSystem integration', () => {
    describe('setPackageData with FileSystem', () => {
      it('should use filesystem when available', async () => {
        ;(FileSystem.isAvailable as jest.Mock).mockReturnValue(true)
        ;(FileSystemStorage.setPackageData as jest.Mock).mockResolvedValue(undefined)

        const testData = btoa('test data')
        await PackageStorage.setPackageData('hash123', testData)

        expect(FileSystemStorage.setPackageData).toHaveBeenCalled()
        expect(FileSystemStorage.setPackageData).toHaveBeenCalledWith(
          'hash123',
          expect.any(Uint8Array)
        )
      })

      it('should fallback to in-memory when filesystem write fails', async () => {
        ;(FileSystem.isAvailable as jest.Mock).mockReturnValue(true)
        ;(FileSystemStorage.setPackageData as jest.Mock).mockRejectedValue(
          new Error('Write failed')
        )

        const testData = btoa('test data')
        await PackageStorage.setPackageData('hash123', testData)

        // Should have tried filesystem
        expect(FileSystemStorage.setPackageData).toHaveBeenCalled()

        // Should fallback to in-memory
        const retrieved = await PackageStorage.getPackageData('hash123')
        expect(retrieved).toBe(testData)
      })

      it('should use in-memory when filesystem not available', async () => {
        ;(FileSystem.isAvailable as jest.Mock).mockReturnValue(false)

        const testData = btoa('test data')
        await PackageStorage.setPackageData('hash123', testData)

        expect(FileSystemStorage.setPackageData).not.toHaveBeenCalled()

        const retrieved = await PackageStorage.getPackageData('hash123')
        expect(retrieved).toBe(testData)
      })
    })

    describe('getPackageData with FileSystem', () => {
      it('should use filesystem when available', async () => {
        const testData = new Uint8Array([1, 2, 3, 4, 5])
        ;(FileSystem.isAvailable as jest.Mock).mockReturnValue(true)
        ;(FileSystemStorage.getPackageData as jest.Mock).mockResolvedValue(testData)

        const result = await PackageStorage.getPackageData('hash123')

        expect(FileSystemStorage.getPackageData).toHaveBeenCalledWith('hash123')
        expect(result).toBeDefined()
      })

      it('should fallback to in-memory when filesystem read fails', async () => {
        ;(FileSystem.isAvailable as jest.Mock).mockReturnValue(true)
        ;(FileSystemStorage.getPackageData as jest.Mock).mockRejectedValue(new Error('Read failed'))

        // Store in in-memory first
        const testData = btoa('test data')
        ;(FileSystem.isAvailable as jest.Mock).mockReturnValue(false)
        await PackageStorage.setPackageData('hash123', testData)

        // Now try to read with filesystem enabled but failing
        ;(FileSystem.isAvailable as jest.Mock).mockReturnValue(true)
        const retrieved = await PackageStorage.getPackageData('hash123')

        expect(FileSystemStorage.getPackageData).toHaveBeenCalled()
        expect(retrieved).toBe(testData)
      })

      it('should return null when filesystem returns null', async () => {
        ;(FileSystem.isAvailable as jest.Mock).mockReturnValue(true)
        ;(FileSystemStorage.getPackageData as jest.Mock).mockResolvedValue(null)

        const result = await PackageStorage.getPackageData('hash123')

        expect(result).toBeNull()
      })
    })

    describe('deletePackageData with FileSystem', () => {
      it('should use filesystem when available', async () => {
        ;(FileSystem.isAvailable as jest.Mock).mockReturnValue(true)
        ;(FileSystemStorage.deletePackageData as jest.Mock).mockResolvedValue(undefined)

        await PackageStorage.deletePackageData('hash123')

        expect(FileSystemStorage.deletePackageData).toHaveBeenCalledWith('hash123')
      })

      it('should continue even if filesystem delete fails', async () => {
        ;(FileSystem.isAvailable as jest.Mock).mockReturnValue(true)
        ;(FileSystemStorage.deletePackageData as jest.Mock).mockRejectedValue(
          new Error('Delete failed')
        )

        await expect(PackageStorage.deletePackageData('hash123')).resolves.not.toThrow()

        expect(FileSystemStorage.deletePackageData).toHaveBeenCalled()
      })

      it('should delete from both filesystem and in-memory', async () => {
        // Store in in-memory
        const testData = btoa('test data')
        await PackageStorage.setPackageData('hash123', testData)

        // Enable filesystem and delete
        ;(FileSystem.isAvailable as jest.Mock).mockReturnValue(true)
        ;(FileSystemStorage.deletePackageData as jest.Mock).mockResolvedValue(undefined)

        await PackageStorage.deletePackageData('hash123')

        expect(FileSystemStorage.deletePackageData).toHaveBeenCalled()

        // Verify deleted from in-memory
        ;(FileSystem.isAvailable as jest.Mock).mockReturnValue(false)
        const retrieved = await PackageStorage.getPackageData('hash123')
        expect(retrieved).toBeNull()
      })
    })

    describe('base64 conversion', () => {
      it('should correctly convert between base64 and Uint8Array', async () => {
        const originalData = 'Hello, World!'
        const base64Data = btoa(originalData)

        await PackageStorage.setPackageData('hash123', base64Data)
        const retrieved = await PackageStorage.getPackageData('hash123')

        expect(retrieved).toBe(base64Data)

        // Verify round-trip conversion
        const decoded = atob(retrieved!)
        expect(decoded).toBe(originalData)
      })

      it('should handle empty data', async () => {
        const emptyData = btoa('') // Returns empty string

        await PackageStorage.setPackageData('hash123', emptyData)
        const retrieved = await PackageStorage.getPackageData('hash123')

        // Empty string is preserved as empty string
        expect(retrieved).toBe('')
      })

      it('should handle binary data', async () => {
        // Create some binary data
        const binaryString = String.fromCharCode(0, 1, 2, 255, 254, 253)
        const base64Data = btoa(binaryString)

        await PackageStorage.setPackageData('hash123', base64Data)
        const retrieved = await PackageStorage.getPackageData('hash123')

        expect(retrieved).toBe(base64Data)
      })
    })
  })
})
