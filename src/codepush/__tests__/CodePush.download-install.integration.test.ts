import { CodePush } from '../CodePush'
import { RemotePackageImpl } from '../RemotePackageImpl'
import { BitriseClient } from '../../network/BitriseClient'
import { PackageStorage } from '../../storage/PackageStorage'
import { InstallMode } from '../../types/enums'
import type { BitriseConfig } from '../../types/config'
import * as fileUtils from '../../utils/file'
import { RestartQueue } from '../RestartQueue'
import { restartApp } from '../../native/Restart'

// Mock dependencies
jest.mock('../../network/BitriseClient')
jest.mock('../../storage/PackageStorage')
jest.mock('../../utils/file')
jest.mock('../RestartQueue')
jest.mock('../../native/Restart')
jest.mock('../../utils/platform', () => ({
  getAppVersion: jest.fn().mockReturnValue('1.0.0'),
}))

// Mock fetch
global.fetch = jest.fn()

describe('CodePush Download & Install Integration', () => {
  const config: BitriseConfig = {
    deploymentKey: 'test-deployment-key',
    serverUrl: 'https://api.bitrise.io',
  }

  let codePush: CodePush

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'warn').mockImplementation()
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()

    codePush = new CodePush(config)

    // Default mocks
    ;(PackageStorage.getCurrentPackage as jest.Mock).mockResolvedValue(null)
    ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue(null)
    ;(PackageStorage.getPackageData as jest.Mock).mockResolvedValue('base64data')
    ;(PackageStorage.setPendingPackage as jest.Mock).mockResolvedValue(undefined)
    ;(PackageStorage.setInstallMetadata as jest.Mock).mockResolvedValue(undefined)
    ;(PackageStorage.getFailedUpdates as jest.Mock).mockResolvedValue([])

    // Mock RestartQueue
    const mockRestartQueue = {
      queueRestart: jest.fn(fn => fn()), // Execute immediately
      allowRestart: jest.fn(),
      disallowRestart: jest.fn(),
      clearQueue: jest.fn(),
      isRestartAllowed: jest.fn(() => true),
    }
    ;(RestartQueue.getInstance as jest.Mock).mockReturnValue(mockRestartQueue)

    // Reset download in progress flag
    // @ts-expect-error - Accessing private static field for testing
    RemotePackageImpl.downloadInProgress = false
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Full update flow: check → download → install → restart', () => {
    it('should complete full update flow successfully', async () => {
      const mockData = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"

      // Mock checkForUpdate to return RemotePackageImpl instance
      const mockCheckForUpdate = jest.fn().mockResolvedValue(
        new RemotePackageImpl({
          appVersion: '1.0.0',
          deploymentKey: 'test-key',
          description: 'Test update',
          failedInstall: false,
          isFirstRun: false,
          isMandatory: false,
          isPending: false,
          label: 'v1',
          packageHash: 'abc123',
          packageSize: 5,
          downloadUrl: 'https://example.com/package.zip',
        })
      )

      ;(BitriseClient as jest.Mock).mockImplementation(() => ({
        checkForUpdate: mockCheckForUpdate,
      }))

      // Mock fetch for download
      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({ done: false, value: mockData })
          .mockResolvedValueOnce({ done: true }),
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('5'),
        },
        body: {
          getReader: jest.fn().mockReturnValue(mockReader),
        },
      })

      // Mock file utilities
      ;(fileUtils.calculateHash as jest.Mock).mockResolvedValue('abc123')
      ;(fileUtils.savePackage as jest.Mock).mockResolvedValue('/codepush/abc123/index.bundle')

      // 1. Check for update
      const update = await codePush.checkForUpdate()
      expect(update).not.toBeNull()
      expect(update?.packageHash).toBe('abc123')

      // 2. Download update
      const progressCallback = jest.fn()
      const localPackage = await update!.download(progressCallback)

      expect(progressCallback).toHaveBeenCalledWith({
        receivedBytes: 5,
        totalBytes: 5,
      })
      expect(localPackage).toBeDefined()
      expect(localPackage.localPath).toBe('/codepush/abc123/index.bundle')

      // 3. Install update
      await localPackage.install(InstallMode.ON_NEXT_RESTART)

      expect(PackageStorage.setPendingPackage).toHaveBeenCalled()
      expect(PackageStorage.setInstallMetadata).toHaveBeenCalledWith('abc123', {
        installMode: InstallMode.ON_NEXT_RESTART,
        timestamp: expect.any(Number),
        minimumBackgroundDuration: undefined,
      })

      // 4. Restart app
      // Mock that pending package exists (it was set during install)
      ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue(localPackage)

      await codePush.restartApp(true)

      // Should call RestartQueue and restartApp
      expect(RestartQueue.getInstance).toHaveBeenCalled()
      expect(restartApp).toHaveBeenCalled()
    })

    it('should handle immediate install and restart', async () => {
      const mockData = new Uint8Array([1, 2, 3])

      const mockCheckForUpdate = jest.fn().mockResolvedValue(
        new RemotePackageImpl({
          appVersion: '1.0.0',
          deploymentKey: 'test-key',
          description: 'Urgent fix',
          failedInstall: false,
          isFirstRun: false,
          isMandatory: true,
          isPending: false,
          label: 'v2',
          packageHash: 'xyz789',
          packageSize: 3,
          downloadUrl: 'https://example.com/package.zip',
        })
      )

      ;(BitriseClient as jest.Mock).mockImplementation(() => ({
        checkForUpdate: mockCheckForUpdate,
      }))

      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({ done: false, value: mockData })
          .mockResolvedValueOnce({ done: true }),
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('3'),
        },
        body: {
          getReader: jest.fn().mockReturnValue(mockReader),
        },
      })
      ;(fileUtils.calculateHash as jest.Mock).mockResolvedValue('xyz789')
      ;(fileUtils.savePackage as jest.Mock).mockResolvedValue('/codepush/xyz789/index.bundle')

      const update = await codePush.checkForUpdate()
      const localPackage = await update!.download()
      await localPackage.install(InstallMode.IMMEDIATE)

      // Should trigger restart via RestartQueue
      expect(RestartQueue.getInstance).toHaveBeenCalled()
      expect(restartApp).toHaveBeenCalled()
    })

    it('should skip restart if no pending update', async () => {
      ;(PackageStorage.getPendingPackage as jest.Mock).mockResolvedValue(null)

      await codePush.restartApp(true)

      // Should not warn about restart needed
      expect(console.warn).not.toHaveBeenCalled()
    })

    it('should clean up partial download on failure', async () => {
      const mockCheckForUpdate = jest.fn().mockResolvedValue(
        new RemotePackageImpl({
          appVersion: '1.0.0',
          deploymentKey: 'test-key',
          description: 'Test update',
          failedInstall: false,
          isFirstRun: false,
          isMandatory: false,
          isPending: false,
          label: 'v3',
          packageHash: 'fail123',
          packageSize: 100,
          downloadUrl: 'https://example.com/package.zip',
        })
      )

      ;(BitriseClient as jest.Mock).mockImplementation(() => ({
        checkForUpdate: mockCheckForUpdate,
      }))

      // Mock fetch failure
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))
      ;(fileUtils.deletePackage as jest.Mock).mockResolvedValue(undefined)

      const update = await codePush.checkForUpdate()

      await expect(update!.download()).rejects.toThrow()

      // Verify cleanup was attempted
      expect(fileUtils.deletePackage).toHaveBeenCalled()
    })

    it('should handle hash mismatch during download', async () => {
      const mockData = new Uint8Array([1, 2, 3])

      const mockCheckForUpdate = jest.fn().mockResolvedValue(
        new RemotePackageImpl({
          appVersion: '1.0.0',
          deploymentKey: 'test-key',
          description: 'Test update',
          failedInstall: false,
          isFirstRun: false,
          isMandatory: false,
          isPending: false,
          label: 'v4',
          packageHash: 'expected123',
          packageSize: 3,
          downloadUrl: 'https://example.com/package.zip',
        })
      )

      ;(BitriseClient as jest.Mock).mockImplementation(() => ({
        checkForUpdate: mockCheckForUpdate,
      }))

      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({ done: false, value: mockData })
          .mockResolvedValueOnce({ done: true }),
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('3'),
        },
        body: {
          getReader: jest.fn().mockReturnValue(mockReader),
        },
      })

      // Mock hash mismatch
      ;(fileUtils.calculateHash as jest.Mock).mockResolvedValue('actual456')
      ;(fileUtils.deletePackage as jest.Mock).mockResolvedValue(undefined)

      const update = await codePush.checkForUpdate()

      await expect(update!.download()).rejects.toThrow('Hash verification failed')
      expect(fileUtils.deletePackage).toHaveBeenCalled()
    })

    it('should track download progress correctly', async () => {
      const chunk1 = new Uint8Array([1, 2, 3])
      const chunk2 = new Uint8Array([4, 5])
      const chunk3 = new Uint8Array([6])

      const mockCheckForUpdate = jest.fn().mockResolvedValue(
        new RemotePackageImpl({
          appVersion: '1.0.0',
          deploymentKey: 'test-key',
          description: 'Test update',
          failedInstall: false,
          isFirstRun: false,
          isMandatory: false,
          isPending: false,
          label: 'v5',
          packageHash: 'progress123',
          packageSize: 6,
          downloadUrl: 'https://example.com/package.zip',
        })
      )

      ;(BitriseClient as jest.Mock).mockImplementation(() => ({
        checkForUpdate: mockCheckForUpdate,
      }))

      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({ done: false, value: chunk1 })
          .mockResolvedValueOnce({ done: false, value: chunk2 })
          .mockResolvedValueOnce({ done: false, value: chunk3 })
          .mockResolvedValueOnce({ done: true }),
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('6'),
        },
        body: {
          getReader: jest.fn().mockReturnValue(mockReader),
        },
      })
      ;(fileUtils.calculateHash as jest.Mock).mockResolvedValue('progress123')
      ;(fileUtils.savePackage as jest.Mock).mockResolvedValue('/codepush/progress123/index.bundle')

      const progressCallback = jest.fn()
      const update = await codePush.checkForUpdate()
      await update!.download(progressCallback)

      expect(progressCallback).toHaveBeenCalledTimes(3)
      expect(progressCallback).toHaveBeenNthCalledWith(1, {
        receivedBytes: 3,
        totalBytes: 6,
      })
      expect(progressCallback).toHaveBeenNthCalledWith(2, {
        receivedBytes: 5,
        totalBytes: 6,
      })
      expect(progressCallback).toHaveBeenNthCalledWith(3, {
        receivedBytes: 6,
        totalBytes: 6,
      })
    })

    it('should handle install with minimumBackgroundDuration', async () => {
      const mockData = new Uint8Array([1, 2, 3])

      const mockCheckForUpdate = jest.fn().mockResolvedValue(
        new RemotePackageImpl({
          appVersion: '1.0.0',
          deploymentKey: 'test-key',
          description: 'Test update',
          failedInstall: false,
          isFirstRun: false,
          isMandatory: false,
          isPending: false,
          label: 'v6',
          packageHash: 'resume123',
          packageSize: 3,
          downloadUrl: 'https://example.com/package.zip',
        })
      )

      ;(BitriseClient as jest.Mock).mockImplementation(() => ({
        checkForUpdate: mockCheckForUpdate,
      }))

      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({ done: false, value: mockData })
          .mockResolvedValueOnce({ done: true }),
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('3'),
        },
        body: {
          getReader: jest.fn().mockReturnValue(mockReader),
        },
      })
      ;(fileUtils.calculateHash as jest.Mock).mockResolvedValue('resume123')
      ;(fileUtils.savePackage as jest.Mock).mockResolvedValue('/codepush/resume123/index.bundle')

      const update = await codePush.checkForUpdate()
      const localPackage = await update!.download()
      await localPackage.install(InstallMode.ON_NEXT_RESUME, 60)

      expect(PackageStorage.setInstallMetadata).toHaveBeenCalledWith('resume123', {
        installMode: InstallMode.ON_NEXT_RESUME,
        timestamp: expect.any(Number),
        minimumBackgroundDuration: 60,
      })
    })
  })
})
