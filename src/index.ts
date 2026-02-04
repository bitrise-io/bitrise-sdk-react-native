/**
 * Bitrise SDK for React Native
 * @packageDocumentation
 */

export { BitriseSDK } from './core/BitriseSDK'
export { CodePush } from './codepush/CodePush'
export { codePush } from './codepush/decorator'
export type { CodePushOptions } from './codepush/decorator'
export { MetricsClient, MetricEvent } from './metrics/MetricsClient'

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
export { BitriseError, ConfigurationError, NetworkError, UpdateError } from './types/errors'
