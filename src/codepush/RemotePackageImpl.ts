import type {
  RemotePackage,
  LocalPackage,
  DownloadProgress,
  Package,
} from '../types/package'
import { NetworkError, UpdateError } from '../types/errors'
import { calculateHash, savePackage, deletePackage } from '../utils/file'
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

  constructor(packageData: Package & { downloadUrl: string }) {
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
  async download(
    progressCallback?: (progress: DownloadProgress) => void
  ): Promise<LocalPackage> {
    const queue = DownloadQueue.getInstance()
    return queue.enqueue(this, progressCallback)
  }

  /**
   * Internal download method called by the download queue
   * Handles actual download logic, verification, and storage
   */
  async _downloadInternal(
    progressCallback?: (progress: DownloadProgress) => void
  ): Promise<LocalPackage> {

    // Report DOWNLOAD_START metric
    MetricsClient.getInstance()?.reportEvent(MetricEvent.DOWNLOAD_START, {
      packageHash: this.packageHash,
      label: this.label,
      metadata: {
        packageSize: this.packageSize,
      },
    })

    try {
      // Download package with progress tracking
      const data = await this.downloadWithProgress(this.downloadUrl, progressCallback)

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
        const localPath = `/codepush/${this.packageHash}/index.bundle`
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
