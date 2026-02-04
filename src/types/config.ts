/**
 * Configuration options for the Bitrise SDK
 */
export interface BitriseConfig {
  /**
   * Bitrise API token for authentication
   */
  apiToken: string

  /**
   * Bitrise app slug identifier
   */
  appSlug: string

  /**
   * Optional: Custom API endpoint URL
   * @default 'https://api.bitrise.io/v0.1'
   */
  apiEndpoint?: string

  /**
   * CodePush deployment key for fetching updates
   * Base64-encoded string from deployment creation
   */
  deploymentKey?: string

  /**
   * Optional: Custom CodePush server URL
   * @default 'https://api.bitrise.io'
   */
  serverUrl?: string
}
