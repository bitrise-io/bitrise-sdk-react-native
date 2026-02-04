import { SimpleEventEmitter } from './EventEmitter'
import type { QueueItem, QueueState, QueueStatus } from './QueueItem'
import { QueueStatus as Status } from './QueueItem'
import { QueueEvent } from './QueueEvents'
import type {
  RemotePackage,
  LocalPackage,
  DownloadProgress,
} from '../types/package'
import type { QueueConfig } from './QueueConfig'
import { mergeQueueConfig } from './QueueConfig'
import { QueueStatisticsTracker } from './QueueStatistics'
import type { QueueStatistics } from './QueueStatistics'

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
  private config: Required<QueueConfig>
  private statistics = new QueueStatisticsTracker()

  private constructor(config?: QueueConfig) {
    this.config = mergeQueueConfig(config)
  }

  /**
   * Get singleton instance
   * @param config Optional configuration (only applied on first call)
   */
  static getInstance(config?: QueueConfig): DownloadQueue {
    if (!this.instance) {
      this.instance = new DownloadQueue(config)
    }
    return this.instance
  }

  /**
   * Update queue configuration
   * @param config Partial configuration to merge with current config
   */
  updateConfig(config: QueueConfig): void {
    this.config = mergeQueueConfig({ ...this.config, ...config })
    if (this.config.debug) {
      console.log('[DownloadQueue] Configuration updated:', this.config)
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<QueueConfig> {
    return { ...this.config }
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
      this.statistics.updateMaxQueueSize(this.queue.length)
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
        const waitTime = item.startedAt - item.addedAt

        const localPackage = await this.downloadWithRetry(item)

        const downloadTime = Date.now() - item.startedAt
        this.statistics.recordSuccess(
          waitTime,
          downloadTime,
          item.remotePackage.packageSize
        )

        item.promise.resolve(localPackage)
        this.eventEmitter.emit(QueueEvent.DOWNLOAD_COMPLETED, {
          item,
          package: localPackage,
        })
      } catch (error) {
        const downloadTime = item.startedAt
          ? Date.now() - item.startedAt
          : 0
        const waitTime = item.startedAt
          ? item.startedAt - item.addedAt
          : Date.now() - item.addedAt

        this.statistics.recordFailure(waitTime, downloadTime)

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
    let lastError: Error | null = null

    while (item.attempts < this.config.maxRetries) {
      try {
        item.attempts++

        if (this.config.debug) {
          console.log(
            `[DownloadQueue] Attempt ${item.attempts}/${this.config.maxRetries} for ${item.remotePackage.packageHash}`
          )
        }

        const localPackage = await (item.remotePackage as any)._downloadInternal(
          item.progressCallback
        )

        if (this.config.debug) {
          console.log(
            `[DownloadQueue] Download successful: ${item.remotePackage.packageHash}`
          )
        }

        return localPackage
      } catch (error) {
        lastError = error as Error

        if (item.attempts < this.config.maxRetries) {
          const baseDelay = this.config.baseRetryDelay * Math.pow(2, item.attempts)
          const delayMs = Math.min(baseDelay, this.config.maxRetryDelay)

          if (this.config.debug) {
            console.log(
              `[DownloadQueue] Retry in ${delayMs}ms for ${item.remotePackage.packageHash}`
            )
          }

          await this.delay(delayMs)
        }
      }
    }

    if (this.config.debug) {
      console.log(
        `[DownloadQueue] Download failed after ${this.config.maxRetries} attempts: ${item.remotePackage.packageHash}`,
        lastError
      )
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
        const waitTime = Date.now() - item.addedAt
        this.statistics.recordCancellation(waitTime)

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
      const waitTime = Date.now() - item.addedAt
      this.statistics.recordCancellation(waitTime)

      item.promise.reject(new Error('Queue cleared'))
      this.eventEmitter.emit(QueueEvent.ITEM_CANCELLED, { item })
    })
  }

  /**
   * Get queue statistics
   */
  getStatistics(): QueueStatistics {
    return this.statistics.getStatistics(this.queue.length)
  }

  /**
   * Reset queue statistics
   */
  resetStatistics(): void {
    this.statistics.reset()
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
