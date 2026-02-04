/**
 * Status of an update
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
 * Information about an available update
 */
export interface UpdateInfo {
  /**
   * Unique label for this update
   */
  label: string

  /**
   * Version of the app bundle
   */
  appVersion: string

  /**
   * Description of the update
   */
  description?: string

  /**
   * Whether this is a mandatory update
   */
  isMandatory: boolean

  /**
   * Size of the update package in bytes
   */
  packageSize: number
}
