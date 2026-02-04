/**
 * Queue event types
 */
export enum QueueEvent {
  ITEM_ADDED = 'item-added',
  DOWNLOAD_STARTED = 'download-started',
  DOWNLOAD_PROGRESS = 'download-progress',
  DOWNLOAD_COMPLETED = 'download-completed',
  DOWNLOAD_FAILED = 'download-failed',
  ITEM_CANCELLED = 'item-cancelled',
  QUEUE_EMPTIED = 'queue-emptied',
  STATUS_CHANGED = 'status-changed',
}

/**
 * Event callback type
 */
export type QueueEventCallback = (data: any) => void

/**
 * Event emitter interface
 */
export interface EventEmitter {
  on(event: QueueEvent, callback: QueueEventCallback): void
  off(event: QueueEvent, callback: QueueEventCallback): void
  emit(event: QueueEvent, data?: any): void
}
