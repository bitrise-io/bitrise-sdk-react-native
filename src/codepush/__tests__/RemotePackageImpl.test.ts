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

  /**
   * Helper to create a mock fetch response with arrayBuffer support
   */
  const createMockResponse = (
    data: Uint8Array,
    options: { ok?: boolean; status?: number; statusText?: string; contentLength?: string | null } = {}
  ) => ({
    ok: options.ok ?? true,
    status: options.status ?? 200,
    statusText: options.statusText ?? 'OK',
    headers: {
      get: jest.fn().mockReturnValue(
        'contentLength' in options ? options.contentLength : String(data.length)
      ),
    },
    arrayBuffer: jest.fn().mockResolvedValue(data.buffer),
  })

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

      ;(global.fetch as jest.Mock).mockResolvedValue(createMockResponse(mockData))

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

      ;(global.fetch as jest.Mock).mockResolvedValue(createMockResponse(mockData))
      ;(fileUtils.calculateHash as jest.Mock).mockResolvedValue('abc123')
      ;(fileUtils.savePackage as jest.Mock).mockResolvedValue('/codepush/abc123/index.bundle')

      await pkg.download(progressCallback)

      // With arrayBuffer(), we get initial (0%) and final (100%) progress
      expect(progressCallback).toHaveBeenCalledWith({
        receivedBytes: 0,
        totalBytes: 5,
      })
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
        .mockResolvedValueOnce(createMockResponse(mockData1))
        .mockResolvedValueOnce(createMockResponse(mockData2))
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

      ;(global.fetch as jest.Mock).mockResolvedValue(createMockResponse(mockData))

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

      ;(global.fetch as jest.Mock).mockResolvedValue(createMockResponse(mockData))

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

      // Fail twice, succeed on third attempt
      ;(global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createMockResponse(mockData))
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

      ;(global.fetch as jest.Mock).mockResolvedValue(
        createMockResponse(new Uint8Array(), { ok: false, status: 404, statusText: 'Not Found' })
      )
      ;(fileUtils.deletePackage as jest.Mock).mockResolvedValue(undefined)

      const error = await pkg.download().catch(e => e)

      expect(error).toBeInstanceOf(NetworkError)
      expect(error.message).toContain('HTTP 404: Not Found')
    })

    it('should handle progress callback errors gracefully', async () => {
      const pkg = new RemotePackageImpl(mockPackageData)
      const badCallback = jest.fn().mockImplementation(() => {
        throw new Error('Callback error')
      })
      const mockData = new Uint8Array([1, 2, 3])

      ;(global.fetch as jest.Mock).mockResolvedValue(createMockResponse(mockData))
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

      ;(global.fetch as jest.Mock).mockResolvedValue(
        createMockResponse(mockData, { contentLength: null })
      )
      ;(fileUtils.calculateHash as jest.Mock).mockResolvedValue('abc123')
      ;(fileUtils.savePackage as jest.Mock).mockResolvedValue('/codepush/abc123/index.bundle')

      await pkg.download(progressCallback)

      // Should use packageSize (1024) from mockPackageData for totalBytes
      expect(progressCallback).toHaveBeenCalledWith({
        receivedBytes: 0,
        totalBytes: 1024,
      })
      expect(progressCallback).toHaveBeenCalledWith({
        receivedBytes: 3,
        totalBytes: 1024,
      })
    })

    describe('differential download', () => {
      const mockPackageWithDiff = {
        ...mockPackageData,
        diffUrl: 'https://example.com/package.diff',
        diffSize: 256,
      }

      it('should use diffUrl when available', async () => {
        const pkg = new RemotePackageImpl(mockPackageWithDiff)
        const mockData = new Uint8Array([1, 2, 3])

        ;(global.fetch as jest.Mock).mockResolvedValue(createMockResponse(mockData))
        ;(fileUtils.calculateHash as jest.Mock).mockResolvedValue('abc123')
        ;(fileUtils.savePackage as jest.Mock).mockResolvedValue('/codepush/abc123/index.bundle')

        await pkg.download()

        // Should fetch from diffUrl, not downloadUrl
        expect(global.fetch).toHaveBeenCalledWith(
          'https://example.com/package.diff',
          expect.any(Object)
        )
      })

      it('should report progress based on diffSize', async () => {
        const pkg = new RemotePackageImpl(mockPackageWithDiff)
        const progressCallback = jest.fn()
        const mockData = new Uint8Array([1, 2, 3])

        ;(global.fetch as jest.Mock).mockResolvedValue(createMockResponse(mockData))
        ;(fileUtils.calculateHash as jest.Mock).mockResolvedValue('abc123')
        ;(fileUtils.savePackage as jest.Mock).mockResolvedValue('/codepush/abc123/index.bundle')

        await pkg.download(progressCallback)

        // Progress should use diffSize (256), not packageSize (1024)
        expect(progressCallback).toHaveBeenCalledWith({
          receivedBytes: 0,
          totalBytes: 256,
        })
        expect(progressCallback).toHaveBeenCalledWith({
          receivedBytes: 3,
          totalBytes: 256,
        })
      })

      it('should fall back to full download when diff fails', async () => {
        const pkg = new RemotePackageImpl(mockPackageWithDiff)
        const mockData = new Uint8Array([1, 2, 3])

        // Diff download has 3 retries, so reject 3 times then succeed for full download
        ;(global.fetch as jest.Mock)
          .mockRejectedValueOnce(new Error('Diff download failed'))
          .mockRejectedValueOnce(new Error('Diff download failed'))
          .mockRejectedValueOnce(new Error('Diff download failed'))
          .mockResolvedValueOnce(createMockResponse(mockData))
        ;(fileUtils.calculateHash as jest.Mock).mockResolvedValue('abc123')
        ;(fileUtils.savePackage as jest.Mock).mockResolvedValue('/codepush/abc123/index.bundle')

        const localPackage = await pkg.download()

        expect(localPackage.packageHash).toBe('abc123')
        // Should have tried diff first, then full download
        expect(console.warn).toHaveBeenCalledWith(
          '[CodePush] Differential download failed, falling back to full download:',
          expect.any(String)
        )
      })

      it('should fall back to full download when diff hash verification fails', async () => {
        const pkg = new RemotePackageImpl(mockPackageWithDiff)
        const mockData = new Uint8Array([1, 2, 3])

        ;(global.fetch as jest.Mock).mockResolvedValue(createMockResponse(mockData))

        // First hash check fails (diff), second succeeds (full download)
        ;(fileUtils.calculateHash as jest.Mock)
          .mockResolvedValueOnce('wronghash')
          .mockResolvedValueOnce('abc123')
        ;(fileUtils.savePackage as jest.Mock).mockResolvedValue('/codepush/abc123/index.bundle')

        const localPackage = await pkg.download()

        expect(localPackage.packageHash).toBe('abc123')
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('Differential download failed'),
          expect.any(String)
        )
      })

      it('should use full download when no diffUrl provided', async () => {
        const pkg = new RemotePackageImpl(mockPackageData) // No diff info
        const mockData = new Uint8Array([1, 2, 3])

        ;(global.fetch as jest.Mock).mockResolvedValue(createMockResponse(mockData))
        ;(fileUtils.calculateHash as jest.Mock).mockResolvedValue('abc123')
        ;(fileUtils.savePackage as jest.Mock).mockResolvedValue('/codepush/abc123/index.bundle')

        await pkg.download()

        // Should fetch from downloadUrl
        expect(global.fetch).toHaveBeenCalledWith(
          'https://example.com/package.zip',
          expect.any(Object)
        )
      })
    })
  })
})
