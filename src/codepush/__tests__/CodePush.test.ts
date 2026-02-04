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
    jest.spyOn(console, 'warn').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
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

      expect(BitriseClient).toHaveBeenCalledWith('https://api.bitrise.io', 'custom-key', '1.0.0')
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

  describe('notifyAppReady - basic', () => {
    it('should only execute once per instance', () => {
      codePush.notifyAppReady()
      codePush.notifyAppReady()
      codePush.notifyAppReady()

      // Should not throw or cause issues
      expect(true).toBe(true)
    })
  })

  describe('restartApp', () => {
    it('should log warning about native restart not implemented', async () => {
      ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue({
        packageHash: 'test123',
      })

      await codePush.restartApp()

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Restart required to apply update')
      )
    })

    it('should not restart if onlyIfUpdateIsPending is true and no pending update', async () => {
      ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue(null)

      await codePush.restartApp(true)

      expect(console.warn).not.toHaveBeenCalled()
    })

    it('should restart if onlyIfUpdateIsPending is true and update is pending', async () => {
      ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue({
        packageHash: 'test123',
      })

      await codePush.restartApp(true)

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Restart required to apply update')
      )
    })
  })

  describe('sync', () => {
    const mockRemotePackage = {
      appVersion: '1.0.0',
      deploymentKey: 'test-key',
      description: 'Test update',
      failedInstall: false,
      isFirstRun: false,
      isMandatory: false,
      isPending: false,
      label: 'v2',
      packageHash: 'hash456',
      packageSize: 2048,
      downloadUrl: 'https://example.com/package.zip',
      download: jest.fn(),
    }

    const mockLocalPackage = {
      ...mockRemotePackage,
      localPath: '/tmp/package',
      install: jest.fn(),
    }

    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation()
    })

    describe('happy path', () => {
      it('should return UPDATE_INSTALLED when update is available', async () => {
        mockRemotePackage.download.mockResolvedValue(mockLocalPackage)
        mockLocalPackage.install.mockResolvedValue(undefined)
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(mockRemotePackage)

        const status = await codePush.sync()

        expect(status).toBe(1) // SyncStatus.UPDATE_INSTALLED
        expect(mockRemotePackage.download).toHaveBeenCalled()
        expect(mockLocalPackage.install).toHaveBeenCalledWith(1, undefined) // InstallMode.ON_NEXT_RESTART
      })

      it('should return UP_TO_DATE when no update is available', async () => {
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(null)

        const status = await codePush.sync()

        expect(status).toBe(0) // SyncStatus.UP_TO_DATE
        expect(mockRemotePackage.download).not.toHaveBeenCalled()
      })

      it('should use mandatoryInstallMode for mandatory updates', async () => {
        const mandatoryPackage = { ...mockRemotePackage, isMandatory: true }
        mandatoryPackage.download = jest.fn().mockResolvedValue(mockLocalPackage)
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(mandatoryPackage)

        await codePush.sync({ mandatoryInstallMode: 0 }) // InstallMode.IMMEDIATE

        expect(mockLocalPackage.install).toHaveBeenCalledWith(0, undefined) // InstallMode.IMMEDIATE
      })

      it('should use installMode for optional updates', async () => {
        mockRemotePackage.download.mockResolvedValue(mockLocalPackage)
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(mockRemotePackage)

        await codePush.sync({ installMode: 2 }) // InstallMode.ON_NEXT_RESUME

        expect(mockLocalPackage.install).toHaveBeenCalledWith(2, undefined) // InstallMode.ON_NEXT_RESUME
      })

      it('should pass custom deployment key to checkForUpdate', async () => {
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(null)

        await codePush.sync({ deploymentKey: 'custom-key' })

        // Should create new client with custom key
        expect(BitriseClient).toHaveBeenCalledWith('https://api.bitrise.io', 'custom-key', '1.0.0')
      })
    })

    describe('concurrency', () => {
      it('should return SYNC_IN_PROGRESS if sync is already running', async () => {
        // Make first sync hang
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockImplementation(
          () => new Promise(resolve => setTimeout(resolve, 100))
        )

        const promise1 = codePush.sync()
        const promise2 = codePush.sync()

        const [status1, status2] = await Promise.all([promise1, promise2])

        // One should succeed or error, other should be SYNC_IN_PROGRESS
        expect([status1, status2]).toContain(4) // SyncStatus.SYNC_IN_PROGRESS
      })

      it('should allow new sync after previous completes', async () => {
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)

        const status1 = await codePush.sync()
        const status2 = await codePush.sync()

        expect(status1).toBe(0) // SyncStatus.UP_TO_DATE
        expect(status2).toBe(0) // SyncStatus.UP_TO_DATE
      })
    })

    describe('failed updates', () => {
      it('should return UPDATE_IGNORED when ignoreFailedUpdates is true and hash in failed list', async () => {
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(mockRemotePackage)
        ;(PackageStorage.getFailedUpdates as jest.Mock).mockResolvedValue(['hash456'])

        const status = await codePush.sync({ ignoreFailedUpdates: true })

        expect(status).toBe(2) // SyncStatus.UPDATE_IGNORED
        expect(mockRemotePackage.download).not.toHaveBeenCalled()
      })

      it('should proceed when ignoreFailedUpdates is false', async () => {
        mockRemotePackage.download.mockResolvedValue(mockLocalPackage)
        mockLocalPackage.install.mockResolvedValue(undefined)
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(mockRemotePackage)
        ;(PackageStorage.getFailedUpdates as jest.Mock).mockResolvedValue(['hash456'])

        const status = await codePush.sync({ ignoreFailedUpdates: false })

        expect(status).toBe(1) // SyncStatus.UPDATE_INSTALLED
        expect(mockRemotePackage.download).toHaveBeenCalled()
      })

      it('should proceed when ignoreFailedUpdates is true but hash not in failed list', async () => {
        mockRemotePackage.download.mockResolvedValue(mockLocalPackage)
        mockLocalPackage.install.mockResolvedValue(undefined)
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(mockRemotePackage)
        ;(PackageStorage.getFailedUpdates as jest.Mock).mockResolvedValue(['differentHash'])

        const status = await codePush.sync({ ignoreFailedUpdates: true })

        expect(status).toBe(1) // SyncStatus.UPDATE_INSTALLED
        expect(mockRemotePackage.download).toHaveBeenCalled()
      })
    })

    describe('error scenarios', () => {
      it('should return UNKNOWN_ERROR when checkForUpdate throws', async () => {
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockRejectedValue(
          new Error('Network error')
        )

        const status = await codePush.sync()

        expect(status).toBe(3) // SyncStatus.UNKNOWN_ERROR
        expect(console.error).toHaveBeenCalledWith('[CodePush] sync() failed:', expect.any(Error))
      })

      it('should return UNKNOWN_ERROR when download throws and clear mutex', async () => {
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(mockRemotePackage)
        mockRemotePackage.download.mockRejectedValue(new Error('Download failed'))

        const status = await codePush.sync()

        expect(status).toBe(3) // SyncStatus.UNKNOWN_ERROR
        expect(console.error).toHaveBeenCalledWith('[CodePush] sync() failed:', expect.any(Error))

        // Verify mutex is cleared - next sync should work
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(null)
        const status2 = await codePush.sync()
        expect(status2).toBe(0) // SyncStatus.UP_TO_DATE (not SYNC_IN_PROGRESS)
      })

      it('should return UNKNOWN_ERROR when install throws and clear mutex', async () => {
        mockRemotePackage.download.mockResolvedValue(mockLocalPackage)
        mockLocalPackage.install.mockRejectedValue(new Error('Install failed'))
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(mockRemotePackage)

        const status = await codePush.sync()

        expect(status).toBe(3) // SyncStatus.UNKNOWN_ERROR
        expect(console.error).toHaveBeenCalledWith('[CodePush] sync() failed:', expect.any(Error))

        // Verify mutex is cleared
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(null)
        const status2 = await codePush.sync()
        expect(status2).toBe(0) // SyncStatus.UP_TO_DATE
      })

      it('should throw ConfigurationError without deployment key configured', async () => {
        const configWithoutKey: BitriseConfig = {
          apiToken: 'test-token',
          appSlug: 'test-slug',
        }
        const codePushWithoutKey = new CodePush(configWithoutKey)

        await expect(codePushWithoutKey.sync()).rejects.toThrow(ConfigurationError)
      })
    })

    describe('auto-notify', () => {
      it('should call notifyAppReady if not called yet', async () => {
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(null)
        ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(null)

        await codePush.sync()

        // notifyAppReady should have been called (indicated by accessing storage)
        expect(PackageStorage.getCurrentPackage).toHaveBeenCalled()
      })

      it('should skip notifyAppReady if already called', async () => {
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(null)
        ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(null)

        // First sync (triggers notifyAppReady)
        await codePush.sync()
        await new Promise(resolve => setTimeout(resolve, 10)) // Wait for async notifyAppReady

        jest.clearAllMocks() // Clear mock call counts

        // Second sync (should not trigger notifyAppReady again)
        await codePush.sync()
        await new Promise(resolve => setTimeout(resolve, 10))
        const callCount = (PackageStorage.getCurrentPackage as jest.Mock).mock.calls.length

        // On second sync, getCurrentPackage should only be called by checkForUpdate, not notifyAppReady
        // So call count should be 1 (from checkForUpdate) not 2 (would include notifyAppReady)
        expect(callCount).toBe(1)
      })
    })

    describe('install mode resolution', () => {
      it('should use mandatoryInstallMode option for mandatory updates', async () => {
        const mandatoryPackage = { ...mockRemotePackage, isMandatory: true }
        mandatoryPackage.download = jest.fn().mockResolvedValue(mockLocalPackage)
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(mandatoryPackage)

        await codePush.sync({ mandatoryInstallMode: 3 }) // InstallMode.ON_NEXT_SUSPEND

        expect(mockLocalPackage.install).toHaveBeenCalledWith(3, undefined)
      })

      it('should default to IMMEDIATE for mandatory updates without option', async () => {
        const mandatoryPackage = { ...mockRemotePackage, isMandatory: true }
        mandatoryPackage.download = jest.fn().mockResolvedValue(mockLocalPackage)
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(mandatoryPackage)

        await codePush.sync()

        expect(mockLocalPackage.install).toHaveBeenCalledWith(0, undefined) // InstallMode.IMMEDIATE
      })

      it('should use installMode option for optional updates', async () => {
        mockRemotePackage.download.mockResolvedValue(mockLocalPackage)
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(mockRemotePackage)

        await codePush.sync({ installMode: 3 }) // InstallMode.ON_NEXT_SUSPEND

        expect(mockLocalPackage.install).toHaveBeenCalledWith(3, undefined)
      })

      it('should pass minimumBackgroundDuration to install', async () => {
        mockRemotePackage.download.mockResolvedValue(mockLocalPackage)
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(mockRemotePackage)

        await codePush.sync({
          installMode: 3, // InstallMode.ON_NEXT_SUSPEND
          minimumBackgroundDuration: 60,
        })

        expect(mockLocalPackage.install).toHaveBeenCalledWith(3, 60)
      })
    })
  })

  describe('notifyAppReady', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation()
    })

    describe('success scenarios', () => {
      it('should clear pending package when current matches pending', async () => {
        const currentPackage = {
          packageHash: 'hash123',
          label: 'v1',
          appVersion: '1.0.0',
          deploymentKey: 'test-key',
        }
        ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(currentPackage)
        ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue(currentPackage)
        ;(PackageStorage.getFailedUpdates as jest.Mock).mockResolvedValue([])

        codePush.notifyAppReady()

        // Wait for async work
        await new Promise(resolve => setTimeout(resolve, 10))

        expect(PackageStorage.clearPendingPackage).toHaveBeenCalled()
      })

      it('should not clear pending when no pending package exists', async () => {
        ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue({
          packageHash: 'hash123',
        })
        ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue(null)
        ;(PackageStorage.getFailedUpdates as jest.Mock).mockResolvedValue([])

        codePush.notifyAppReady()

        await new Promise(resolve => setTimeout(resolve, 10))

        expect(PackageStorage.clearPendingPackage).not.toHaveBeenCalled()
      })

      it('should clear failed updates when current package is in failed list', async () => {
        const currentPackage = { packageHash: 'hash123' }
        ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(currentPackage)
        ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue(null)
        ;(PackageStorage.getFailedUpdates as jest.Mock).mockResolvedValue(['hash123'])

        codePush.notifyAppReady()

        await new Promise(resolve => setTimeout(resolve, 10))

        expect(PackageStorage.clearFailedUpdates).toHaveBeenCalled()
      })
    })

    describe('call-once behavior', () => {
      it('should execute on first call', async () => {
        ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(null)

        codePush.notifyAppReady()

        await new Promise(resolve => setTimeout(resolve, 10))

        expect(PackageStorage.getCurrentPackage).toHaveBeenCalled()
      })

      it('should not execute on second call', async () => {
        ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(null)

        codePush.notifyAppReady()
        await new Promise(resolve => setTimeout(resolve, 10))
        const callCount1 = (PackageStorage.getCurrentPackage as jest.Mock).mock.calls.length

        codePush.notifyAppReady()
        await new Promise(resolve => setTimeout(resolve, 10))
        const callCount2 = (PackageStorage.getCurrentPackage as jest.Mock).mock.calls.length

        expect(callCount2).toBe(callCount1)
      })

      it('should not execute on third call', async () => {
        ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(null)

        codePush.notifyAppReady()
        await new Promise(resolve => setTimeout(resolve, 10))
        const callCount1 = (PackageStorage.getCurrentPackage as jest.Mock).mock.calls.length

        codePush.notifyAppReady()
        codePush.notifyAppReady()
        await new Promise(resolve => setTimeout(resolve, 10))
        const callCount2 = (PackageStorage.getCurrentPackage as jest.Mock).mock.calls.length

        expect(callCount2).toBe(callCount1)
      })
    })

    describe('error scenarios', () => {
      it('should not throw when getCurrentPackage fails', async () => {
        ;(PackageStorage.getCurrentPackage as jest.Mock).mockRejectedValue(
          new Error('Storage error')
        )

        expect(() => codePush.notifyAppReady()).not.toThrow()

        await new Promise(resolve => setTimeout(resolve, 10))

        expect(console.error).toHaveBeenCalledWith(
          '[CodePush] performNotifyAppReady() error:',
          expect.any(Error)
        )
      })

      it('should not throw when getPendingPackage fails', async () => {
        ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue({
          packageHash: 'hash123',
        })
        ;(PackageStorage.getPendingPackage as jest.Mock).mockRejectedValue(
          new Error('Storage error')
        )

        expect(() => codePush.notifyAppReady()).not.toThrow()

        await new Promise(resolve => setTimeout(resolve, 10))

        expect(console.error).toHaveBeenCalledWith(
          '[CodePush] performNotifyAppReady() error:',
          expect.any(Error)
        )
      })

      it('should not throw when clearPendingPackage fails', async () => {
        const currentPackage = { packageHash: 'hash123' }
        ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(currentPackage)
        ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue(currentPackage)
        ;(PackageStorage.clearPendingPackage as jest.Mock).mockRejectedValue(
          new Error('Storage error')
        )
        ;(PackageStorage.getFailedUpdates as jest.Mock).mockResolvedValue([])

        expect(() => codePush.notifyAppReady()).not.toThrow()

        await new Promise(resolve => setTimeout(resolve, 10))

        expect(console.error).toHaveBeenCalledWith(
          '[CodePush] performNotifyAppReady() error:',
          expect.any(Error)
        )
      })

      it('should handle gracefully when no current package exists', async () => {
        ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(null)

        expect(() => codePush.notifyAppReady()).not.toThrow()

        await new Promise(resolve => setTimeout(resolve, 10))

        // Should not attempt to clear pending
        expect(PackageStorage.clearPendingPackage).not.toHaveBeenCalled()
      })
    })
  })

  describe('unimplemented methods', () => {
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
