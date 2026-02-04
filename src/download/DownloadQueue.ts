import { SimpleEventEmitter } from './EventEmitter'
import type { QueueItem, QueueState, QueueStatus } from './QueueItem'
import { QueueStatus as Status } from './QueueItem'
import { QueueEvent } from './QueueEvents'
import type { RemotePackage, LocalPackage, DownloadProgress } from '../types/package'

/**
 * DownloadQueue manages sequential downloads
 * Enqueues concurrent download requests and processes them one at a time
 *
 * @example
 * ```typescript
 * const queue = DownloadQueue.getInstance()
 * const localPackage = await queue.enqueue(remotePackage, (progress) => {
 *   console.log(`Downloaded ${progress.receivedBytes} of ${progress.totalBytes}`)
 * })
 * ```
 */
export class DownloadQueue {
  private static instance: DownloadQueue | null = null
  private queue: QueueItem[] = []
  private currentDownload: QueueItem | null = null
  private status: QueueStatus = Status.IDLE
  private eventEmitter = new SimpleEventEmitter()
  private processing = false

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): DownloadQueue {
    if (!this.instance) {
      this.instance = new DownloadQueue()
    }
    return this.instance
  }

  /**
   * Enqueue a download request
   * Returns promise that resolves when download completes
   *
   * @param remotePackage Package to download
   * @param progressCallback Optional progress callback
   * @returns Promise that resolves to LocalPackage
   */
  async enqueue(
    remotePackage: RemotePackage,
    progressCallback?: (progress: DownloadProgress) => void
  ): Promise<LocalPackage> {
    return new Promise((resolve, reject) => {
      const item: QueueItem = {
        id: this.generateId(),
        remotePackage,
        progressCallback,
        promise: { resolve, reject },
        addedAt: Date.now(),
        attempts: 0,
      }

      this.queue.push(item)
      this.eventEmitter.emit(QueueEvent.ITEM_ADDED, {
        item,
        position: this.queue.length,
      })

      if (this.status === Status.IDLE && !this.processing) {
        this.processQueue()
      }
    })
  }

  /**
   * Process queue sequentially (FIFO)
   */
  private async processQueue(): Promise<void> {
    if (this.processing) {
      return
    }

    this.processing = true

    while (this.queue.length > 0 && this.status !== Status.PAUSED) {
      const item = this.queue.shift()
      if (!item) {
        break
      }

      this.currentDownload = item
      this.status = Status.DOWNLOADING
      this.eventEmitter.emit(QueueEvent.STATUS_CHANGED, { status: this.status })
      this.eventEmitter.emit(QueueEvent.DOWNLOAD_STARTED, { item })

      try {
        item.startedAt = Date.now()

        const localPackage = await this.downloadWithRetry(item)

        item.promise.resolve(localPackage)
        this.eventEmitter.emit(QueueEvent.DOWNLOAD_COMPLETED, {
          item,
          package: localPackage,
        })
      } catch (error) {
        item.promise.reject(error as Error)
        this.eventEmitter.emit(QueueEvent.DOWNLOAD_FAILED, {
          item,
          error,
        })
      } finally {
        this.currentDownload = null
      }
    }

    this.status = Status.IDLE
    this.processing = false
    this.eventEmitter.emit(QueueEvent.STATUS_CHANGED, { status: this.status })

    if (this.queue.length === 0) {
      this.eventEmitter.emit(QueueEvent.QUEUE_EMPTIED)
    }
  }

  /**
   * Download with retry logic
   */
  private async downloadWithRetry(item: QueueItem): Promise<LocalPackage> {
    const maxRetries = 3
    let lastError: Error | null = null

    while (item.attempts < maxRetries) {
      try {
        item.attempts++

        const localPackage = await (item.remotePackage as any)._downloadInternal(
          item.progressCallback
        )

        return localPackage
      } catch (error) {
        lastError = error as Error

        if (item.attempts < maxRetries) {
          const delayMs = Math.pow(2, item.attempts) * 1000
          await this.delay(delayMs)
        }
      }
    }

    throw lastError || new Error('Download failed after maximum retries')
  }

  /**
   * Cancel a queued download
   * Cannot cancel in-progress downloads
   *
   * @param itemId Queue item ID
   */
  async cancel(itemId: string): Promise<void> {
    const index = this.queue.findIndex((item) => item.id === itemId)

    if (index >= 0) {
      const items = this.queue.splice(index, 1)
      const item = items[0]
      if (item) {
        item.promise.reject(new Error('Download cancelled'))
        this.eventEmitter.emit(QueueEvent.ITEM_CANCELLED, { item })
      }
    } else if (this.currentDownload?.id === itemId) {
      throw new Error('Cannot cancel in-progress download')
    }
  }

  /**
   * Get current queue state
   */
  getState(): QueueState {
    return {
      status: this.status,
      currentItem: this.currentDownload,
      queuedItems: [...this.queue],
      totalItems: this.queue.length + (this.currentDownload ? 1 : 0),
    }
  }

  /**
   * Subscribe to queue events
   */
  on(event: QueueEvent, callback: (data: any) => void): void {
    this.eventEmitter.on(event, callback)
  }

  /**
   * Unsubscribe from queue events
   */
  off(event: QueueEvent, callback: (data: any) => void): void {
    this.eventEmitter.off(event, callback)
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    if (this.status !== Status.PAUSED) {
      this.status = Status.PAUSED
      this.eventEmitter.emit(QueueEvent.STATUS_CHANGED, { status: this.status })
    }
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    if (this.status === Status.PAUSED) {
      this.status = Status.IDLE
      this.eventEmitter.emit(QueueEvent.STATUS_CHANGED, { status: this.status })

      if (this.queue.length > 0 && !this.processing) {
        this.processQueue()
      }
    }
  }

  /**
   * Clear all queued items (does not affect current download)
   */
  clear(): void {
    const items = this.queue.splice(0)
    items.forEach((item) => {
      item.promise.reject(new Error('Queue cleared'))
      this.eventEmitter.emit(QueueEvent.ITEM_CANCELLED, { item })
    })
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
