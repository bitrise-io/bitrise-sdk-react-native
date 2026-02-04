import { RemotePackageImpl } from '../RemotePackageImpl'
import { LocalPackageImpl } from '../LocalPackageImpl'
import { NetworkError, UpdateError } from '../../types/errors'
import * as fileUtils from '../../utils/file'

// Mock file utilities
jest.mock('../../utils/file')

// Mock fetch
global.fetch = jest.fn()

describe('RemotePackageImpl', () => {
  const mockPackageData = {
    appVersion: '1.0.0',
    deploymentKey: 'test-key',
    description: 'Test update',
    failedInstall: false,
    isFirstRun: false,
    isMandatory: false,
    isPending: false,
    label: 'v1',
    packageHash: 'abc123',
    packageSize: 1024,
    downloadUrl: 'https://example.com/package.zip',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'warn').mockImplementation()
    jest.spyOn(console, 'log').mockImplementation()

    // Explicitly reset fetch mock
    ;(global.fetch as jest.Mock).mockClear()

    // Reset download in progress flag
    // @ts-expect-error - Accessing private static field for testing
    RemotePackageImpl.downloadInProgress = false
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create RemotePackage with all properties', () => {
      const pkg = new RemotePackageImpl(mockPackageData)

      expect(pkg.appVersion).toBe('1.0.0')
      expect(pkg.deploymentKey).toBe('test-key')
      expect(pkg.packageHash).toBe('abc123')
      expect(pkg.downloadUrl).toBe('https://example.com/package.zip')
    })
  })

  describe('download', () => {
    // Increase timeout for network tests with retries
    jest.setTimeout(20000)

    it('should download package successfully', async () => {
      const pkg = new RemotePackageImpl(mockPackageData)
      const mockData = new Uint8Array([1, 2, 3, 4, 5])

      // Mock fetch response
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

      const localPackage = await pkg.download()

      expect(localPackage).toBeInstanceOf(LocalPackageImpl)
      expect(localPackage.packageHash).toBe('abc123')
      expect(localPackage.localPath).toBe('/codepush/abc123/index.bundle')
      expect(fileUtils.calculateHash).toHaveBeenCalledWith(mockData)
      expect(fileUtils.savePackage).toHaveBeenCalledWith('abc123', mockData)
    })

    it('should call progress callback during download', async () => {
      const pkg = new RemotePackageImpl(mockPackageData)
      const progressCallback = jest.fn()
      const mockData = new Uint8Array([1, 2, 3, 4, 5])

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
      ;(fileUtils.calculateHash as jest.Mock).mockResolvedValue('abc123')
      ;(fileUtils.savePackage as jest.Mock).mockResolvedValue('/codepush/abc123/index.bundle')

      await pkg.download(progressCallback)

      expect(progressCallback).toHaveBeenCalledWith({
        receivedBytes: 5,
        totalBytes: 5,
      })
    })

    it('should handle concurrent downloads via queue', async () => {
      const pkg1 = new RemotePackageImpl(mockPackageData)
      const pkg2 = new RemotePackageImpl({ ...mockPackageData, packageHash: 'def456' })

      const mockData1 = new Uint8Array([1, 2, 3])
      const mockData2 = new Uint8Array([4, 5, 6])

      // Mock fetch responses for both downloads
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: jest.fn().mockReturnValue('3') },
          body: {
            getReader: jest.fn().mockReturnValue({
              read: jest
                .fn()
                .mockResolvedValueOnce({ done: false, value: mockData1 })
                .mockResolvedValueOnce({ done: true }),
            }),
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: jest.fn().mockReturnValue('3') },
          body: {
            getReader: jest.fn().mockReturnValue({
              read: jest
                .fn()
                .mockResolvedValueOnce({ done: false, value: mockData2 })
                .mockResolvedValueOnce({ done: true }),
            }),
          },
        })

      ;(fileUtils.calculateHash as jest.Mock)
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('def456')
      ;(fileUtils.savePackage as jest.Mock)
        .mockResolvedValueOnce('/codepush/abc123/index.bundle')
        .mockResolvedValueOnce('/codepush/def456/index.bundle')

      // Both downloads should complete successfully (queued internally)
      const [local1, local2] = await Promise.all([pkg1.download(), pkg2.download()])

      expect(local1.packageHash).toBe('abc123')
      expect(local2.packageHash).toBe('def456')
    })

    it('should throw error if hash verification fails', async () => {
      const pkg = new RemotePackageImpl(mockPackageData)
      const mockData = new Uint8Array([1, 2, 3])

      // Create a new reader for each fetch attempt
      const createMockReader = () => ({
        read: jest
          .fn()
          .mockResolvedValueOnce({ done: false, value: mockData })
          .mockResolvedValueOnce({ done: true }),
      })

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('3'),
        },
        body: {
          getReader: jest.fn(() => createMockReader()),
        },
      })

      // Mock hash mismatch
      ;(fileUtils.calculateHash as jest.Mock).mockResolvedValue('wronghash')
      ;(fileUtils.deletePackage as jest.Mock).mockResolvedValue(undefined)

      const error = await pkg.download().catch(e => e)

      expect(error).toBeInstanceOf(UpdateError)
      expect(error.message).toContain('Hash verification failed')

      // Verify cleanup was attempted
      expect(fileUtils.deletePackage).toHaveBeenCalled()
    })

    it('should skip hash verification if hash calculation returns "unverified"', async () => {
      const pkg = new RemotePackageImpl(mockPackageData)
      const mockData = new Uint8Array([1, 2, 3])

      // Create a new reader for each fetch attempt
      const createMockReader = () => ({
        read: jest
          .fn()
          .mockResolvedValueOnce({ done: false, value: mockData })
          .mockResolvedValueOnce({ done: true }),
      })

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('3'),
        },
        body: {
          getReader: jest.fn(() => createMockReader()),
        },
      })

      // Mock hash calculation unavailable
      ;(fileUtils.calculateHash as jest.Mock).mockResolvedValue('unverified')
      ;(fileUtils.savePackage as jest.Mock).mockResolvedValue('/codepush/abc123/index.bundle')

      // Should not throw despite hash mismatch
      const localPackage = await pkg.download()

      expect(localPackage).toBeInstanceOf(LocalPackageImpl)
    })

    it('should retry on network failure', async () => {
      const pkg = new RemotePackageImpl(mockPackageData)
      const mockData = new Uint8Array([1, 2, 3])

      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({ done: false, value: mockData })
          .mockResolvedValueOnce({ done: true }),
      }

      // Fail twice, succeed on third attempt
      ;(global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: jest.fn().mockReturnValue('3'),
          },
          body: {
            getReader: jest.fn().mockReturnValue(mockReader),
          },
        })
      ;(fileUtils.calculateHash as jest.Mock).mockResolvedValue('abc123')
      ;(fileUtils.savePackage as jest.Mock).mockResolvedValue('/codepush/abc123/index.bundle')

      const localPackage = await pkg.download()

      expect(localPackage).toBeInstanceOf(LocalPackageImpl)
      expect(global.fetch).toHaveBeenCalledTimes(3)
    })

    it('should throw NetworkError after max retries', async () => {
      const pkg = new RemotePackageImpl(mockPackageData)

      // Fail all attempts
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      await expect(pkg.download()).rejects.toThrow(NetworkError)
      // DownloadQueue retries 3 times, each attempt retries download 3 times = 9 total
      expect(global.fetch).toHaveBeenCalledTimes(9)
    })

    it('should throw NetworkError if HTTP response is not ok', async () => {
      const pkg = new RemotePackageImpl(mockPackageData)

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })
      ;(fileUtils.deletePackage as jest.Mock).mockResolvedValue(undefined)

      const error = await pkg.download().catch(e => e)

      expect(error).toBeInstanceOf(NetworkError)
      expect(error.message).toContain('HTTP 404: Not Found')
    })

    it('should throw NetworkError if response body is not readable', async () => {
      const pkg = new RemotePackageImpl(mockPackageData)

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('5'),
        },
        body: null,
      })
      ;(fileUtils.deletePackage as jest.Mock).mockResolvedValue(undefined)

      const error = await pkg.download().catch(e => e)

      expect(error).toBeInstanceOf(NetworkError)
      expect(error.message).toContain('Response body is not readable')
    })

    it('should handle progress callback errors gracefully', async () => {
      const pkg = new RemotePackageImpl(mockPackageData)
      const badCallback = jest.fn().mockImplementation(() => {
        throw new Error('Callback error')
      })
      const mockData = new Uint8Array([1, 2, 3])

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
      ;(fileUtils.calculateHash as jest.Mock).mockResolvedValue('abc123')
      ;(fileUtils.savePackage as jest.Mock).mockResolvedValue('/codepush/abc123/index.bundle')

      // Should complete despite callback error
      const localPackage = await pkg.download(badCallback)

      expect(localPackage).toBeInstanceOf(LocalPackageImpl)
      expect(console.warn).toHaveBeenCalledWith(
        '[CodePush] Progress callback error:',
        'Callback error'
      )
    })

    it('should use packageSize if Content-Length header is missing', async () => {
      const pkg = new RemotePackageImpl(mockPackageData)
      const progressCallback = jest.fn()
      const mockData = new Uint8Array([1, 2, 3])

      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({ done: false, value: mockData })
          .mockResolvedValueOnce({ done: true }),
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue(null), // No Content-Length
        },
        body: {
          getReader: jest.fn().mockReturnValue(mockReader),
        },
      })
      ;(fileUtils.calculateHash as jest.Mock).mockResolvedValue('abc123')
      ;(fileUtils.savePackage as jest.Mock).mockResolvedValue('/codepush/abc123/index.bundle')

      await pkg.download(progressCallback)

      // Should use packageSize (1024) from mockPackageData
      expect(progressCallback).toHaveBeenCalledWith({
        receivedBytes: 3,
        totalBytes: 1024,
      })
    })
  })
})
