/**
 * Statistics for download queue operations
 */
export interface QueueStatistics {
  /** Total number of downloads processed */
  totalDownloads: number

  /** Number of successful downloads */
  successfulDownloads: number

  /** Number of failed downloads */
  failedDownloads: number

  /** Number of cancelled downloads */
  cancelledDownloads: number

  /** Average wait time in queue (ms) */
  averageWaitTime: number

  /** Average download time (ms) */
  averageDownloadTime: number

  /** Total bytes downloaded */
  totalBytesDownloaded: number

  /** Current queue size */
  currentQueueSize: number

  /** Maximum queue size reached */
  maxQueueSize: number

  /** Success rate (0-1) */
  successRate: number
}

/**
 * Tracks queue statistics
 */
export class QueueStatisticsTracker {
  private totalDownloads = 0
  private successfulDownloads = 0
  private failedDownloads = 0
  private cancelledDownloads = 0
  private totalWaitTime = 0
  private totalDownloadTime = 0
  private totalBytesDownloaded = 0
  private maxQueueSize = 0

  /**
   * Record a successful download
   */
  recordSuccess(waitTimeMs: number, downloadTimeMs: number, bytesDownloaded: number): void {
    this.totalDownloads++
    this.successfulDownloads++
    this.totalWaitTime += waitTimeMs
    this.totalDownloadTime += downloadTimeMs
    this.totalBytesDownloaded += bytesDownloaded
  }

  /**
   * Record a failed download
   */
  recordFailure(waitTimeMs: number, downloadTimeMs: number): void {
    this.totalDownloads++
    this.failedDownloads++
    this.totalWaitTime += waitTimeMs
    this.totalDownloadTime += downloadTimeMs
  }

  /**
   * Record a cancelled download
   */
  recordCancellation(waitTimeMs: number): void {
    this.totalDownloads++
    this.cancelledDownloads++
    this.totalWaitTime += waitTimeMs
  }

  /**
   * Update max queue size
   */
  updateMaxQueueSize(currentSize: number): void {
    if (currentSize > this.maxQueueSize) {
      this.maxQueueSize = currentSize
    }
  }

  /**
   * Get current statistics
   */
  getStatistics(currentQueueSize: number): QueueStatistics {
    const successRate = this.totalDownloads > 0 ? this.successfulDownloads / this.totalDownloads : 0

    const averageWaitTime = this.totalDownloads > 0 ? this.totalWaitTime / this.totalDownloads : 0

    const averageDownloadTime =
      this.successfulDownloads + this.failedDownloads > 0
        ? this.totalDownloadTime / (this.successfulDownloads + this.failedDownloads)
        : 0

    return {
      totalDownloads: this.totalDownloads,
      successfulDownloads: this.successfulDownloads,
      failedDownloads: this.failedDownloads,
      cancelledDownloads: this.cancelledDownloads,
      averageWaitTime,
      averageDownloadTime,
      totalBytesDownloaded: this.totalBytesDownloaded,
      currentQueueSize,
      maxQueueSize: this.maxQueueSize,
      successRate,
    }
  }

  /**
   * Reset all statistics
   */
  reset(): void {
    this.totalDownloads = 0
    this.successfulDownloads = 0
    this.failedDownloads = 0
    this.cancelledDownloads = 0
    this.totalWaitTime = 0
    this.totalDownloadTime = 0
    this.totalBytesDownloaded = 0
    this.maxQueueSize = 0
  }
}
