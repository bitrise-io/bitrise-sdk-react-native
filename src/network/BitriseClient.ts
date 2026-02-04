import { NetworkError } from '../types/errors'
import type { RemotePackage } from '../types/package'
import { RemotePackageImpl } from '../codepush/RemotePackageImpl'
import { getErrorMessage } from '../utils/error'

/**
 * Response from Bitrise CodePush check for update endpoint
 */
interface CheckUpdateResponse {
  updateInfo?: {
    downloadUrl: string
    description: string
    isAvailable: boolean
    isMandatory: boolean
    appVersion: string
    packageHash: string
    label: string
    packageSize: number
    shouldRunBinaryVersion?: boolean
    updateAppVersion?: boolean
  }
}

/**
 * HTTP client for Bitrise CodePush API
 * Minimal wrapper around React Native's fetch API
 */
export class BitriseClient {
  private readonly serverUrl: string
  private readonly deploymentKey: string
  private readonly appVersion: string
  private clientId: string | null = null

  constructor(serverUrl: string, deploymentKey: string, appVersion: string) {
    this.serverUrl = serverUrl.replace(/\/$/, '') // Remove trailing slash
    this.deploymentKey = deploymentKey
    this.appVersion = appVersion
  }

  /**
   * Check for available updates
   * @param currentPackageHash - Hash of currently installed package (if any)
   * @returns RemotePackage if update available, null otherwise
   */
  async checkForUpdate(currentPackageHash?: string): Promise<RemotePackage | null> {
    const url = `${this.serverUrl}/release-management/v1/code-push/update_check`

    const clientUniqueId = await this.getClientUniqueId()

    const requestBody = {
      appVersion: this.appVersion,
      deploymentKey: this.deploymentKey,
      packageHash: currentPackageHash,
      isCompanion: false,
      label: null,
      clientUniqueId,
    }

    try {
      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        if (response.status === 404) {
          // No update available
          return null
        }
        const errorMessage = `HTTP ${response.status}: ${response.statusText}`
        throw new NetworkError(errorMessage, { status: response.status, url })
      }

      const data = (await response.json()) as CheckUpdateResponse

      // No update available
      if (!data.updateInfo || !data.updateInfo.isAvailable) {
        return null
      }

      const updateInfo = data.updateInfo

      // Check if binary version matches
      if (updateInfo.shouldRunBinaryVersion || updateInfo.updateAppVersion) {
        // Binary update required - CodePush cannot handle this
        return null
      }

      // Create RemotePackage instance
      return new RemotePackageImpl({
        appVersion: updateInfo.appVersion,
        deploymentKey: this.deploymentKey,
        description: updateInfo.description || '',
        failedInstall: false,
        isFirstRun: false,
        isMandatory: updateInfo.isMandatory,
        isPending: false,
        label: updateInfo.label,
        packageHash: updateInfo.packageHash,
        packageSize: updateInfo.packageSize,
        downloadUrl: updateInfo.downloadUrl,
      })
    } catch (error) {
      if (error instanceof NetworkError) {
        throw error
      }
      throw new NetworkError('Failed to check for update', {
        originalError: getErrorMessage(error),
      })
    }
  }

  /**
   * Fetch with retry logic for transient failures
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries = 3
  ): Promise<Response> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, options)
        return response
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Don't retry on last attempt
        if (attempt < maxRetries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt) * 1000
          await this.sleep(delay)
        }
      }
    }

    throw new NetworkError(`Network request failed after ${maxRetries} attempts`, {
      originalError: lastError?.message,
    })
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get or generate a client unique ID
   * Used for analytics (no PII)
   *
   * The client ID is generated once per app session using a UUID.
   * For persistent client IDs across app restarts, apps should use
   * AsyncStorage or a similar storage mechanism and pass the ID
   * via SDK configuration.
   *
   * Note: This generates a new ID per app session. For persistent
   * analytics across sessions, consider storing the ID in your app's
   * storage layer.
   */
  private async getClientUniqueId(): Promise<string> {
    // Return cached value if available
    if (this.clientId) {
      return this.clientId
    }

    // Generate new UUID for this session
    // Apps can override this by implementing persistent storage
    this.clientId = this.generateUUID()
    return this.clientId
  }

  /**
   * Generate a UUID v4
   * Simple implementation without external dependencies
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  /**
   * Set a custom client ID for analytics
   * Use this to provide a persistent client ID from your app's storage
   *
   * @param clientId - Unique client identifier (no PII)
   */
  setClientId(clientId: string): void {
    this.clientId = clientId
  }

  /**
   * Get the current client ID
   *
   * @returns Current client ID or null if not yet generated
   */
  getClientId(): string | null {
    return this.clientId
  }
}
