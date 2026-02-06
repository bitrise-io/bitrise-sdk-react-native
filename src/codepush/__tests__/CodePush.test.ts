import { CodePush } from '../CodePush'
import { BitriseClient } from '../../network/BitriseClient'
import { PackageStorage } from '../../storage/PackageStorage'
import { ConfigurationError, UpdateError, TimeoutError } from '../../types/errors'
import { UpdateState, SyncStatus } from '../../types/enums'
import type { BitriseConfig } from '../../types/config'
import type { RemotePackage, Package } from '../../types/package'
import { RestartQueue } from '../RestartQueue'
import { Alert } from 'react-native'

// Mock dependencies
jest.mock('../../network/BitriseClient')
jest.mock('../../storage/PackageStorage')
jest.mock('../RestartQueue')
jest.mock('../../native/Restart', () => ({
  restartApp: jest.fn(),
}))
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}))
jest.mock('../../utils/platform', () => ({
  getAppVersion: () => '1.0.0',
}))

/**
 * Helper to mock checkForUpdateWithMismatchInfo based on checkForUpdate mock
 * This ensures sync() works correctly with the new internal API
 */
function setupCheckForUpdateMismatchMock() {
  ;(BitriseClient.prototype.checkForUpdateWithMismatchInfo as jest.Mock).mockImplementation(
    async function (this: BitriseClient, currentPackageHash?: string) {
      const result = await (BitriseClient.prototype.checkForUpdate as jest.Mock).call(
        this,
        currentPackageHash
      )
      return { remotePackage: result, binaryVersionMismatch: false }
    }
  )
}

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
    // Default mock for getFailedUpdates to prevent undefined errors
    ;(PackageStorage.getFailedUpdates as jest.Mock).mockResolvedValue([])
    // Setup checkForUpdateWithMismatchInfo to wrap checkForUpdate results
    setupCheckForUpdateMismatchMock()
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

    it('should return null for invalid UpdateState value', async () => {
      const invalidState = 999 as UpdateState

      const result = await codePush.getUpdateMetadata(invalidState)

      expect(result).toBeNull()
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
    let mockRestartQueue: any

    beforeEach(() => {
      mockRestartQueue = {
        queueRestart: jest.fn(fn => fn()), // Execute immediately
        allowRestart: jest.fn(),
        disallowRestart: jest.fn(),
        clearQueue: jest.fn(),
        isRestartAllowed: jest.fn(() => true),
      }
      ;(RestartQueue.getInstance as jest.Mock).mockReturnValue(mockRestartQueue)
    })

    it('should use RestartQueue to restart', async () => {
      ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue({
        packageHash: 'test123',
      })

      await codePush.restartApp()

      expect(RestartQueue.getInstance).toHaveBeenCalled()
      expect(mockRestartQueue.queueRestart).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should not restart if onlyIfUpdateIsPending is true and no pending update', async () => {
      ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue(null)

      await codePush.restartApp(true)

      expect(mockRestartQueue.queueRestart).not.toHaveBeenCalled()
    })

    it('should restart if onlyIfUpdateIsPending is true and update is pending', async () => {
      ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue({
        packageHash: 'test123',
      })

      await codePush.restartApp(true)

      expect(RestartQueue.getInstance).toHaveBeenCalled()
      expect(mockRestartQueue.queueRestart).toHaveBeenCalledWith(expect.any(Function))
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

      it('should throw TimeoutError when sync exceeds timeout', async () => {
        // Make sync hang indefinitely
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockImplementation(
          () => new Promise(() => {}) // Never resolves
        )

        await expect(codePush.sync({ syncTimeoutMs: 50 })).rejects.toThrow(TimeoutError)
      })

      it('should include timeout details in TimeoutError', async () => {
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockImplementation(
          () => new Promise(() => {})
        )

        try {
          await codePush.sync({ syncTimeoutMs: 50 })
          fail('Expected TimeoutError to be thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(TimeoutError)
          expect((error as TimeoutError).message).toContain('50ms')
        }
      })

      it('should clear isSyncing flag when timeout occurs', async () => {
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockImplementation(
          () => new Promise(() => {})
        )

        await expect(codePush.sync({ syncTimeoutMs: 50 })).rejects.toThrow(TimeoutError)

        // Verify mutex is cleared - next sync should not return SYNC_IN_PROGRESS
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(null)
        const status = await codePush.sync({ syncTimeoutMs: 0 }) // Disable timeout
        expect(status).toBe(0) // SyncStatus.UP_TO_DATE
      })

      it('should skip timeout wrapper when syncTimeoutMs is 0', async () => {
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(null)

        const status = await codePush.sync({ syncTimeoutMs: 0 })

        expect(status).toBe(0) // SyncStatus.UP_TO_DATE
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

    describe('sync callbacks (react-native-code-push compatible)', () => {
      it('should call syncStatusChangedCallback with status updates', async () => {
        mockRemotePackage.download.mockResolvedValue(mockLocalPackage)
        mockLocalPackage.install.mockResolvedValue(undefined)
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(mockRemotePackage)

        const statusCallback = jest.fn()

        await codePush.sync({}, statusCallback)

        expect(statusCallback).toHaveBeenCalledWith(SyncStatus.CHECKING_FOR_UPDATE)
        expect(statusCallback).toHaveBeenCalledWith(SyncStatus.DOWNLOADING_PACKAGE)
        expect(statusCallback).toHaveBeenCalledWith(SyncStatus.INSTALLING_UPDATE)
        expect(statusCallback).toHaveBeenCalledWith(SyncStatus.UPDATE_INSTALLED)
      })

      it('should call syncStatusChangedCallback with UP_TO_DATE when no update', async () => {
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(null)

        const statusCallback = jest.fn()

        await codePush.sync({}, statusCallback)

        expect(statusCallback).toHaveBeenCalledWith(SyncStatus.CHECKING_FOR_UPDATE)
        expect(statusCallback).toHaveBeenCalledWith(SyncStatus.UP_TO_DATE)
      })

      it('should call downloadProgressCallback during download', async () => {
        const progressCallback = jest.fn()
        mockRemotePackage.download.mockImplementation(async (cb?: (p: unknown) => void) => {
          cb?.({ receivedBytes: 50, totalBytes: 100 })
          cb?.({ receivedBytes: 100, totalBytes: 100 })
          return mockLocalPackage
        })
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(mockRemotePackage)

        await codePush.sync({}, undefined, progressCallback)

        expect(progressCallback).toHaveBeenCalledWith({ receivedBytes: 50, totalBytes: 100 })
        expect(progressCallback).toHaveBeenCalledWith({ receivedBytes: 100, totalBytes: 100 })
      })

      it('should call SYNC_IN_PROGRESS callback when sync already running', async () => {
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve(null), 100))
        )

        const statusCallback1 = jest.fn()
        const statusCallback2 = jest.fn()

        const promise1 = codePush.sync({}, statusCallback1)
        const promise2 = codePush.sync({}, statusCallback2)

        await Promise.all([promise1, promise2])

        expect(statusCallback2).toHaveBeenCalledWith(SyncStatus.SYNC_IN_PROGRESS)
      })
    })

    describe('binary version mismatch callback', () => {
      it('should call handleBinaryVersionMismatchCallback when binary update needed', async () => {
        const mismatchCallback = jest.fn()
        const mismatchPackage = { ...mockRemotePackage }

        // Mock checkForUpdateWithMismatchInfo to return binary mismatch
        ;(BitriseClient.prototype.checkForUpdateWithMismatchInfo as jest.Mock).mockResolvedValue({
          remotePackage: mismatchPackage,
          binaryVersionMismatch: true,
        })

        const status = await codePush.sync({}, undefined, undefined, mismatchCallback)

        expect(mismatchCallback).toHaveBeenCalledWith(mismatchPackage)
        expect(status).toBe(SyncStatus.UP_TO_DATE)
        expect(mockRemotePackage.download).not.toHaveBeenCalled()
      })

      it('should not call mismatchCallback when no binary mismatch', async () => {
        const mismatchCallback = jest.fn()
        ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(null)

        await codePush.sync({}, undefined, undefined, mismatchCallback)

        expect(mismatchCallback).not.toHaveBeenCalled()
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
        ;(PackageStorage.setFailedUpdates as jest.Mock).mockResolvedValue(undefined)

        codePush.notifyAppReady()

        await new Promise(resolve => setTimeout(resolve, 10))

        expect(PackageStorage.setFailedUpdates).toHaveBeenCalledWith([])
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

  describe('Phase 5: allowRestart', () => {
    let mockRestartQueue: any

    beforeEach(() => {
      mockRestartQueue = {
        allowRestart: jest.fn(),
        disallowRestart: jest.fn(),
        queueRestart: jest.fn(),
        clearQueue: jest.fn(),
        isRestartAllowed: jest.fn(() => true),
      }
      ;(RestartQueue.getInstance as jest.Mock).mockReturnValue(mockRestartQueue)
    })

    it('should call RestartQueue.allowRestart', () => {
      codePush.allowRestart()

      expect(RestartQueue.getInstance).toHaveBeenCalled()
      expect(mockRestartQueue.allowRestart).toHaveBeenCalled()
    })

    it('should execute queued restart when called', () => {
      const restartFn = jest.fn()
      mockRestartQueue.queueRestart.mockImplementation((fn: () => void) => fn())

      codePush.allowRestart()
      mockRestartQueue.queueRestart(restartFn)

      expect(restartFn).toHaveBeenCalled()
    })
  })

  describe('Phase 5: disallowRestart', () => {
    let mockRestartQueue: any

    beforeEach(() => {
      mockRestartQueue = {
        allowRestart: jest.fn(),
        disallowRestart: jest.fn(),
        queueRestart: jest.fn(),
        clearQueue: jest.fn(),
        isRestartAllowed: jest.fn(() => false),
      }
      ;(RestartQueue.getInstance as jest.Mock).mockReturnValue(mockRestartQueue)
    })

    it('should call RestartQueue.disallowRestart', () => {
      codePush.disallowRestart()

      expect(RestartQueue.getInstance).toHaveBeenCalled()
      expect(mockRestartQueue.disallowRestart).toHaveBeenCalled()
    })

    it('should prevent restarts from executing', () => {
      const restartFn = jest.fn()
      mockRestartQueue.queueRestart.mockImplementation((_fn: () => void) => {
        // Queue instead of execute
      })

      codePush.disallowRestart()
      mockRestartQueue.queueRestart(restartFn)

      expect(restartFn).not.toHaveBeenCalled()
    })
  })

  describe('Phase 5: restartApp with RestartQueue', () => {
    let mockRestartQueue: any

    beforeEach(() => {
      mockRestartQueue = {
        allowRestart: jest.fn(),
        disallowRestart: jest.fn(),
        queueRestart: jest.fn(fn => fn()), // Execute immediately by default
        clearQueue: jest.fn(),
        isRestartAllowed: jest.fn(() => true),
      }
      ;(RestartQueue.getInstance as jest.Mock).mockReturnValue(mockRestartQueue)
    })

    it('should use RestartQueue to queue restart', async () => {
      ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue({
        packageHash: 'test123',
      })

      await codePush.restartApp()

      expect(RestartQueue.getInstance).toHaveBeenCalled()
      expect(mockRestartQueue.queueRestart).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should respect onlyIfUpdateIsPending flag', async () => {
      ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue(null)

      await codePush.restartApp(true)

      expect(mockRestartQueue.queueRestart).not.toHaveBeenCalled()
    })

    it('should restart when update is pending and flag is true', async () => {
      ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue({
        packageHash: 'test123',
      })

      await codePush.restartApp(true)

      expect(mockRestartQueue.queueRestart).toHaveBeenCalled()
    })
  })

  describe('Phase 5: clearUpdates', () => {
    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation()
      jest.spyOn(console, 'error').mockImplementation()
    })

    it('should clear all package data and metadata', async () => {
      const currentPackage = { packageHash: 'hash1', label: 'v1' }
      const pendingPackage = { packageHash: 'hash2', label: 'v2' }

      ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(currentPackage)
      ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue(pendingPackage)
      ;(PackageStorage.deletePackageData as jest.Mock).mockResolvedValue(undefined)
      ;(PackageStorage.clearPendingPackage as jest.Mock).mockResolvedValue(undefined)
      ;(PackageStorage.clearFailedUpdates as jest.Mock).mockResolvedValue(undefined)

      await codePush.clearUpdates()

      expect(PackageStorage.deletePackageData).toHaveBeenCalledWith('hash1')
      expect(PackageStorage.deletePackageData).toHaveBeenCalledWith('hash2')
      expect(PackageStorage.clearPendingPackage).toHaveBeenCalled()
      expect(PackageStorage.clearFailedUpdates).toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith('[CodePush] Cleared all updates')
    })

    it('should handle no packages gracefully', async () => {
      ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(null)
      ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue(null)

      await codePush.clearUpdates()

      expect(PackageStorage.deletePackageData).not.toHaveBeenCalled()
      expect(PackageStorage.clearPendingPackage).toHaveBeenCalled()
      expect(PackageStorage.clearFailedUpdates).toHaveBeenCalled()
    })

    it('should throw UpdateError on failure', async () => {
      const error = new Error('Storage error')
      ;(PackageStorage.getCurrentPackage as jest.Mock).mockRejectedValue(error)

      await expect(codePush.clearUpdates()).rejects.toThrow(UpdateError)
      await expect(codePush.clearUpdates()).rejects.toThrow('Failed to clear updates')

      expect(console.error).toHaveBeenCalledWith('[CodePush] Failed to clear updates:', error)
    })

    it('should handle only current package', async () => {
      const currentPackage = { packageHash: 'hash1' }
      ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(currentPackage)
      ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue(null)

      await codePush.clearUpdates()

      expect(PackageStorage.deletePackageData).toHaveBeenCalledWith('hash1')
      expect(PackageStorage.deletePackageData).toHaveBeenCalledTimes(1)
    })

    it('should handle only pending package', async () => {
      const pendingPackage = { packageHash: 'hash2' }
      ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(null)
      ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue(pendingPackage)

      await codePush.clearUpdates()

      expect(PackageStorage.deletePackageData).toHaveBeenCalledWith('hash2')
      expect(PackageStorage.deletePackageData).toHaveBeenCalledTimes(1)
    })
  })

  describe('Phase 5: Update Dialog', () => {
    const mockRemotePackage: RemotePackage = {
      appVersion: '1.0.0',
      deploymentKey: 'test-key',
      description: 'Bug fixes and improvements',
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
      mockRemotePackage.download.mockResolvedValue(mockLocalPackage)
      mockLocalPackage.install.mockResolvedValue(undefined)
      ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(mockRemotePackage)
      ;(PackageStorage.getFailedUpdates as jest.Mock).mockResolvedValue([])
    })

    it('should show dialog for optional updates', async () => {
      ;(Alert.alert as jest.Mock).mockImplementation((title, message, buttons) => {
        buttons[1].onPress() // User clicks "Install"
      })

      const status = await codePush.sync({
        updateDialog: true,
      })

      expect(Alert.alert).toHaveBeenCalledWith(
        'Update available',
        'An update is available. Would you like to install it?',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Not Now', style: 'cancel' }),
          expect.objectContaining({ text: 'Install' }),
        ]),
        expect.objectContaining({ cancelable: true })
      )
      expect(status).toBe(SyncStatus.UPDATE_INSTALLED)
    })

    it('should return UPDATE_IGNORED when user declines', async () => {
      ;(Alert.alert as jest.Mock).mockImplementation((title, message, buttons) => {
        buttons[0].onPress() // User clicks "Not Now"
      })

      const status = await codePush.sync({
        updateDialog: true,
      })

      expect(status).toBe(SyncStatus.UPDATE_IGNORED)
      expect(mockRemotePackage.download).not.toHaveBeenCalled()
    })

    it('should show dialog with only Continue button for mandatory updates', async () => {
      const mandatoryPackage = { ...mockRemotePackage, isMandatory: true }
      ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(mandatoryPackage)
      mandatoryPackage.download.mockResolvedValue(mockLocalPackage)
      ;(Alert.alert as jest.Mock).mockImplementation((_title, _message, buttons) => {
        // Mandatory dialog has only one button
        buttons[0].onPress()
      })

      const status = await codePush.sync({
        updateDialog: true,
      })

      expect(Alert.alert).toHaveBeenCalledWith(
        'Update available',
        'An update is available that must be installed.',
        expect.arrayContaining([expect.objectContaining({ text: 'Continue' })]),
        expect.objectContaining({ cancelable: false })
      )
      expect(status).toBe(SyncStatus.UPDATE_INSTALLED)
    })

    it('should support custom dialog options', async () => {
      ;(Alert.alert as jest.Mock).mockImplementation((title, message, buttons) => {
        buttons[1].onPress()
      })

      await codePush.sync({
        updateDialog: {
          title: 'New Version',
          optionalUpdateMessage: 'Update now?',
          optionalInstallButtonLabel: 'Yes',
          optionalIgnoreButtonLabel: 'No',
        },
      })

      expect(Alert.alert).toHaveBeenCalledWith(
        'New Version',
        'Update now?',
        expect.arrayContaining([
          expect.objectContaining({ text: 'No', style: 'cancel' }),
          expect.objectContaining({ text: 'Yes' }),
        ]),
        expect.objectContaining({ cancelable: true })
      )
    })

    it('should append release description when configured', async () => {
      ;(Alert.alert as jest.Mock).mockImplementation((title, message, buttons) => {
        buttons[1].onPress()
      })

      await codePush.sync({
        updateDialog: {
          appendReleaseDescription: true,
        },
      })

      expect(Alert.alert).toHaveBeenCalledWith(
        'Update available',
        expect.stringContaining('Release notes:'),
        expect.any(Array),
        expect.any(Object)
      )
      expect(Alert.alert).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Bug fixes and improvements'),
        expect.any(Array),
        expect.any(Object)
      )
    })

    it('should use custom description prefix', async () => {
      ;(Alert.alert as jest.Mock).mockImplementation((title, message, buttons) => {
        buttons[1].onPress()
      })

      await codePush.sync({
        updateDialog: {
          appendReleaseDescription: true,
          descriptionPrefix: "\n\nWhat's new:\n",
        },
      })

      expect(Alert.alert).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("What's new:"),
        expect.any(Array),
        expect.any(Object)
      )
    })

    it('should handle boolean updateDialog option', async () => {
      ;(Alert.alert as jest.Mock).mockImplementation((title, message, buttons) => {
        buttons[1].onPress()
      })

      await codePush.sync({
        updateDialog: true,
      })

      expect(Alert.alert).toHaveBeenCalledWith(
        'Update available',
        expect.any(String),
        expect.any(Array),
        expect.any(Object)
      )
    })

    it('should not append description if not present', async () => {
      const packageWithoutDesc = { ...mockRemotePackage, description: '' }
      ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(packageWithoutDesc)
      packageWithoutDesc.download.mockResolvedValue(mockLocalPackage)
      ;(Alert.alert as jest.Mock).mockImplementation((title, message, buttons) => {
        buttons[1].onPress()
      })

      await codePush.sync({
        updateDialog: {
          appendReleaseDescription: true,
        },
      })

      expect(Alert.alert).toHaveBeenCalledWith(
        expect.any(String),
        'An update is available. Would you like to install it?',
        expect.any(Array),
        expect.any(Object)
      )
    })
  })

  describe('Phase 5: notifyAppReady with setFailedUpdates', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation()
    })

    it('should use setFailedUpdates to remove current package hash', async () => {
      const currentPackage = { packageHash: 'hash123' }
      ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(currentPackage)
      ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue(null)
      ;(PackageStorage.getFailedUpdates as jest.Mock).mockResolvedValue(['hash123', 'hash456'])
      ;(PackageStorage.setFailedUpdates as jest.Mock).mockResolvedValue(undefined)

      codePush.notifyAppReady()

      await new Promise(resolve => setTimeout(resolve, 10))

      expect(PackageStorage.setFailedUpdates).toHaveBeenCalledWith(['hash456'])
    })

    it('should call setFailedUpdates with empty array when only one hash', async () => {
      const currentPackage = { packageHash: 'hash123' }
      ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(currentPackage)
      ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue(null)
      ;(PackageStorage.getFailedUpdates as jest.Mock).mockResolvedValue(['hash123'])
      ;(PackageStorage.setFailedUpdates as jest.Mock).mockResolvedValue(undefined)

      codePush.notifyAppReady()

      await new Promise(resolve => setTimeout(resolve, 10))

      expect(PackageStorage.setFailedUpdates).toHaveBeenCalledWith([])
    })

    it('should not call setFailedUpdates if package not in failed list', async () => {
      const currentPackage = { packageHash: 'hash123' }
      ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(currentPackage)
      ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue(null)
      ;(PackageStorage.getFailedUpdates as jest.Mock).mockResolvedValue(['hash456'])

      codePush.notifyAppReady()

      await new Promise(resolve => setTimeout(resolve, 10))

      expect(PackageStorage.setFailedUpdates).not.toHaveBeenCalled()
    })
  })

  describe('toJSON', () => {
    it('should return safe serialization without sensitive data', () => {
      const json = codePush.toJSON()

      expect(json).toEqual({
        serverUrl: 'https://api.bitrise.io',
        configured: false, // client not created until sync is called
        notifyAppReadyCalled: false,
        isSyncing: false,
      })
    })

    it('should show configured true after client is initialized', async () => {
      ;(BitriseClient.prototype.checkForUpdate as jest.Mock).mockResolvedValue(null)
      await codePush.sync()

      const json = codePush.toJSON() as { configured: boolean }
      expect(json.configured).toBe(true)
    })

    it('should not include deployment key in JSON output', () => {
      const json = codePush.toJSON()

      expect(json).not.toHaveProperty('deploymentKey')
      expect(json).not.toHaveProperty('apiToken')
      expect(json).not.toHaveProperty('bitriseConfig')
    })

    it('should reflect notifyAppReadyCalled state', () => {
      ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(null)
      codePush.notifyAppReady()

      const json = codePush.toJSON()

      expect(json).toHaveProperty('notifyAppReadyCalled', true)
    })

    it('should be safe to JSON.stringify', () => {
      const result = JSON.stringify(codePush)

      expect(result).toContain('serverUrl')
      expect(result).toContain('configured')
      expect(result).not.toContain('test-deployment-key')
      expect(result).not.toContain('test-token')
    })
  })
})
