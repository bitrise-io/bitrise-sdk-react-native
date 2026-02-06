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
   * Bitrise workspace slug for CodePush server
   * The SDK will construct the server URL as: https://{workspaceSlug}.codepush.bitrise.io
   *
   * You can find your workspace slug in the Bitrise dashboard URL or
   * by following: https://docs.bitrise.io/en/release-management/codepush/configuring-your-app-for-codepush.html
   */
  workspaceSlug?: string

  /**
   * Optional: Custom CodePush server URL
   * If not provided, will be constructed from workspaceSlug
   * @deprecated Use workspaceSlug instead for automatic URL construction
   */
  serverUrl?: string
}
