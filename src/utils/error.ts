/**
 * Error handling utilities
 * Provides consistent error message extraction across the SDK
 */

/**
 * Extracts error message from unknown error type
 * Handles Error instances and other types safely
 *
 * @param error - Unknown error value from catch block
 * @returns Human-readable error message
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation()
 * } catch (error) {
 *   console.error('Operation failed:', getErrorMessage(error))
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Creates a wrapped error with additional context
 * Useful for adding context to caught errors before re-throwing
 *
 * @param error - Original error
 * @param context - Contextual message to prepend
 * @returns New Error instance with combined message
 *
 * @example
 * ```typescript
 * try {
 *   await saveData()
 * } catch (error) {
 *   throw wrapError(error, 'Failed to save package')
 * }
 * ```
 */
export function wrapError(error: unknown, context: string): Error {
  const message = getErrorMessage(error)
  return new Error(`${context}: ${message}`)
}
