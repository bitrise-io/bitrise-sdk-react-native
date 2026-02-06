/**
 * CodePush type definitions
 * Re-exports all types for backward compatibility
 */

// Re-export enums
export { InstallMode, SyncStatus, UpdateState, CheckFrequency } from './enums'

// Re-export package types
export type {
  Package,
  RemotePackage,
  LocalPackage,
  DownloadProgress,
  UpdateDialogOptions,
  RollbackRetryOptions,
  SyncOptions,
  Configuration,
  SyncStatusChangedCallback,
  DownloadProgressCallback,
  HandleBinaryVersionMismatchCallback,
} from './package'

/**
 * Legacy UpdateStatus enum for backward compatibility
 * @deprecated Use SyncStatus instead
 */
export enum UpdateStatus {
  UP_TO_DATE = 'UP_TO_DATE',
  UPDATE_INSTALLED = 'UPDATE_INSTALLED',
  UPDATE_IGNORED = 'UPDATE_IGNORED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  SYNC_IN_PROGRESS = 'SYNC_IN_PROGRESS',
  CHECKING_FOR_UPDATE = 'CHECKING_FOR_UPDATE',
  AWAITING_USER_ACTION = 'AWAITING_USER_ACTION',
  DOWNLOADING_PACKAGE = 'DOWNLOADING_PACKAGE',
  INSTALLING_UPDATE = 'INSTALLING_UPDATE',
}

/**
 * Legacy UpdateInfo interface for backward compatibility
 * @deprecated Use RemotePackage instead
 */
export interface UpdateInfo {
  label: string
  appVersion: string
  description?: string
  isMandatory: boolean
  packageSize: number
}
