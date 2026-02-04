import { PackageStorage } from '../PackageStorage'
import type { Package, LocalPackage } from '../../types/package'

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

  beforeEach(() => {
    // Clear storage before each test
    PackageStorage.clear()
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

    it('should handle invalid JSON gracefully', async () => {
      // Manually corrupt the storage
      ;(PackageStorage as any).cache.set('@bitrise/codepush/currentPackage', 'invalid-json')
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

    it('should handle invalid JSON gracefully', async () => {
      ;(PackageStorage as any).cache.set('@bitrise/codepush/pendingPackage', 'invalid-json')
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

    it('should handle invalid JSON gracefully', async () => {
      ;(PackageStorage as any).cache.set('@bitrise/codepush/failedUpdates', 'invalid-json')
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
})
