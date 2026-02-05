/**
 * Bitrise SDK for React Native
 * @packageDocumentation
 */

export { BitriseSDK } from './core/BitriseSDK'
export { CodePush } from './codepush/CodePush'
export { codePush } from './codepush/decorator'
export type { CodePushOptions } from './codepush/decorator'
export { MetricsClient, MetricEvent } from './metrics/MetricsClient'
export { DownloadQueue } from './download/DownloadQueue'
export type { QueueConfig } from './download/QueueConfig'
export { QueueEvent } from './download/QueueEvents'
export type { QueueStatistics } from './download/QueueStatistics'
export { QueueError, QueueFullError, DownloadTimeoutError } from './download/QueueError'

// Types
export type { BitriseConfig } from './types/config'
export type {
  UpdateInfo,
  Package,
  RemotePackage,
  LocalPackage,
  DownloadProgress,
  UpdateDialogOptions,
  RollbackRetryOptions,
  SyncOptions,
  Configuration,
} from './types/codepush'

// Enums
export {
  UpdateStatus,
  InstallMode,
  SyncStatus,
  UpdateState,
  CheckFrequency,
} from './types/codepush'

// Errors
export {
  BitriseError,
  ConfigurationError,
  NetworkError,
  UpdateError,
  FileSystemError,
  TimeoutError,
} from './types/errors'

// Utilities
export { setAppVersion } from './utils/platform'
export { ExpoConfig } from './utils/expo-config'
