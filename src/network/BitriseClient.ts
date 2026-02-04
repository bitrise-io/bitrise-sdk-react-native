import { NetworkError } from '../types/errors'
import type { RemotePackage } from '../types/package'
import { RemotePackageImpl } from '../codepush/RemotePackageImpl'

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

    const requestBody = {
      appVersion: this.appVersion,
      deploymentKey: this.deploymentKey,
      packageHash: currentPackageHash,
      isCompanion: false,
      label: null,
      clientUniqueId: this.getClientUniqueId(),
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
      throw new NetworkError(
        'Failed to check for update',
        { originalError: error instanceof Error ? error.message : String(error) }
      )
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

    throw new NetworkError(
      `Network request failed after ${maxRetries} attempts`,
      { originalError: lastError?.message }
    )
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Get or generate a client unique ID
   * Used for analytics (no PII)
   */
  private getClientUniqueId(): string {
    // TODO: Generate and persist a unique client ID
    // For now, return a placeholder
    return 'client-' + Date.now()
  }
}
