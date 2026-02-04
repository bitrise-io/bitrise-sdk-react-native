import { UpdateError } from '../types/errors'

/**
 * Error thrown when download queue operations fail
 */
export class QueueError extends UpdateError {
  constructor(
    message: string,
    public readonly queueItemId?: string,
    public readonly packageHash?: string,
    details?: unknown
  ) {
    super(message, details)
    this.name = 'QueueError'
    Object.setPrototypeOf(this, QueueError.prototype)
  }
}

/**
 * Error thrown when queue is full
 */
export class QueueFullError extends QueueError {
  constructor(
    public readonly queueSize: number,
    public readonly maxQueueSize: number
  ) {
    super(
      `Queue is full (${queueSize}/${maxQueueSize}). Cannot enqueue more items.`,
      undefined,
      undefined,
      { queueSize, maxQueueSize }
    )
    this.name = 'QueueFullError'
    Object.setPrototypeOf(this, QueueFullError.prototype)
  }
}

/**
 * Error thrown when download times out
 */
export class DownloadTimeoutError extends QueueError {
  constructor(
    packageHash: string,
    public readonly timeoutMs: number,
    queueItemId?: string
  ) {
    super(
      `Download timed out after ${timeoutMs}ms`,
      queueItemId,
      packageHash,
      { timeoutMs }
    )
    this.name = 'DownloadTimeoutError'
    Object.setPrototypeOf(this, DownloadTimeoutError.prototype)
  }
}
