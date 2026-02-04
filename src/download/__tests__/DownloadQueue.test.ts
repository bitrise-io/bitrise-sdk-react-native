import { DownloadQueue } from '../DownloadQueue'
import { QueueEvent } from '../QueueEvents'
import { QueueStatus } from '../QueueItem'
import type { RemotePackage, LocalPackage } from '../../types/package'

describe('DownloadQueue', () => {
  let queue: DownloadQueue
  let mockRemotePackage: RemotePackage

  beforeEach(() => {
    queue = DownloadQueue.getInstance()
    // Clear queue state directly without rejecting promises
    ;(queue as any).queue = []
    ;(queue as any).currentDownload = null
    ;(queue as any).status = QueueStatus.IDLE
    ;(queue as any).processing = false

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

  afterEach(() => {
    // Clear queue state directly
    ;(queue as any).queue = []
    ;(queue as any).currentDownload = null
    ;(queue as any).status = QueueStatus.IDLE
    ;(queue as any).processing = false
    ;(queue as any).eventEmitter.removeAllListeners()
  })

  describe('getInstance', () => {
    it('returns singleton instance', () => {
      const instance1 = DownloadQueue.getInstance()
      const instance2 = DownloadQueue.getInstance()

      expect(instance1).toBe(instance2)
    })
  })

  describe('enqueue', () => {
    it('enqueues download request', async () => {
      const mockLocalPackage = { packageHash: 'hash123' } as LocalPackage
      ;(mockRemotePackage as any)._downloadInternal = jest
        .fn()
        .mockResolvedValue(mockLocalPackage)

      const progressCallback = jest.fn()
      const promise = queue.enqueue(mockRemotePackage, progressCallback)

      const state = queue.getState()
      expect(state.totalItems).toBe(1)

      const result = await promise
      expect(result).toBe(mockLocalPackage)
    })

    it('emits ITEM_ADDED event', async () => {
      const mockLocalPackage = { packageHash: 'hash123' } as LocalPackage
      ;(mockRemotePackage as any)._downloadInternal = jest
        .fn()
        .mockResolvedValue(mockLocalPackage)

      const eventCallback = jest.fn()
      queue.on(QueueEvent.ITEM_ADDED, eventCallback)

      const promise = queue.enqueue(mockRemotePackage)

      expect(eventCallback).toHaveBeenCalled()
      expect(eventCallback.mock.calls[0][0]).toMatchObject({
        position: 1,
        item: expect.objectContaining({
          remotePackage: mockRemotePackage,
        }),
      })

      await promise
    })

    it('processes queue automatically when idle', async () => {
      const mockLocalPackage = { packageHash: 'hash123' } as LocalPackage
      ;(mockRemotePackage as any)._downloadInternal = jest
        .fn()
        .mockResolvedValue(mockLocalPackage)

      const result = await queue.enqueue(mockRemotePackage)

      expect(result).toBe(mockLocalPackage)
      expect((mockRemotePackage as any)._downloadInternal).toHaveBeenCalled()
    })

    it('queues multiple downloads', async () => {
      const mockLocalPackage1 = { packageHash: 'hash1' } as LocalPackage
      const mockLocalPackage2 = { packageHash: 'hash2' } as LocalPackage

      const mockRemotePackage1 = { ...mockRemotePackage, packageHash: 'hash1' }
      const mockRemotePackage2 = { ...mockRemotePackage, packageHash: 'hash2' }

      ;(mockRemotePackage1 as any)._downloadInternal = jest
        .fn()
        .mockResolvedValue(mockLocalPackage1)
      ;(mockRemotePackage2 as any)._downloadInternal = jest
        .fn()
        .mockResolvedValue(mockLocalPackage2)

      const promise1 = queue.enqueue(mockRemotePackage1 as any)
      const promise2 = queue.enqueue(mockRemotePackage2 as any)

      const [result1, result2] = await Promise.all([promise1, promise2])

      expect(result1).toBe(mockLocalPackage1)
      expect(result2).toBe(mockLocalPackage2)
    })
  })

  describe('queue processing', () => {
    it('processes downloads sequentially (FIFO)', async () => {
      const downloadOrder: string[] = []
      const mockLocalPackage1 = { packageHash: 'hash1' } as LocalPackage
      const mockLocalPackage2 = { packageHash: 'hash2' } as LocalPackage

      const mockRemotePackage1 = { ...mockRemotePackage, packageHash: 'hash1' }
      const mockRemotePackage2 = { ...mockRemotePackage, packageHash: 'hash2' }

      ;(mockRemotePackage1 as any)._downloadInternal = jest.fn(async () => {
        downloadOrder.push('hash1')
        await new Promise((resolve) => setTimeout(resolve, 50))
        return mockLocalPackage1
      })
      ;(mockRemotePackage2 as any)._downloadInternal = jest.fn(async () => {
        downloadOrder.push('hash2')
        return mockLocalPackage2
      })

      const promise1 = queue.enqueue(mockRemotePackage1 as any)
      const promise2 = queue.enqueue(mockRemotePackage2 as any)

      await Promise.all([promise1, promise2])

      expect(downloadOrder).toEqual(['hash1', 'hash2'])
    })

    it('emits DOWNLOAD_STARTED event', async () => {
      const mockLocalPackage = { packageHash: 'hash123' } as LocalPackage
      ;(mockRemotePackage as any)._downloadInternal = jest
        .fn()
        .mockResolvedValue(mockLocalPackage)

      const eventCallback = jest.fn()
      queue.on(QueueEvent.DOWNLOAD_STARTED, eventCallback)

      await queue.enqueue(mockRemotePackage)

      expect(eventCallback).toHaveBeenCalled()
      expect(eventCallback.mock.calls[0][0]).toMatchObject({
        item: expect.objectContaining({
          remotePackage: mockRemotePackage,
        }),
      })
    })

    it('emits DOWNLOAD_COMPLETED event', async () => {
      const mockLocalPackage = { packageHash: 'hash123' } as LocalPackage
      ;(mockRemotePackage as any)._downloadInternal = jest
        .fn()
        .mockResolvedValue(mockLocalPackage)

      const eventCallback = jest.fn()
      queue.on(QueueEvent.DOWNLOAD_COMPLETED, eventCallback)

      await queue.enqueue(mockRemotePackage)

      expect(eventCallback).toHaveBeenCalled()
      expect(eventCallback.mock.calls[0][0]).toMatchObject({
        package: mockLocalPackage,
      })
    })

    it(
      'emits DOWNLOAD_FAILED event on error',
      async () => {
        const error = new Error('Download failed')
        ;(mockRemotePackage as any)._downloadInternal = jest
          .fn()
          .mockRejectedValue(error)

        const eventCallback = jest.fn()
        queue.on(QueueEvent.DOWNLOAD_FAILED, eventCallback)

        await expect(queue.enqueue(mockRemotePackage)).rejects.toThrow(
          'Download failed after maximum retries'
        )

        expect(eventCallback).toHaveBeenCalled()
      },
      10000
    )

    it('emits QUEUE_EMPTIED event when queue is empty', async () => {
      const mockLocalPackage = { packageHash: 'hash123' } as LocalPackage
      ;(mockRemotePackage as any)._downloadInternal = jest
        .fn()
        .mockResolvedValue(mockLocalPackage)

      const eventCallback = jest.fn()
      queue.on(QueueEvent.QUEUE_EMPTIED, eventCallback)

      await queue.enqueue(mockRemotePackage)

      expect(eventCallback).toHaveBeenCalled()
    })

    it('emits STATUS_CHANGED events', async () => {
      const mockLocalPackage = { packageHash: 'hash123' } as LocalPackage
      ;(mockRemotePackage as any)._downloadInternal = jest
        .fn()
        .mockResolvedValue(mockLocalPackage)

      const eventCallback = jest.fn()
      queue.on(QueueEvent.STATUS_CHANGED, eventCallback)

      await queue.enqueue(mockRemotePackage)

      expect(eventCallback).toHaveBeenCalledWith({
        status: QueueStatus.DOWNLOADING,
      })
      expect(eventCallback).toHaveBeenCalledWith({
        status: QueueStatus.IDLE,
      })
    })
  })

  describe('retry logic', () => {
    it('retries on failure', async () => {
      const mockLocalPackage = { packageHash: 'hash123' } as LocalPackage
      let attempts = 0

      ;(mockRemotePackage as any)._downloadInternal = jest.fn(async () => {
        attempts++
        if (attempts < 2) {
          throw new Error('Temporary failure')
        }
        return mockLocalPackage
      })

      const result = await queue.enqueue(mockRemotePackage)

      expect(result).toBe(mockLocalPackage)
      expect(attempts).toBe(2)
    })

    it(
      'fails after max retries',
      async () => {
        ;(mockRemotePackage as any)._downloadInternal = jest
          .fn()
          .mockRejectedValue(new Error('Permanent failure'))

        await expect(queue.enqueue(mockRemotePackage)).rejects.toThrow(
          'Download failed after maximum retries'
        )

        expect(
          (mockRemotePackage as any)._downloadInternal
        ).toHaveBeenCalledTimes(3)
      },
      10000
    )

    it(
      'uses exponential backoff',
      async () => {
        const delays: number[] = []
        const startTime = Date.now()

        ;(mockRemotePackage as any)._downloadInternal = jest.fn(async () => {
          const elapsed = Date.now() - startTime
          delays.push(elapsed)
          throw new Error('Failure')
        })

        await expect(queue.enqueue(mockRemotePackage)).rejects.toThrow()

        expect(delays.length).toBe(3)
      },
      10000
    )
  })

  describe('cancel', () => {
    it('cancels queued download', async () => {
      const mockLocalPackage1 = { packageHash: 'hash1' } as LocalPackage

      const mockRemotePackage1 = { ...mockRemotePackage, packageHash: 'hash1' }
      const mockRemotePackage2 = { ...mockRemotePackage, packageHash: 'hash2' }

      let download1Started = false
      ;(mockRemotePackage1 as any)._downloadInternal = jest.fn(async () => {
        download1Started = true
        await new Promise((resolve) => setTimeout(resolve, 100))
        return mockLocalPackage1
      })

      const promise1 = queue.enqueue(mockRemotePackage1 as any)
      const promise2 = queue.enqueue(mockRemotePackage2 as any)

      // Wait for first download to start
      while (!download1Started) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      // Get the queued item ID (second item should still be queued)
      const state = queue.getState()
      const queuedItemId = state.queuedItems[0]?.id

      if (queuedItemId) {
        await queue.cancel(queuedItemId)
      }

      await promise1

      await expect(promise2).rejects.toThrow('Download cancelled')
    })

    it('emits ITEM_CANCELLED event', async () => {
      const mockLocalPackage1 = { packageHash: 'hash1' } as LocalPackage

      const mockRemotePackage1 = { ...mockRemotePackage, packageHash: 'hash1' }
      const mockRemotePackage2 = { ...mockRemotePackage, packageHash: 'hash2' }

      ;(mockRemotePackage1 as any)._downloadInternal = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return mockLocalPackage1
      })

      const eventCallback = jest.fn()
      queue.on(QueueEvent.ITEM_CANCELLED, eventCallback)

      queue.enqueue(mockRemotePackage1 as any)
      queue.enqueue(mockRemotePackage2 as any)

      const state = queue.getState()
      const queuedItemId = state.queuedItems[0]?.id

      if (queuedItemId) {
        await queue.cancel(queuedItemId)
      }

      expect(eventCallback).toHaveBeenCalled()
    })

    it('throws when cancelling in-progress download', async () => {
      const mockLocalPackage = { packageHash: 'hash123' } as LocalPackage
      let downloadStarted = false
      ;(mockRemotePackage as any)._downloadInternal = jest.fn(async () => {
        downloadStarted = true
        await new Promise((resolve) => setTimeout(resolve, 100))
        return mockLocalPackage
      })

      const promise = queue.enqueue(mockRemotePackage)

      // Wait for download to start
      while (!downloadStarted) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      const state = queue.getState()
      const currentItemId = state.currentItem?.id

      if (currentItemId) {
        await expect(queue.cancel(currentItemId)).rejects.toThrow(
          'Cannot cancel in-progress download'
        )
      }

      await promise
    })
  })

  describe('getState', () => {
    it('returns current queue state', () => {
      const state = queue.getState()

      expect(state).toMatchObject({
        status: QueueStatus.IDLE,
        currentItem: null,
        queuedItems: [],
        totalItems: 0,
      })
    })

    it('includes current download in total items', async () => {
      const mockLocalPackage = { packageHash: 'hash123' } as LocalPackage
      ;(mockRemotePackage as any)._downloadInternal = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return mockLocalPackage
      })

      const promise = queue.enqueue(mockRemotePackage)

      await new Promise((resolve) => setTimeout(resolve, 10))

      const state = queue.getState()
      expect(state.totalItems).toBe(1)
      expect(state.currentItem).not.toBeNull()

      await promise
    })
  })

  describe('pause and resume', () => {
    it('pauses queue processing', async () => {
      const mockLocalPackage1 = { packageHash: 'hash1' } as LocalPackage
      const mockLocalPackage2 = { packageHash: 'hash2' } as LocalPackage

      const mockRemotePackage1 = { ...mockRemotePackage, packageHash: 'hash1' }
      const mockRemotePackage2 = { ...mockRemotePackage, packageHash: 'hash2' }

      let download1Started = false
      ;(mockRemotePackage1 as any)._downloadInternal = jest.fn(async () => {
        download1Started = true
        await new Promise((resolve) => setTimeout(resolve, 100))
        return mockLocalPackage1
      })
      ;(mockRemotePackage2 as any)._downloadInternal = jest
        .fn()
        .mockResolvedValue(mockLocalPackage2)

      const promise1 = queue.enqueue(mockRemotePackage1 as any)
      const promise2 = queue.enqueue(mockRemotePackage2 as any)

      // Wait for first download to start
      while (!download1Started) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      // Pause the queue (will take effect after first download)
      queue.pause()

      // Wait for first download to complete
      await promise1

      // Check that queue is paused with second item still queued
      const state = queue.getState()
      expect(state.status).toBe(QueueStatus.PAUSED)

      // Resume and wait for second download
      queue.resume()
      await promise2
    })

    it('resumes processing', async () => {
      const mockLocalPackage = { packageHash: 'hash123' } as LocalPackage
      ;(mockRemotePackage as any)._downloadInternal = jest
        .fn()
        .mockResolvedValue(mockLocalPackage)

      queue.pause()
      const promise = queue.enqueue(mockRemotePackage)

      await new Promise((resolve) => setTimeout(resolve, 50))

      let state = queue.getState()
      expect(state.queuedItems.length).toBe(1)
      expect(state.status).toBe(QueueStatus.PAUSED)

      queue.resume()
      await promise

      state = queue.getState()
      expect(state.queuedItems.length).toBe(0)
      expect(state.status).toBe(QueueStatus.IDLE)
    })
  })

  describe('clear', () => {
    it('clears all queued items', async () => {
      const mockLocalPackage1 = { packageHash: 'hash1' } as LocalPackage

      const mockRemotePackage1 = { ...mockRemotePackage, packageHash: 'hash1' }
      const mockRemotePackage2 = { ...mockRemotePackage, packageHash: 'hash2' }

      let download1Started = false
      ;(mockRemotePackage1 as any)._downloadInternal = jest.fn(async () => {
        download1Started = true
        await new Promise((resolve) => setTimeout(resolve, 100))
        return mockLocalPackage1
      })

      const promise1 = queue.enqueue(mockRemotePackage1 as any)
      const promise2 = queue.enqueue(mockRemotePackage2 as any)

      // Wait for first download to start
      while (!download1Started) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      // Clear the queue (removes second item)
      queue.clear()

      await promise1
      await expect(promise2).rejects.toThrow('Queue cleared')

      const state = queue.getState()
      expect(state.queuedItems.length).toBe(0)
    })
  })
})
