import type { EventEmitter, QueueEvent, QueueEventCallback } from './QueueEvents'

/**
 * Simple event emitter implementation
 * Zero dependencies
 */
export class SimpleEventEmitter implements EventEmitter {
  private events: Map<QueueEvent, Set<QueueEventCallback>> = new Map()

  /**
   * Subscribe to an event
   */
  on(event: QueueEvent, callback: QueueEventCallback): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set())
    }
    this.events.get(event)!.add(callback)
  }

  /**
   * Unsubscribe from an event
   */
  off(event: QueueEvent, callback: QueueEventCallback): void {
    const callbacks = this.events.get(event)
    if (callbacks) {
      callbacks.delete(callback)
      if (callbacks.size === 0) {
        this.events.delete(event)
      }
    }
  }

  /**
   * Emit an event with data
   */
  emit(event: QueueEvent, data?: any): void {
    const callbacks = this.events.get(event)
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data)
        } catch (error) {
          console.error('[CodePush] Event callback error:', error)
        }
      })
    }
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.events.clear()
  }

  /**
   * Get count of listeners for an event
   */
  listenerCount(event: QueueEvent): number {
    return this.events.get(event)?.size || 0
  }
}
