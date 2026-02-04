import { CodePush } from '../CodePush'
import { BitriseClient } from '../../network/BitriseClient'
import { PackageStorage } from '../../storage/PackageStorage'
import { ConfigurationError } from '../../types/errors'
import { UpdateState } from '../../types/enums'
import type { BitriseConfig } from '../../types/config'
import type { RemotePackage, Package } from '../../types/package'

// Mock dependencies
jest.mock('../../network/BitriseClient')
jest.mock('../../storage/PackageStorage')
jest.mock('../../utils/platform', () => ({
  getAppVersion: () => '1.0.0',
}))

describe('CodePush', () => {
  const mockConfig: BitriseConfig = {
    apiToken: 'test-token',
    appSlug: 'test-slug',
    deploymentKey: 'test-deployment-key',
    serverUrl: 'https://api.bitrise.io',
  }

  let codePush: CodePush

  beforeEach(() => {
    codePush = new CodePush(mockConfig)
    jest.clearAllMocks()
  })

  describe('getConfiguration', () => {
    it('should return configuration object', () => {
      const config = codePush.getConfiguration()

      expect(config).toEqual({
        appVersion: '1.0.0',
        deploymentKey: 'test-deployment-key',
        serverUrl: 'https://api.bitrise.io',
      })
    })

    it('should cache configuration', () => {
      const config1 = codePush.getConfiguration()
      const config2 = codePush.getConfiguration()

      expect(config1).toBe(config2)
    })

    it('should throw if deploymentKey not configured', () => {
      const configWithoutKey: BitriseConfig = {
        apiToken: 'test-token',
        appSlug: 'test-slug',
      }
      const codePushWithoutKey = new CodePush(configWithoutKey)

      expect(() => codePushWithoutKey.getConfiguration()).toThrow(ConfigurationError)
      expect(() => codePushWithoutKey.getConfiguration()).toThrow('deploymentKey is required')
    })

    it('should use default serverUrl if not provided', () => {
      const configWithoutUrl: BitriseConfig = {
        apiToken: 'test-token',
        appSlug: 'test-slug',
        deploymentKey: 'test-key',
      }
      const codePushWithoutUrl = new CodePush(configWithoutUrl)

      const config = codePushWithoutUrl.getConfiguration()
      expect(config.serverUrl).toBe('https://api.bitrise.io')
    })
  })

  describe('checkForUpdate', () => {
    it('should check for update with current package hash', async () => {
      const mockPackage: Package = {
        appVersion: '1.0.0',
        deploymentKey: 'test-key',
        description: 'Test',
        failedInstall: false,
        isFirstRun: false,
        isMandatory: false,
        isPending: false,
        label: 'v1',
        packageHash: 'hash123',
        packageSize: 1024,
      }

      const mockRemotePackage: RemotePackage = {
        ...mockPackage,
        label: 'v2',
        packageHash: 'hash456',
        downloadUrl: 'https://example.com/package.zip',
        download: jest.fn(),
      }

      ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(mockPackage)
      ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(mockRemotePackage)

      const result = await codePush.checkForUpdate()

      expect(result).toEqual(mockRemotePackage)
      expect(BitriseClient.prototype.checkForUpdate).toHaveBeenCalledWith('hash123')
    })

    it('should return null when no update available', async () => {
      ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(null)
      ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(null)

      const result = await codePush.checkForUpdate()

      expect(result).toBeNull()
    })

    it('should allow custom deployment key', async () => {
      ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(null)
      ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(null)

      await codePush.checkForUpdate('custom-key')

      expect(BitriseClient).toHaveBeenCalledWith(
        'https://api.bitrise.io',
        'custom-key',
        '1.0.0'
      )
    })

    it('should throw if deploymentKey not configured', async () => {
      const configWithoutKey: BitriseConfig = {
        apiToken: 'test-token',
        appSlug: 'test-slug',
      }
      const codePushWithoutKey = new CodePush(configWithoutKey)

      await expect(codePushWithoutKey.checkForUpdate()).rejects.toThrow(ConfigurationError)
    })
  })

  describe('getUpdateMetadata', () => {
    const mockPackage: Package = {
      appVersion: '1.0.0',
      deploymentKey: 'test-key',
      description: 'Test',
      failedInstall: false,
      isFirstRun: false,
      isMandatory: false,
      isPending: false,
      label: 'v1',
      packageHash: 'hash123',
      packageSize: 1024,
    }

    it('should return current package for RUNNING state', async () => {
      ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(mockPackage)

      const result = await codePush.getUpdateMetadata(UpdateState.RUNNING)

      expect(result).toEqual(mockPackage)
      expect(PackageStorage.getCurrentPackage).toHaveBeenCalled()
    })

    it('should return pending package for PENDING state', async () => {
      ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue(mockPackage)

      const result = await codePush.getUpdateMetadata(UpdateState.PENDING)

      expect(result).toEqual(mockPackage)
      expect(PackageStorage.getPendingPackage).toHaveBeenCalled()
    })

    it('should return pending package for LATEST state if available', async () => {
      ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue(mockPackage)

      const result = await codePush.getUpdateMetadata(UpdateState.LATEST)

      expect(result).toEqual(mockPackage)
      expect(PackageStorage.getPendingPackage).toHaveBeenCalled()
    })

    it('should return current package for LATEST state if no pending', async () => {
      ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue(null)
      ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(mockPackage)

      const result = await codePush.getUpdateMetadata(UpdateState.LATEST)

      expect(result).toEqual(mockPackage)
      expect(PackageStorage.getCurrentPackage).toHaveBeenCalled()
    })

    it('should default to RUNNING state if not specified', async () => {
      ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(mockPackage)

      const result = await codePush.getUpdateMetadata()

      expect(result).toEqual(mockPackage)
    })
  })

  describe('getCurrentPackage', () => {
    it('should be an alias for getUpdateMetadata(LATEST)', async () => {
      const mockPackage: Package = {
        appVersion: '1.0.0',
        deploymentKey: 'test-key',
        description: 'Test',
        failedInstall: false,
        isFirstRun: false,
        isMandatory: false,
        isPending: false,
        label: 'v1',
        packageHash: 'hash123',
        packageSize: 1024,
      }

      ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue(null)
      ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(mockPackage)

      const result = await codePush.getCurrentPackage()

      expect(result).toEqual(mockPackage)
    })
  })

  describe('notifyAppReady', () => {
    it('should only execute once per instance', () => {
      codePush.notifyAppReady()
      codePush.notifyAppReady()
      codePush.notifyAppReady()

      // Should not throw or cause issues
      expect(true).toBe(true)
    })
  })

  describe('unimplemented methods', () => {
    it('restartApp should throw', () => {
      expect(() => codePush.restartApp()).toThrow('not yet implemented')
    })

    it('allowRestart should throw', () => {
      expect(() => codePush.allowRestart()).toThrow('not yet implemented')
    })

    it('disallowRestart should throw', () => {
      expect(() => codePush.disallowRestart()).toThrow('not yet implemented')
    })

    it('clearUpdates should throw', async () => {
      await expect(codePush.clearUpdates()).rejects.toThrow('not yet implemented')
    })
  })
})
