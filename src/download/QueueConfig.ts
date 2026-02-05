/**
 * Configuration options for the download queue
 */
export interface QueueConfig {
  /**
   * Maximum number of retry attempts for failed downloads
   * @default 3
   */
  maxRetries?: number

  /**
   * Base delay in milliseconds for exponential backoff
   * Actual delay = baseRetryDelay * (2 ^ attempt)
   * @default 1000
   */
  baseRetryDelay?: number

  /**
   * Maximum delay in milliseconds for retry backoff
   * @default 30000 (30 seconds)
   */
  maxRetryDelay?: number

  /**
   * Enable debug logging for queue operations
   * @default false
   */
  debug?: boolean
}

/**
 * Default queue configuration
 */
export const DEFAULT_QUEUE_CONFIG: Required<QueueConfig> = {
  maxRetries: 3,
  baseRetryDelay: 1000,
  maxRetryDelay: 30000,
  debug: false,
}

/**
 * Merge user configuration with defaults
 */
export function mergeQueueConfig(userConfig?: QueueConfig): Required<QueueConfig> {
  return {
    ...DEFAULT_QUEUE_CONFIG,
    ...userConfig,
  }
}
