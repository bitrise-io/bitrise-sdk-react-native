/**
 * Base package information
 * Compatible with react-native-code-push Package interface
 */
export interface Package {
  /**
   * Version of the native app binary
   */
  appVersion: string

  /**
   * Deployment key used to fetch this package
   */
  deploymentKey: string

  /**
   * Human-readable description of the update
   */
  description: string

  /**
   * Whether this package failed to install previously
   */
  failedInstall: boolean

  /**
   * Whether this is the first run after installing this package
   */
  isFirstRun: boolean

  /**
   * Whether this update is mandatory (cannot be ignored)
   */
  isMandatory: boolean

  /**
   * Whether this package is pending installation (requires restart)
   */
  isPending: boolean

  /**
   * Unique label for this release (e.g., "v1")
   */
  label: string

  /**
   * SHA-256 hash of the package contents
   */
  packageHash: string

  /**
   * Size of the package in bytes
   */
  packageSize: number
}

/**
 * Download progress information
 */
export interface DownloadProgress {
  /**
   * Number of bytes received so far
   */
  receivedBytes: number

  /**
   * Total bytes to download
   */
  totalBytes: number
}

/**
 * Remote package that can be downloaded
 */
export interface RemotePackage extends Package {
  /**
   * Signed URL to download the package
   */
  downloadUrl: string

  /**
   * Download this package
   * @param progressCallback - Optional callback for download progress
   * @returns Promise resolving to LocalPackage after successful download
   */
  download(progressCallback?: (progress: DownloadProgress) => void): Promise<LocalPackage>
}

/**
 * Local package that has been downloaded and can be installed
 */
export interface LocalPackage extends Package {
  /**
   * Local file path to the downloaded package
   */
  localPath: string

  /**
   * Install this package
   * @param installMode - When to apply the update
   * @param minimumBackgroundDuration - Minimum time in background before applying (for ON_NEXT_RESUME/SUSPEND)
   * @returns Promise resolving when install is queued
   */
  install(installMode?: number, minimumBackgroundDuration?: number): Promise<void>
}

/**
 * Update dialog configuration
 */
export interface UpdateDialogOptions {
  /**
   * Title of the update dialog
   */
  title?: string

  /**
   * Message body of the update dialog
   */
  optionalUpdateMessage?: string

  /**
   * Message body for mandatory updates
   */
  mandatoryUpdateMessage?: string

  /**
   * Text for the install button
   */
  optionalInstallButtonLabel?: string

  /**
   * Text for the mandatory install button
   */
  mandatoryInstallButtonLabel?: string

  /**
   * Text for the ignore button (optional updates only)
   */
  optionalIgnoreButtonLabel?: string

  /**
   * Append release description to message
   */
  appendReleaseDescription?: boolean

  /**
   * Prefix for release description
   */
  descriptionPrefix?: string
}

/**
 * Rollback retry options
 */
export interface RollbackRetryOptions {
  /**
   * Whether to retry a previously failed update
   */
  delayInHours?: number

  /**
   * Maximum number of retry attempts
   */
  maxRetryAttempts?: number
}

/**
 * Options for sync() method
 */
export interface SyncOptions {
  /**
   * Deployment key (overrides configured key)
   */
  deploymentKey?: string

  /**
   * Install mode for optional updates
   */
  installMode?: number

  /**
   * Install mode for mandatory updates
   */
  mandatoryInstallMode?: number

  /**
   * Minimum time in background before applying update (milliseconds)
   */
  minimumBackgroundDuration?: number

  /**
   * Update dialog configuration (false to disable)
   */
  updateDialog?: UpdateDialogOptions | boolean

  /**
   * Rollback retry configuration
   */
  rollbackRetryOptions?: RollbackRetryOptions

  /**
   * Ignore updates that previously failed to install
   */
  ignoreFailedUpdates?: boolean

  /**
   * Maximum time in milliseconds for the entire sync operation
   * Default: 5 minutes (300000ms)
   * Set to 0 to disable timeout
   */
  syncTimeoutMs?: number
}

/**
 * Configuration information
 */
export interface Configuration {
  /**
   * Version of the native app binary
   */
  appVersion: string

  /**
   * Deployment key being used
   */
  deploymentKey: string

  /**
   * Server URL
   */
  serverUrl: string

  /**
   * Currently installed package hash (if any)
   */
  packageHash?: string
}
