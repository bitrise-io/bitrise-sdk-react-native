/**
 * Singleton class to manage restart queueing
 * Prevents restarts during critical operations (payments, animations, etc.)
 *
 * @example
 * ```typescript
 * // Protect critical operation
 * RestartQueue.getInstance().disallowRestart()
 * await processPayment()
 * RestartQueue.getInstance().allowRestart() // executes queued restart if any
 * ```
 */
export class RestartQueue {
  private static instance: RestartQueue | null = null
  private restartAllowed = true
  private pendingRestart: (() => void) | null = null

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): RestartQueue {
    if (!this.instance) {
      this.instance = new RestartQueue()
    }
    return this.instance
  }

  /**
   * Check if restarts are currently allowed
   */
  isRestartAllowed(): boolean {
    return this.restartAllowed
  }

  /**
   * Allow queued restarts to proceed
   * If a restart was queued, it will execute immediately
   */
  allowRestart(): void {
    this.restartAllowed = true

    // Execute pending restart if one was queued
    if (this.pendingRestart) {
      const restart = this.pendingRestart
      this.pendingRestart = null
      restart()
    }
  }

  /**
   * Prevent restarts and queue them instead
   * Call this during critical operations (payments, transactions, animations)
   */
  disallowRestart(): void {
    this.restartAllowed = false
  }

  /**
   * Queue or execute a restart based on current state
   * @param restartFn - Function that performs the restart
   */
  queueRestart(restartFn: () => void): void {
    if (this.restartAllowed) {
      // Restart immediately
      restartFn()
    } else {
      // Queue for later (replace any existing queued restart)
      this.pendingRestart = restartFn
      console.log('[CodePush] Restart queued. Call allowRestart() to proceed.')
    }
  }

  /**
   * Clear any pending restart without executing it
   */
  clearQueue(): void {
    this.pendingRestart = null
  }
}
