import { getErrorMessage } from './error'

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number
  /** Base delay in milliseconds for exponential backoff (default: 1000) */
  baseDelay?: number
  /** Optional callback invoked before each retry */
  onRetry?: (attempt: number, error: Error) => void
  /** Enable jitter to add randomness to delay, preventing thundering herd (default: true) */
  jitter?: boolean
  /** Jitter factor as percentage of delay, e.g. 0.3 = ±30% (default: 0.3) */
  jitterFactor?: number
}

/**
 * Calculate delay with optional jitter
 * Jitter adds randomness to prevent thundering herd when multiple clients retry simultaneously
 *
 * @param baseDelay - Base delay in milliseconds
 * @param attempt - Current attempt number (0-indexed)
 * @param jitter - Whether to add jitter
 * @param jitterFactor - Jitter range as factor (0.3 = ±30%)
 * @returns Delay in milliseconds
 */
export function calculateDelayWithJitter(
  baseDelay: number,
  attempt: number,
  jitter: boolean,
  jitterFactor: number
): number {
  const exponentialDelay = Math.pow(2, attempt) * baseDelay

  if (!jitter) {
    return exponentialDelay
  }

  // Add random jitter: delay * (1 + random(-jitterFactor, +jitterFactor))
  const randomFactor = (Math.random() * 2 - 1) * jitterFactor
  return Math.max(0, exponentialDelay * (1 + randomFactor))
}

/**
 * Executes async function with exponential backoff retry
 * Useful for network operations that may fail temporarily
 *
 * Uses exponential backoff: 1s, 2s, 4s, 8s, etc.
 * Formula: delay = baseDelay * 2^attempt
 *
 * @param fn - Async function to execute with retry
 * @param options - Retry configuration
 * @returns Result of successful execution
 * @throws Last error after all retries exhausted
 *
 * @example
 * ```typescript
 * const data = await retryWithBackoff(
 *   () => fetch('https://api.example.com/data'),
 *   {
 *     maxRetries: 3,
 *     baseDelay: 1000,
 *     onRetry: (attempt, error) => {
 *       console.log(`Retry ${attempt + 1}: ${error.message}`)
 *     }
 *   }
 * )
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, onRetry, jitter = true, jitterFactor = 0.3 } = options
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(getErrorMessage(error))

      // Don't delay after the last attempt
      if (attempt < maxRetries - 1) {
        const delay = calculateDelayWithJitter(baseDelay, attempt, jitter, jitterFactor)
        if (onRetry) {
          onRetry(attempt, lastError)
        }
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error('Retry failed with unknown error')
}
