import { RemotePackageImpl } from '../RemotePackageImpl'
import { DownloadQueue } from '../../download/DownloadQueue'
import { QueueEvent } from '../../download/QueueEvents'
import * as fileUtils from '../../utils/file'

jest.mock('../../utils/file')

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

describe('DownloadQueue Integration', () => {
  let queue: DownloadQueue

  beforeEach(() => {
    jest.clearAllMocks()
    queue = DownloadQueue.getInstance()
    // Clear queue state
    ;(queue as any).queue = []
    ;(queue as any).currentDownload = null
    ;(queue as any).status = 'idle'
    ;(queue as any).processing = false
    ;(queue as any).eventEmitter.removeAllListeners()

    // Mock fetch globally
    global.fetch = jest.fn()
  })

  afterEach(() => {
    ;(queue as any).queue = []
    ;(queue as any).currentDownload = null
    ;(queue as any).status = 'idle'
    ;(queue as any).processing = false
    ;(queue as any).eventEmitter.removeAllListeners()
  })

  describe('Scenario 1: Single download with filesystem storage', () => {
    it('downloads package and stores in filesystem', async () => {
      const mockPackageData = {
        appVersion: '1.0.0',
        deploymentKey: 'test-key',
        description: 'Test package',
        failedInstall: false,
        isFirstRun: false,
        isMandatory: false,
        isPending: false,
        label: 'v1',
        packageHash: 'abc123',
        packageSize: 1024,
        downloadUrl: 'https://example.com/package.zip',
      }

      const pkg = new RemotePackageImpl(mockPackageData)
      const mockData = new Uint8Array([1, 2, 3, 4, 5])

      ;(global.fetch as jest.Mock).mockResolvedValue(createMockResponse(mockData))
      ;(fileUtils.calculateHash as jest.Mock).mockResolvedValue('abc123')
      ;(fileUtils.savePackage as jest.Mock).mockResolvedValue('/codepush/abc123/index.bundle')

      const localPackage = await pkg.download()

      expect(localPackage.packageHash).toBe('abc123')
      expect(localPackage.localPath).toBe('/codepush/abc123/index.bundle')
      expect(fileUtils.savePackage).toHaveBeenCalledWith('abc123', mockData)
    })
  })

  describe('Scenario 2: Multiple concurrent downloads', () => {
    it('queues and processes downloads sequentially', async () => {
      const pkg1 = new RemotePackageImpl({
        appVersion: '1.0.0',
        deploymentKey: 'test-key',
        description: 'Package 1',
        failedInstall: false,
        isFirstRun: false,
        isMandatory: false,
        isPending: false,
        label: 'v1',
        packageHash: 'hash1',
        packageSize: 100,
        downloadUrl: 'https://example.com/pkg1.zip',
      })

      const pkg2 = new RemotePackageImpl({
        appVersion: '1.0.0',
        deploymentKey: 'test-key',
        description: 'Package 2',
        failedInstall: false,
        isFirstRun: false,
        isMandatory: false,
        isPending: false,
        label: 'v2',
        packageHash: 'hash2',
        packageSize: 200,
        downloadUrl: 'https://example.com/pkg2.zip',
      })

      const pkg3 = new RemotePackageImpl({
        appVersion: '1.0.0',
        deploymentKey: 'test-key',
        description: 'Package 3',
        failedInstall: false,
        isFirstRun: false,
        isMandatory: false,
        isPending: false,
        label: 'v3',
        packageHash: 'hash3',
        packageSize: 300,
        downloadUrl: 'https://example.com/pkg3.zip',
      })

      const mockData1 = new Uint8Array([1])
      const mockData2 = new Uint8Array([2])
      const mockData3 = new Uint8Array([3])

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce(createMockResponse(mockData1))
        .mockResolvedValueOnce(createMockResponse(mockData2))
        .mockResolvedValueOnce(createMockResponse(mockData3))
      ;(fileUtils.calculateHash as jest.Mock)
        .mockResolvedValueOnce('hash1')
        .mockResolvedValueOnce('hash2')
        .mockResolvedValueOnce('hash3')
      ;(fileUtils.savePackage as jest.Mock)
        .mockResolvedValueOnce('/codepush/hash1/index.bundle')
        .mockResolvedValueOnce('/codepush/hash2/index.bundle')
        .mockResolvedValueOnce('/codepush/hash3/index.bundle')

      // Track download order
      const downloadOrder: string[] = []
      const onDownloadStarted = jest.fn(data => {
        downloadOrder.push(data.item.remotePackage.packageHash)
      })

      queue.on(QueueEvent.DOWNLOAD_STARTED, onDownloadStarted)

      // Start all downloads concurrently
      const [local1, local2, local3] = await Promise.all([
        pkg1.download(),
        pkg2.download(),
        pkg3.download(),
      ])

      expect(local1.packageHash).toBe('hash1')
      expect(local2.packageHash).toBe('hash2')
      expect(local3.packageHash).toBe('hash3')

      // Verify sequential processing (FIFO)
      expect(downloadOrder).toEqual(['hash1', 'hash2', 'hash3'])
      expect(onDownloadStarted).toHaveBeenCalledTimes(3)
    })
  })

  describe('Scenario 3: Download with progress tracking', () => {
    it('reports progress during download', async () => {
      const pkg = new RemotePackageImpl({
        appVersion: '1.0.0',
        deploymentKey: 'test-key',
        description: 'Test package',
        failedInstall: false,
        isFirstRun: false,
        isMandatory: false,
        isPending: false,
        label: 'v1',
        packageHash: 'abc123',
        packageSize: 1000,
        downloadUrl: 'https://example.com/package.zip',
      })

      const mockData = new Uint8Array(1000)

      ;(global.fetch as jest.Mock).mockResolvedValue(createMockResponse(mockData))
      ;(fileUtils.calculateHash as jest.Mock).mockResolvedValue('abc123')
      ;(fileUtils.savePackage as jest.Mock).mockResolvedValue('/codepush/abc123/index.bundle')

      const progressUpdates: any[] = []
      const progressCallback = jest.fn(progress => {
        progressUpdates.push(progress)
      })

      await pkg.download(progressCallback)

      expect(progressCallback).toHaveBeenCalled()
      expect(progressUpdates.length).toBeGreaterThan(0)
      // With arrayBuffer(), we get 0% and 100% progress
      expect(progressUpdates[0]).toMatchObject({
        receivedBytes: 0,
        totalBytes: 1000,
      })
      expect(progressUpdates[progressUpdates.length - 1]).toMatchObject({
        receivedBytes: 1000,
        totalBytes: 1000,
      })
    })
  })

  describe('Scenario 4: Download failure and retry', () => {
    it('retries failed downloads automatically', async () => {
      const pkg = new RemotePackageImpl({
        appVersion: '1.0.0',
        deploymentKey: 'test-key',
        description: 'Test package',
        failedInstall: false,
        isFirstRun: false,
        isMandatory: false,
        isPending: false,
        label: 'v1',
        packageHash: 'abc123',
        packageSize: 100,
        downloadUrl: 'https://example.com/package.zip',
      })

      const mockData = new Uint8Array([1, 2, 3])

      // Fail first two attempts, succeed on third
      ;(global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValueOnce(createMockResponse(mockData))
      ;(fileUtils.calculateHash as jest.Mock).mockResolvedValue('abc123')
      ;(fileUtils.savePackage as jest.Mock).mockResolvedValue('/codepush/abc123/index.bundle')

      const localPackage = await pkg.download()

      expect(localPackage.packageHash).toBe('abc123')
      expect(global.fetch).toHaveBeenCalledTimes(3)
    }, 15000)
  })

  describe('Scenario 5: Queue events', () => {
    it('emits all expected events during download lifecycle', async () => {
      const pkg = new RemotePackageImpl({
        appVersion: '1.0.0',
        deploymentKey: 'test-key',
        description: 'Test package',
        failedInstall: false,
        isFirstRun: false,
        isMandatory: false,
        isPending: false,
        label: 'v1',
        packageHash: 'abc123',
        packageSize: 100,
        downloadUrl: 'https://example.com/package.zip',
      })

      const mockData = new Uint8Array([1, 2, 3])

      ;(global.fetch as jest.Mock).mockResolvedValue(createMockResponse(mockData))
      ;(fileUtils.calculateHash as jest.Mock).mockResolvedValue('abc123')
      ;(fileUtils.savePackage as jest.Mock).mockResolvedValue('/codepush/abc123/index.bundle')

      const events: string[] = []

      queue.on(QueueEvent.ITEM_ADDED, () => events.push('item-added'))
      queue.on(QueueEvent.DOWNLOAD_STARTED, () => events.push('download-started'))
      queue.on(QueueEvent.DOWNLOAD_COMPLETED, () => events.push('download-completed'))
      queue.on(QueueEvent.QUEUE_EMPTIED, () => events.push('queue-emptied'))
      queue.on(QueueEvent.STATUS_CHANGED, () => events.push('status-changed'))

      await pkg.download()

      expect(events).toContain('item-added')
      expect(events).toContain('download-started')
      expect(events).toContain('download-completed')
      expect(events).toContain('queue-emptied')
      expect(events).toContain('status-changed')
    })
  })

  describe('Scenario 6: Large file download (>50 MB)', () => {
    it('handles large files without memory issues', async () => {
      const pkg = new RemotePackageImpl({
        appVersion: '1.0.0',
        deploymentKey: 'test-key',
        description: 'Large package',
        failedInstall: false,
        isFirstRun: false,
        isMandatory: false,
        isPending: false,
        label: 'v1',
        packageHash: 'large123',
        packageSize: 60 * 1024 * 1024, // 60 MB
        downloadUrl: 'https://example.com/large.zip',
      })

      // For large files, we just create a buffer of the expected size
      const largeData = new Uint8Array(60 * 1024 * 1024)

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue(String(60 * 1024 * 1024)),
        },
        arrayBuffer: jest.fn().mockResolvedValue(largeData.buffer),
      })
      ;(fileUtils.calculateHash as jest.Mock).mockResolvedValue('large123')
      ;(fileUtils.savePackage as jest.Mock).mockResolvedValue('/codepush/large123/index.bundle')

      const localPackage = await pkg.download()

      expect(localPackage.packageHash).toBe('large123')
      expect(fileUtils.savePackage).toHaveBeenCalled()
    })
  })
})
