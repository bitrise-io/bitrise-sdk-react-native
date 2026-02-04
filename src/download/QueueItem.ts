import type { RemotePackage, LocalPackage, DownloadProgress } from '../types/package'

/**
 * Queue status enum
 */
export enum QueueStatus {
  IDLE = 'idle',
  DOWNLOADING = 'downloading',
  PAUSED = 'paused',
}

/**
 * Item in the download queue
 */
export interface QueueItem {
  id: string
  remotePackage: RemotePackage
  progressCallback?: (progress: DownloadProgress) => void
  promise: {
    resolve: (pkg: LocalPackage) => void
    reject: (error: Error) => void
  }
  addedAt: number
  startedAt?: number
  attempts: number
}

/**
 * Current state of the download queue
 */
export interface QueueState {
  status: QueueStatus
  currentItem: QueueItem | null
  queuedItems: QueueItem[]
  totalItems: number
}
