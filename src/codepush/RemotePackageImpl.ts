import type { RemotePackage, LocalPackage, DownloadProgress, Package } from '../types/package'
import { NetworkError, UpdateError } from '../types/errors'
import { calculateHash, savePackage, deletePackage, getCodePushDirectory } from '../utils/file'
import { LocalPackageImpl } from './LocalPackageImpl'
import { MetricsClient, MetricEvent } from '../metrics/MetricsClient'
import { getErrorMessage } from '../utils/error'
import { DownloadQueue } from '../download/DownloadQueue'

/**
 * Implementation of RemotePackage interface
 * Provides download functionality for CodePush packages
 */
export class RemotePackageImpl implements RemotePackage {
  appVersion: string
  deploymentKey: string
  description: string
  failedInstall: boolean
  isFirstRun: boolean
  isMandatory: boolean
  isPending: boolean
  label: string
  packageHash: string
  packageSize: number
  downloadUrl: string
  // Optional differential update fields (server-driven)
  diffUrl?: string
  diffSize?: number

  constructor(packageData: Package & { downloadUrl: string; diffUrl?: string; diffSize?: number }) {
    this.appVersion = packageData.appVersion
    this.deploymentKey = packageData.deploymentKey
    this.description = packageData.description
    this.failedInstall = packageData.failedInstall
    this.isFirstRun = packageData.isFirstRun
    this.isMandatory = packageData.isMandatory
    this.isPending = packageData.isPending
    this.label = packageData.label
    this.packageHash = packageData.packageHash
    this.packageSize = packageData.packageSize
    this.downloadUrl = packageData.downloadUrl
    this.diffUrl = packageData.diffUrl
    this.diffSize = packageData.diffSize
  }

  /**
   * Download this package from Bitrise R2 storage
   * Automatically queues concurrent requests for sequential processing
   *
   * @param progressCallback - Optional callback for download progress
   * @returns Promise resolving to LocalPackage after successful download
   *
   * @example
   * ```typescript
   * const update = await codePush.checkForUpdate()
   * if (update) {
   *   const localPackage = await update.download((progress) => {
   *     const percentage = (progress.receivedBytes / progress.totalBytes) * 100
   *     console.log(`Downloaded ${percentage.toFixed(0)}%`)
   *   })
   *   await localPackage.install()
   * }
   * ```
   */
  async download(progressCallback?: (progress: DownloadProgress) => void): Promise<LocalPackage> {
    const queue = DownloadQueue.getInstance()
    return queue.enqueue(this, progressCallback)
  }

  /**
   * Internal download method called by the download queue
   * Handles actual download logic, verification, and storage
   * Supports differential updates when server provides diffUrl
   */
  async _downloadInternal(
    progressCallback?: (progress: DownloadProgress) => void
  ): Promise<LocalPackage> {
    // Report DOWNLOAD_START metric
    const isDifferential = !!(this.diffUrl && this.diffSize)
    MetricsClient.getInstance()?.reportEvent(MetricEvent.DOWNLOAD_START, {
      packageHash: this.packageHash,
      label: this.label,
      metadata: {
        packageSize: this.packageSize,
        isDifferential,
        diffSize: this.diffSize,
      },
    })

    try {
      let data: Uint8Array

      // Try differential download if available
      if (this.diffUrl && this.diffSize) {
        try {
          data = await this.downloadDifferential(progressCallback)
        } catch (diffError) {
          // Log and fall back to full download
          console.warn(
            '[CodePush] Differential download failed, falling back to full download:',
            getErrorMessage(diffError)
          )
          data = await this.downloadWithProgress(this.downloadUrl, progressCallback)
        }
      } else {
        // Full package download
        data = await this.downloadWithProgress(this.downloadUrl, progressCallback)
      }

      // Verify hash
      const isValid = await this.verifyHash(data, this.packageHash)
      if (!isValid) {
        throw new UpdateError('Hash verification failed. Package may be corrupted.', {
          packageHash: this.packageHash,
          expectedHash: this.packageHash,
        })
      }

      // Save package to storage
      const localPath = await savePackage(this.packageHash, data)

      // Create and return LocalPackage
      const localPackage = new LocalPackageImpl({
        appVersion: this.appVersion,
        deploymentKey: this.deploymentKey,
        description: this.description,
        failedInstall: false,
        isFirstRun: false,
        isMandatory: this.isMandatory,
        isPending: false,
        label: this.label,
        packageHash: this.packageHash,
        packageSize: this.packageSize,
        localPath,
      })

      // Report DOWNLOAD_COMPLETE metric
      MetricsClient.getInstance()?.reportEvent(MetricEvent.DOWNLOAD_COMPLETE, {
        packageHash: this.packageHash,
        label: this.label,
        metadata: {
          packageSize: this.packageSize,
        },
      })

      return localPackage
    } catch (error) {
      // Report DOWNLOAD_FAILED metric
      MetricsClient.getInstance()?.reportEvent(MetricEvent.DOWNLOAD_FAILED, {
        packageHash: this.packageHash,
        label: this.label,
        metadata: {
          error: getErrorMessage(error),
        },
      })
      // Clean up on error (attempt to delete partial data)
      try {
        const localPath = `${getCodePushDirectory()}/${this.packageHash}/index.bundle`
        await deletePackage(localPath)
      } catch {
        // Ignore cleanup errors
      }

      // Re-throw original error
      if (error instanceof UpdateError || error instanceof NetworkError) {
        throw error
      }
      throw new UpdateError('Failed to download package', {
        packageHash: this.packageHash,
        error: getErrorMessage(error),
      })
    }
  }

  /**
   * Download data with progress tracking and retry logic
   */
  private async downloadWithProgress(
    url: string,
    progressCallback?: (progress: DownloadProgress) => void
  ): Promise<Uint8Array> {
    const maxRetries = 3
    const timeout = 60000 // 60 seconds per attempt

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await this.attemptDownload(url, timeout, progressCallback)
        return result
      } catch (error) {
        // Don't retry UpdateError (hash verification, etc.) - these are permanent failures
        if (error instanceof UpdateError) {
          throw error
        }

        const isLastAttempt = attempt === maxRetries - 1

        if (isLastAttempt) {
          if (error instanceof NetworkError) {
            throw error
          }
          throw new NetworkError(`Download failed after ${maxRetries} attempts`, {
            url,
            error: getErrorMessage(error),
          })
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // Should never reach here, but TypeScript needs it
    throw new NetworkError('Download failed', { url })
  }

  /**
   * Attempt a single download with timeout
   */
  private async attemptDownload(
    url: string,
    timeout: number,
    progressCallback?: (progress: DownloadProgress) => void
  ): Promise<Uint8Array> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, { signal: controller.signal })

      if (!response.ok) {
        throw new NetworkError(`HTTP ${response.status}: ${response.statusText}`, {
          status: response.status,
          url,
        })
      }

      // Get total size from Content-Length header
      const contentLength = response.headers.get('Content-Length')
      const totalBytes = contentLength ? parseInt(contentLength, 10) : this.packageSize

      // Read response stream
      const reader = response.body?.getReader()
      if (!reader) {
        throw new NetworkError('Response body is not readable', { url })
      }

      const chunks = await this.readStreamChunks(reader, totalBytes, progressCallback)
      return this.concatenateChunks(chunks)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Read all chunks from a stream with progress tracking
   */
  private async readStreamChunks(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    totalBytes: number,
    progressCallback?: (progress: DownloadProgress) => void
  ): Promise<Uint8Array[]> {
    const chunks: Uint8Array[] = []
    let receivedBytes = 0

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      if (value) {
        chunks.push(value)
        receivedBytes += value.length
        this.reportProgress(receivedBytes, totalBytes, progressCallback)
      }
    }

    return chunks
  }

  /**
   * Safely invoke progress callback without interrupting download
   */
  private reportProgress(
    receivedBytes: number,
    totalBytes: number,
    progressCallback?: (progress: DownloadProgress) => void
  ): void {
    if (!progressCallback) {
      return
    }

    try {
      progressCallback({ receivedBytes, totalBytes })
    } catch (error) {
      // Don't let callback errors interrupt download
      console.warn('[CodePush] Progress callback error:', getErrorMessage(error))
    }
  }

  /**
   * Combine multiple Uint8Array chunks into a single array
   */
  private concatenateChunks(chunks: Uint8Array[]): Uint8Array {
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
    const result = new Uint8Array(totalLength)
    let position = 0

    for (const chunk of chunks) {
      result.set(chunk, position)
      position += chunk.length
    }

    return result
  }

  /**
   * Download differential/delta package from server
   * The diff file is expected to be a complete package (server applies the diff)
   * This method downloads the smaller diff and verifies the result hash
   *
   * @throws Error if diff download fails (caller should fall back to full download)
   */
  private async downloadDifferential(
    progressCallback?: (progress: DownloadProgress) => void
  ): Promise<Uint8Array> {
    if (!this.diffUrl || !this.diffSize) {
      throw new UpdateError('Differential download not available', {
        packageHash: this.packageHash,
      })
    }

    // Download the diff package (server has already applied the patch)
    // Use diffSize for accurate progress reporting
    const diffProgressCallback = progressCallback
      ? (progress: DownloadProgress) => {
          // Report progress based on diff size
          progressCallback({
            receivedBytes: progress.receivedBytes,
            totalBytes: this.diffSize!,
          })
        }
      : undefined

    const data = await this.downloadWithProgress(this.diffUrl, diffProgressCallback)

    // Verify the resulting package hash matches expected
    // This ensures the diff was applied correctly by the server
    const isValid = await this.verifyHash(data, this.packageHash)
    if (!isValid) {
      throw new UpdateError('Differential package hash verification failed', {
        packageHash: this.packageHash,
      })
    }

    return data
  }

  /**
   * Verify package hash matches expected value
   */
  private async verifyHash(data: Uint8Array, expectedHash: string): Promise<boolean> {
    const actualHash = await calculateHash(data)

    // If hash calculation failed (returned "unverified"), skip verification
    if (actualHash === 'unverified') {
      return true
    }

    return actualHash === expectedHash
  }
}
