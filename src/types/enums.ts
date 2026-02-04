/**
 * Install mode for CodePush updates
 * Values must match react-native-code-push exactly for backward compatibility
 */
export enum InstallMode {
  /**
   * Install update and restart app immediately
   */
  IMMEDIATE = 0,

  /**
   * Install update but don't restart until next app restart
   */
  ON_NEXT_RESTART = 1,

  /**
   * Install update and restart when app resumes from background
   */
  ON_NEXT_RESUME = 2,

  /**
   * Install update and restart when app is sent to background
   */
  ON_NEXT_SUSPEND = 3,
}

/**
 * Status codes returned by sync() method
 * Values must match react-native-code-push exactly for backward compatibility
 */
export enum SyncStatus {
  /**
   * No update available
   */
  UP_TO_DATE = 0,

  /**
   * Update was downloaded and installed
   */
  UPDATE_INSTALLED = 1,

  /**
   * Update was available but user chose to ignore it
   */
  UPDATE_IGNORED = 2,

  /**
   * Unknown error occurred during sync
   */
  UNKNOWN_ERROR = 3,

  /**
   * Sync is already in progress
   */
  SYNC_IN_PROGRESS = 4,

  /**
   * Checking for update from server
   */
  CHECKING_FOR_UPDATE = 5,

  /**
   * Waiting for user action (update dialog)
   */
  AWAITING_USER_ACTION = 6,

  /**
   * Downloading update package
   */
  DOWNLOADING_PACKAGE = 7,

  /**
   * Installing downloaded update
   */
  INSTALLING_UPDATE = 8,
}

/**
 * State of an update package
 */
export enum UpdateState {
  /**
   * Update is currently running
   */
  RUNNING = 0,

  /**
   * Update is pending (installed but not yet running)
   */
  PENDING = 1,

  /**
   * Latest update available
   */
  LATEST = 2,
}

/**
 * Frequency for checking updates (used by codePush decorator)
 */
export enum CheckFrequency {
  /**
   * Check for updates on app start only
   */
  ON_APP_START = 0,

  /**
   * Check for updates on app start and resume
   */
  ON_APP_RESUME = 1,

  /**
   * Never check automatically (manual only)
   */
  MANUAL = 2,
}
