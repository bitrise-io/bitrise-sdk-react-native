import { PersistentStorage } from '../utils/storage'

/**
 * Storage key for persisted metrics queue
 */
const METRICS_QUEUE_KEY = '@bitrise/codepush/metricsQueue'

/**
 * CodePush deployment status values
 */
export enum DeploymentStatus {
  SUCCEEDED = 'DeploymentSucceeded',
  FAILED = 'DeploymentFailed',
}

/**
 * Metric event types reported to the Bitrise server
 */
export enum MetricEvent {
  UPDATE_CHECK = 'update_check',
  DOWNLOAD_START = 'download_start',
  DOWNLOAD_COMPLETE = 'download_complete',
  DOWNLOAD_FAILED = 'download_failed',
  INSTALL_START = 'install_start',
  INSTALL_COMPLETE = 'install_complete',
  INSTALL_FAILED = 'install_failed',
  ROLLBACK = 'rollback',
  APP_READY = 'app_ready',
}

/**
 * Endpoint type for routing metrics
 */
type EndpointType = 'deploy' | 'download'

/**
 * Metric payload sent to the server
 */
interface MetricPayload {
  event: MetricEvent
  endpointType: EndpointType
  clientId: string
  deploymentKey: string
  appVersion: string
  packageHash?: string
  label?: string
  timestamp: number
  status?: DeploymentStatus
  previousLabelOrAppVersion?: string
  previousDeploymentKey?: string
}

/**
 * Client for reporting usage metrics to Bitrise server
 *
 * Metrics are batched and sent periodically to minimize network overhead.
 * All metrics are privacy-conscious and contain no personally identifiable
 * information (PII).
 *
 * @example
 * ```typescript
 * // Initialize during SDK setup
 * MetricsClient.initialize(serverUrl, deploymentKey, clientId)
 *
 * // Report an event
 * MetricsClient.getInstance()?.reportEvent(MetricEvent.DOWNLOAD_START, {
 *   packageHash: 'abc123',
 *   label: 'v1.0.0'
 * })
 *
 * // Disable metrics
 * MetricsClient.getInstance()?.setEnabled(false)
 * ```
 */
export class MetricsClient {
  private static instance: MetricsClient | null = null
  private queue: MetricPayload[] = []
  private isEnabled: boolean = true
  private batchSize: number = 10
  private flushInterval: number = 60000 // 1 minute
  private flushIntervalId: NodeJS.Timeout | null = null
  private isFlushing: boolean = false

  /** Counter for persistence batching */
  private eventsSinceLastPersist: number = 0
  /** Interval for persisting queue (every N events) */
  private persistInterval: number = 5

  private constructor(
    private serverUrl: string,
    private deploymentKey: string,
    private clientId: string,
    private appVersion: string
  ) {
    // Start periodic flush
    this.startPeriodicFlush()
    // Recover any persisted events from previous session
    this.recoverQueue().catch(error => {
      console.warn('[CodePush] Failed to recover metrics queue:', error)
    })
  }

  /**
   * Initialize the metrics client
   *
   * This should be called once during SDK initialization.
   *
   * @param serverUrl - Bitrise server URL
   * @param deploymentKey - CodePush deployment key
   * @param clientId - Unique client identifier (no PII)
   * @param appVersion - App version string
   * @returns Initialized MetricsClient instance
   */
  static initialize(
    serverUrl: string,
    deploymentKey: string,
    clientId: string,
    appVersion: string
  ): MetricsClient {
    if (this.instance) {
      console.warn('[CodePush] MetricsClient already initialized')
      return this.instance
    }
    this.instance = new MetricsClient(serverUrl, deploymentKey, clientId, appVersion)
    return this.instance
  }

  /**
   * Get the singleton instance
   *
   * @returns MetricsClient instance or null if not initialized
   */
  static getInstance(): MetricsClient | null {
    return this.instance
  }

  /**
   * Reset the singleton instance
   * Used for testing
   */
  static resetInstance(): void {
    if (this.instance) {
      this.instance.stopPeriodicFlush()
      this.instance = null
    }
  }

  /**
   * Get the endpoint type for a given event
   */
  private getEndpointType(event: MetricEvent): EndpointType {
    switch (event) {
      case MetricEvent.DOWNLOAD_START:
      case MetricEvent.DOWNLOAD_COMPLETE:
      case MetricEvent.DOWNLOAD_FAILED:
        return 'download'
      default:
        // Deploy, install, app ready, rollback events go to deploy endpoint
        return 'deploy'
    }
  }

  /**
   * Get the deployment status for a given event
   */
  private getDeploymentStatus(event: MetricEvent): DeploymentStatus | undefined {
    switch (event) {
      case MetricEvent.INSTALL_COMPLETE:
      case MetricEvent.APP_READY:
        return DeploymentStatus.SUCCEEDED
      case MetricEvent.INSTALL_FAILED:
      case MetricEvent.ROLLBACK:
        return DeploymentStatus.FAILED
      default:
        return undefined
    }
  }

  /**
   * Report a metric event
   *
   * Events are queued and sent in batches to minimize network overhead.
   *
   * @param event - Type of event to report
   * @param data - Optional event data (packageHash, label, status info, metadata)
   */
  reportEvent(
    event: MetricEvent,
    data?: {
      packageHash?: string
      label?: string
      previousLabelOrAppVersion?: string
      previousDeploymentKey?: string
      metadata?: Record<string, unknown>
    }
  ): void {
    if (!this.isEnabled) {
      return
    }

    const endpointType = this.getEndpointType(event)
    const status = this.getDeploymentStatus(event)

    const payload: MetricPayload = {
      event,
      endpointType,
      clientId: this.clientId,
      deploymentKey: this.deploymentKey,
      appVersion: this.appVersion,
      packageHash: data?.packageHash,
      label: data?.label,
      timestamp: Date.now(),
      status,
      previousLabelOrAppVersion: data?.previousLabelOrAppVersion,
      previousDeploymentKey: data?.previousDeploymentKey,
    }

    this.queue.push(payload)
    this.eventsSinceLastPersist++

    // Persist queue periodically to survive app termination
    if (this.eventsSinceLastPersist >= this.persistInterval) {
      this.eventsSinceLastPersist = 0
      this.persistQueue().catch(() => {})
    }

    // Flush if queue is full
    if (this.queue.length >= this.batchSize) {
      this.flush()
    }
  }

  /**
   * Build request body for deploy status endpoint (snake_case)
   */
  private buildDeployRequestBody(payload: MetricPayload): Record<string, unknown> {
    const body: Record<string, unknown> = {
      app_version: payload.appVersion,
      deployment_key: payload.deploymentKey,
      client_unique_id: payload.clientId,
    }

    if (payload.label) {
      body.label = payload.label
    }

    if (payload.status) {
      body.status = payload.status
    }

    if (payload.previousLabelOrAppVersion) {
      body.previous_label_or_app_version = payload.previousLabelOrAppVersion
    }

    if (payload.previousDeploymentKey) {
      body.previous_deployment_key = payload.previousDeploymentKey
    }

    return body
  }

  /**
   * Build request body for download status endpoint (snake_case)
   */
  private buildDownloadRequestBody(payload: MetricPayload): Record<string, unknown> {
    return {
      client_unique_id: payload.clientId,
      deployment_key: payload.deploymentKey,
      label: payload.label || '',
    }
  }

  /**
   * Send a single metric to the appropriate endpoint
   */
  private async sendMetric(payload: MetricPayload): Promise<boolean> {
    const endpoint =
      payload.endpointType === 'download'
        ? `${this.serverUrl}/v0.1/public/codepush/report_status/download`
        : `${this.serverUrl}/v0.1/public/codepush/report_status/deploy`

    const body =
      payload.endpointType === 'download'
        ? this.buildDownloadRequestBody(payload)
        : this.buildDeployRequestBody(payload)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Flush queued metrics to server
   *
   * This is called automatically based on queue size and periodic timer.
   * Can also be called manually to force immediate flush.
   */
  async flush(): Promise<void> {
    if (this.queue.length === 0 || this.isFlushing) {
      return
    }

    const batch = this.queue.splice(0, this.batchSize)
    this.isFlushing = true

    const failedPayloads: MetricPayload[] = []

    try {
      // Send each metric to its appropriate endpoint
      for (const payload of batch) {
        const success = await this.sendMetric(payload)
        if (!success) {
          failedPayloads.push(payload)
        }
      }

      if (failedPayloads.length > 0) {
        console.warn(`[CodePush] ${failedPayloads.length} metrics failed to report`)
        // Re-queue failed payloads (up to limit)
        if (this.queue.length < 100) {
          this.queue.unshift(...failedPayloads)
        }
      }

      // Clear persisted queue if all succeeded
      if (failedPayloads.length === 0) {
        await this.clearPersistedQueue()
      }
    } catch (error) {
      console.warn('[CodePush] Metrics report error:', error)
      // Re-queue all on error
      if (this.queue.length < 100) {
        this.queue.unshift(...batch)
      }
    } finally {
      this.isFlushing = false
    }
  }

  /**
   * Enable or disable metrics reporting
   *
   * When disabled, events are not queued or sent.
   *
   * @param enabled - True to enable metrics, false to disable
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    if (!enabled) {
      // Clear queue when disabling
      this.queue = []
    }
  }

  /**
   * Check if metrics reporting is enabled
   *
   * @returns True if enabled, false otherwise
   */
  isMetricsEnabled(): boolean {
    return this.isEnabled
  }

  /**
   * Get current queue size
   * Used for testing and debugging
   *
   * @returns Number of queued events
   */
  getQueueSize(): number {
    return this.queue.length
  }

  /**
   * Start periodic flush timer
   */
  private startPeriodicFlush(): void {
    this.flushIntervalId = setInterval(() => {
      this.flush()
    }, this.flushInterval)
  }

  /**
   * Stop periodic flush timer
   */
  private stopPeriodicFlush(): void {
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId)
      this.flushIntervalId = null
    }
  }

  /**
   * Set batch size for flushing
   * Used for testing
   *
   * @param size - Number of events to batch before flushing
   */
  setBatchSize(size: number): void {
    this.batchSize = Math.max(1, Math.min(size, 100))
  }

  /**
   * Set flush interval
   * Used for testing
   *
   * @param intervalMs - Flush interval in milliseconds
   */
  setFlushInterval(intervalMs: number): void {
    this.flushInterval = Math.max(1000, intervalMs)
    // Restart timer with new interval
    this.stopPeriodicFlush()
    this.startPeriodicFlush()
  }

  /**
   * Recover queued metrics from persistent storage
   * Called during initialization to restore events from previous session
   */
  private async recoverQueue(): Promise<void> {
    try {
      const savedQueue = await PersistentStorage.getItem<MetricPayload[]>(METRICS_QUEUE_KEY, [])
      if (savedQueue && savedQueue.length > 0) {
        // Prepend recovered events to current queue
        this.queue.unshift(...savedQueue)
        // Clear persisted queue after recovery
        await PersistentStorage.removeItem(METRICS_QUEUE_KEY)
      }
    } catch (error) {
      console.warn('[CodePush] Failed to recover metrics queue:', error)
    }
  }

  /**
   * Persist queue to storage for recovery after app termination
   * Should be called before app goes to background or terminates
   */
  async persistQueue(): Promise<void> {
    if (this.queue.length === 0) {
      // Clear any existing persisted queue
      await PersistentStorage.removeItem(METRICS_QUEUE_KEY).catch(() => {})
      return
    }

    try {
      await PersistentStorage.setItem(METRICS_QUEUE_KEY, this.queue)
    } catch (error) {
      console.warn('[CodePush] Failed to persist metrics queue:', error)
    }
  }

  /**
   * Clear persisted queue from storage
   * Called after successful flush
   */
  private async clearPersistedQueue(): Promise<void> {
    try {
      await PersistentStorage.removeItem(METRICS_QUEUE_KEY)
    } catch {
      // Ignore errors when clearing
    }
  }
}
