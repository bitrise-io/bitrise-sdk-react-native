import { DownloadQueue } from '../DownloadQueue'
import type { RemotePackage, LocalPackage } from '../../types/package'

describe('Queue Statistics', () => {
  let mockRemotePackage: RemotePackage

  beforeEach(() => {
    // Reset singleton
    ;(DownloadQueue as any).instance = null

    mockRemotePackage = {
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
      downloadUrl: 'https://example.com/package.zip',
      download: jest.fn(),
    } as any
  })

  describe('getStatistics', () => {
    it('returns initial statistics with zero values', () => {
      const queue = DownloadQueue.getInstance()
      const stats = queue.getStatistics()

      expect(stats).toEqual({
        totalDownloads: 0,
        successfulDownloads: 0,
        failedDownloads: 0,
        cancelledDownloads: 0,
        averageWaitTime: 0,
        averageDownloadTime: 0,
        totalBytesDownloaded: 0,
        currentQueueSize: 0,
        maxQueueSize: 0,
        successRate: 0,
      })
    })

    it('tracks successful downloads', async () => {
      const queue = DownloadQueue.getInstance()

      ;(mockRemotePackage as any)._downloadInternal = jest
        .fn()
        .mockResolvedValue({ packageHash: 'hash123' } as LocalPackage)

      await queue.enqueue(mockRemotePackage)

      const stats = queue.getStatistics()

      expect(stats.totalDownloads).toBe(1)
      expect(stats.successfulDownloads).toBe(1)
      expect(stats.failedDownloads).toBe(0)
      expect(stats.successRate).toBe(1)
      expect(stats.totalBytesDownloaded).toBe(1024)
    })

    it(
      'tracks failed downloads',
      async () => {
        const queue = DownloadQueue.getInstance({ maxRetries: 1 })

        ;(mockRemotePackage as any)._downloadInternal = jest
          .fn()
          .mockRejectedValue(new Error('Network error'))

        await expect(queue.enqueue(mockRemotePackage)).rejects.toThrow()

        const stats = queue.getStatistics()

        expect(stats.totalDownloads).toBe(1)
        expect(stats.successfulDownloads).toBe(0)
        expect(stats.failedDownloads).toBe(1)
        expect(stats.successRate).toBe(0)
      },
      10000
    )

    it('tracks cancelled downloads', async () => {
      const queue = DownloadQueue.getInstance()

      let downloadStarted = false
      ;(mockRemotePackage as any)._downloadInternal = jest.fn(async () => {
        downloadStarted = true
        await new Promise((resolve) => setTimeout(resolve, 100))
        return { packageHash: 'hash123' } as LocalPackage
      })

      const pkg2 = { ...mockRemotePackage, packageHash: 'hash2' }
      ;(pkg2 as any)._downloadInternal = jest
        .fn()
        .mockResolvedValue({ packageHash: 'hash2' } as LocalPackage)

      const promise1 = queue.enqueue(mockRemotePackage)
      const promise2 = queue.enqueue(pkg2 as any)

      // Wait for first download to start
      while (!downloadStarted) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      // Cancel second download
      const state = queue.getState()
      const queuedItemId = state.queuedItems[0]?.id
      if (queuedItemId) {
        await queue.cancel(queuedItemId)
      }

      await promise1
      await expect(promise2).rejects.toThrow('Download cancelled')

      const stats = queue.getStatistics()

      expect(stats.totalDownloads).toBe(2)
      expect(stats.successfulDownloads).toBe(1)
      expect(stats.cancelledDownloads).toBe(1)
    })

    it('calculates success rate correctly', async () => {
      const queue = DownloadQueue.getInstance({ maxRetries: 1 })

      const pkg1 = { ...mockRemotePackage, packageHash: 'hash1' }
      const pkg2 = { ...mockRemotePackage, packageHash: 'hash2' }
      const pkg3 = { ...mockRemotePackage, packageHash: 'hash3' }

      ;(pkg1 as any)._downloadInternal = jest
        .fn()
        .mockResolvedValue({ packageHash: 'hash1' } as LocalPackage)
      ;(pkg2 as any)._downloadInternal = jest
        .fn()
        .mockRejectedValue(new Error('Failed'))
      ;(pkg3 as any)._downloadInternal = jest
        .fn()
        .mockResolvedValue({ packageHash: 'hash3' } as LocalPackage)

      await queue.enqueue(pkg1 as any)
      await expect(queue.enqueue(pkg2 as any)).rejects.toThrow()
      await queue.enqueue(pkg3 as any)

      const stats = queue.getStatistics()

      expect(stats.totalDownloads).toBe(3)
      expect(stats.successfulDownloads).toBe(2)
      expect(stats.failedDownloads).toBe(1)
      expect(stats.successRate).toBeCloseTo(0.667, 2)
    }, 10000)

    it('tracks max queue size', async () => {
      const queue = DownloadQueue.getInstance()

      let download1Started = false
      ;(mockRemotePackage as any)._downloadInternal = jest.fn(async () => {
        download1Started = true
        await new Promise((resolve) => setTimeout(resolve, 100))
        return { packageHash: 'hash123' } as LocalPackage
      })

      const pkg2 = { ...mockRemotePackage, packageHash: 'hash2' }
      const pkg3 = { ...mockRemotePackage, packageHash: 'hash3' }

      ;(pkg2 as any)._downloadInternal = jest
        .fn()
        .mockResolvedValue({ packageHash: 'hash2' } as LocalPackage)
      ;(pkg3 as any)._downloadInternal = jest
        .fn()
        .mockResolvedValue({ packageHash: 'hash3' } as LocalPackage)

      const promise1 = queue.enqueue(mockRemotePackage)
      const promise2 = queue.enqueue(pkg2 as any)
      const promise3 = queue.enqueue(pkg3 as any)

      // Wait for first download to start
      while (!download1Started) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      const stats1 = queue.getStatistics()
      expect(stats1.maxQueueSize).toBe(2) // 2 items queued while first was downloading

      await Promise.all([promise1, promise2, promise3])

      const stats2 = queue.getStatistics()
      expect(stats2.maxQueueSize).toBe(2)
      expect(stats2.currentQueueSize).toBe(0)
    })

    it('tracks average wait and download times', async () => {
      const queue = DownloadQueue.getInstance()

      ;(mockRemotePackage as any)._downloadInternal = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return { packageHash: 'hash123' } as LocalPackage
      })

      await queue.enqueue(mockRemotePackage)

      const stats = queue.getStatistics()

      // Wait time and download time should be >= 0
      expect(stats.averageWaitTime).toBeGreaterThanOrEqual(0)
      expect(stats.averageDownloadTime).toBeGreaterThan(40) // Should be at least 40ms
    })
  })

  describe('resetStatistics', () => {
    it('resets all statistics to zero', async () => {
      const queue = DownloadQueue.getInstance()

      ;(mockRemotePackage as any)._downloadInternal = jest
        .fn()
        .mockResolvedValue({ packageHash: 'hash123' } as LocalPackage)

      await queue.enqueue(mockRemotePackage)

      let stats = queue.getStatistics()
      expect(stats.totalDownloads).toBe(1)

      queue.resetStatistics()

      stats = queue.getStatistics()
      expect(stats).toEqual({
        totalDownloads: 0,
        successfulDownloads: 0,
        failedDownloads: 0,
        cancelledDownloads: 0,
        averageWaitTime: 0,
        averageDownloadTime: 0,
        totalBytesDownloaded: 0,
        currentQueueSize: 0,
        maxQueueSize: 0,
        successRate: 0,
      })
    })
  })
})
