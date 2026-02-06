import { NetworkError } from '../types/errors'
import type { RemotePackage } from '../types/package'
import { RemotePackageImpl } from '../codepush/RemotePackageImpl'
import { getErrorMessage } from '../utils/error'

/**
 * Response from CodePush check for update endpoint (snake_case from server)
 */
interface CheckUpdateResponse {
  update_info?: {
    download_url: string
    description: string
    is_available: boolean
    is_mandatory: boolean
    target_binary_range: string
    package_hash: string
    label: string
    package_size: number
    should_run_binary_version?: boolean
    update_app_version?: boolean
  }
}

/**
 * Result of checking for updates
 * Includes information about binary version mismatches
 */
export interface CheckUpdateResult {
  /**
   * The remote package if an update is available, null otherwise
   */
  remotePackage: RemotePackage | null

  /**
   * Whether a binary (native app) update is required
   * When true, remotePackage contains the update info for display purposes
   */
  binaryVersionMismatch: boolean
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
    const result = await this.checkForUpdateWithMismatchInfo(currentPackageHash)
    // For backward compatibility, return null for binary mismatches
    if (result.binaryVersionMismatch) {
      return null
    }
    return result.remotePackage
  }

  /**
   * Check for available updates with binary version mismatch information
   * @param currentPackageHash - Hash of currently installed package (if any)
   * @param currentLabel - Label of currently installed package (if any)
   * @returns CheckUpdateResult with package and mismatch info
   * @internal Used by sync() to support mismatch callbacks
   */
  async checkForUpdateWithMismatchInfo(
    currentPackageHash?: string,
    currentLabel?: string
  ): Promise<CheckUpdateResult> {
    const clientUniqueId = await this.getClientUniqueId()

    // Build query parameters (snake_case as per CodePush API)
    const queryParams = new URLSearchParams()
    queryParams.set('deployment_key', this.deploymentKey)
    queryParams.set('app_version', this.appVersion)
    queryParams.set('client_unique_id', clientUniqueId)
    queryParams.set('is_companion', 'false')

    if (currentPackageHash) {
      queryParams.set('package_hash', currentPackageHash)
    }
    if (currentLabel) {
      queryParams.set('label', currentLabel)
    }

    const url = `${this.serverUrl}/v0.1/public/codepush/update_check?${queryParams.toString()}`

    try {
      const response = await this.fetchWithRetry(url, {
        method: 'GET',
      })

      if (!response.ok) {
        if (response.status === 404) {
          // No update available
          return { remotePackage: null, binaryVersionMismatch: false }
        }
        const errorMessage = `HTTP ${response.status}: ${response.statusText}`
        throw new NetworkError(errorMessage, { status: response.status, url })
      }

      const data = (await response.json()) as CheckUpdateResponse

      // No update available (snake_case fields from server)
      if (!data.update_info || !data.update_info.is_available) {
        return { remotePackage: null, binaryVersionMismatch: false }
      }

      const updateInfo = data.update_info

      // Create RemotePackage instance (map snake_case to camelCase)
      const remotePackage = new RemotePackageImpl({
        appVersion: updateInfo.target_binary_range,
        deploymentKey: this.deploymentKey,
        description: updateInfo.description || '',
        failedInstall: false,
        isFirstRun: false,
        isMandatory: updateInfo.is_mandatory,
        isPending: false,
        label: updateInfo.label,
        packageHash: updateInfo.package_hash,
        packageSize: updateInfo.package_size,
        downloadUrl: updateInfo.download_url,
      })

      // Check if binary version matches
      if (updateInfo.should_run_binary_version || updateInfo.update_app_version) {
        // Binary update required - return package with mismatch flag
        return { remotePackage, binaryVersionMismatch: true }
      }

      return { remotePackage, binaryVersionMismatch: false }
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
   * Uses crypto.getRandomValues() for cryptographically secure random values
   * Falls back to Math.random() if crypto API is unavailable
   */
  private generateUUID(): string {
    // Try to use crypto.getRandomValues() for secure random values
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const bytes = new Uint8Array(16)
      crypto.getRandomValues(bytes)

      // Set version (4) and variant (RFC 4122) bits
      bytes[6] = (bytes[6]! & 0x0f) | 0x40 // Version 4
      bytes[8] = (bytes[8]! & 0x3f) | 0x80 // Variant RFC 4122

      // Convert to hex string with dashes
      const hex = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    }

    // Fallback to Math.random() (less secure but functional)
    console.warn('[CodePush] crypto.getRandomValues() not available, using Math.random() fallback')
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
