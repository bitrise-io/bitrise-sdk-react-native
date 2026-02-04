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
  const { maxRetries = 3, baseDelay = 1000, onRetry } = options
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(getErrorMessage(error))

      // Don't delay after the last attempt
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * baseDelay
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
