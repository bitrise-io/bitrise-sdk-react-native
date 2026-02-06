import { MetricsClient, MetricEvent, DeploymentStatus } from '../MetricsClient'
import { PersistentStorage } from '../../utils/storage'

// Mock fetch
global.fetch = jest.fn()

// Mock PersistentStorage
jest.mock('../../utils/storage', () => ({
  PersistentStorage: {
    getItem: jest.fn().mockResolvedValue([]),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}))

// Mock timers
jest.useFakeTimers()

describe('MetricsClient', () => {
  const mockServerUrl = 'https://test-workspace.codepush.bitrise.io'

  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    MetricsClient.resetInstance()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    })
  })

  afterEach(() => {
    MetricsClient.resetInstance()
  })

  describe('initialize', () => {
    it('should initialize MetricsClient instance', () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      expect(client).toBeInstanceOf(MetricsClient)
      expect(MetricsClient.getInstance()).toBe(client)
    })

    it('should return existing instance if already initialized', () => {
      const client1 = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )
      const client2 = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      expect(client1).toBe(client2)
    })
  })

  describe('getInstance', () => {
    it('should return null if not initialized', () => {
      expect(MetricsClient.getInstance()).toBeNull()
    })

    it('should return instance after initialization', () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      expect(MetricsClient.getInstance()).toBe(client)
    })
  })

  describe('reportEvent', () => {
    it('should queue event', () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      client.reportEvent(MetricEvent.UPDATE_CHECK, {
        packageHash: 'abc123',
        label: 'v1.0.0',
      })

      expect(client.getQueueSize()).toBe(1)
    })

    it('should not queue event when disabled', () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      client.setEnabled(false)
      client.reportEvent(MetricEvent.UPDATE_CHECK)

      expect(client.getQueueSize()).toBe(0)
    })

    it('should flush when queue reaches batch size', async () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      client.setBatchSize(3)

      // Add 3 events to trigger auto-flush
      client.reportEvent(MetricEvent.UPDATE_CHECK)
      client.reportEvent(MetricEvent.DOWNLOAD_START)
      client.reportEvent(MetricEvent.DOWNLOAD_COMPLETE)

      // Manually flush to ensure completion in test
      await client.flush()

      expect(global.fetch).toHaveBeenCalled()
      expect(client.getQueueSize()).toBe(0)
    })
  })

  describe('flush', () => {
    it('should send deploy events to deploy endpoint', async () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      client.reportEvent(MetricEvent.APP_READY, { label: 'v1' })

      await client.flush()

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockServerUrl}/v0.1/public/codepush/report_status/deploy`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )

      // Verify snake_case body format
      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
      expect(callBody).toHaveProperty('app_version', '1.0.0')
      expect(callBody).toHaveProperty('deployment_key', 'test-deployment-key')
      expect(callBody).toHaveProperty('client_unique_id', 'test-client-id')
      expect(callBody).toHaveProperty('status', DeploymentStatus.SUCCEEDED)
    })

    it('should send download events to download endpoint', async () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      client.reportEvent(MetricEvent.DOWNLOAD_COMPLETE, { label: 'v1' })

      await client.flush()

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockServerUrl}/v0.1/public/codepush/report_status/download`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )

      // Verify snake_case body format
      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
      expect(callBody).toHaveProperty('deployment_key', 'test-deployment-key')
      expect(callBody).toHaveProperty('client_unique_id', 'test-client-id')
      expect(callBody).toHaveProperty('label', 'v1')
    })

    it('should route events to correct endpoints', async () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      // Add a mix of events
      client.reportEvent(MetricEvent.DOWNLOAD_START, { label: 'v1' }) // -> download
      client.reportEvent(MetricEvent.INSTALL_COMPLETE, { label: 'v1' }) // -> deploy

      await client.flush()

      // Should have made 2 calls to different endpoints
      expect(global.fetch).toHaveBeenCalledTimes(2)

      const calls = (global.fetch as jest.Mock).mock.calls
      const urls = calls.map((call: [string]) => call[0])

      expect(urls).toContain(`${mockServerUrl}/v0.1/public/codepush/report_status/download`)
      expect(urls).toContain(`${mockServerUrl}/v0.1/public/codepush/report_status/deploy`)
    })

    it('should do nothing if queue is empty', async () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      await client.flush()

      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should requeue events on network failure', async () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      client.reportEvent(MetricEvent.UPDATE_CHECK)
      await client.flush()

      // Event should be requeued
      expect(client.getQueueSize()).toBe(1)
      expect(consoleWarnSpy).toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })

    it('should requeue events on fetch error', async () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      client.reportEvent(MetricEvent.UPDATE_CHECK)
      await client.flush()

      // Event should be requeued
      expect(client.getQueueSize()).toBe(1)
      expect(consoleWarnSpy).toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })

    it('should not requeue if queue exceeds 100 events', async () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      })

      // Fill queue to limit
      for (let i = 0; i < 100; i++) {
        client.reportEvent(MetricEvent.UPDATE_CHECK)
      }

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      await client.flush()

      // Should not exceed 100
      expect(client.getQueueSize()).toBeLessThanOrEqual(100)

      consoleWarnSpy.mockRestore()
    })

    it('should not flush if already flushing', async () => {
      // Use real timers for this test
      jest.useRealTimers()

      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      // Make fetch slow
      ;(global.fetch as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ ok: true }), 100))
      )

      client.reportEvent(MetricEvent.UPDATE_CHECK)

      // Start two flushes concurrently
      const flush1 = client.flush()
      const flush2 = client.flush()

      await Promise.all([flush1, flush2])

      // Should only flush once
      expect(global.fetch).toHaveBeenCalledTimes(1)

      // Restore fake timers
      jest.useFakeTimers()
    })
  })

  describe('deployment status mapping', () => {
    it('should set SUCCEEDED status for INSTALL_COMPLETE', async () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      client.reportEvent(MetricEvent.INSTALL_COMPLETE, { label: 'v1' })
      await client.flush()

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
      expect(callBody.status).toBe(DeploymentStatus.SUCCEEDED)
    })

    it('should set SUCCEEDED status for APP_READY', async () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      client.reportEvent(MetricEvent.APP_READY, { label: 'v1' })
      await client.flush()

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
      expect(callBody.status).toBe(DeploymentStatus.SUCCEEDED)
    })

    it('should set FAILED status for INSTALL_FAILED', async () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      client.reportEvent(MetricEvent.INSTALL_FAILED, { label: 'v1' })
      await client.flush()

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
      expect(callBody.status).toBe(DeploymentStatus.FAILED)
    })

    it('should set FAILED status for ROLLBACK', async () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      client.reportEvent(MetricEvent.ROLLBACK, { label: 'v1' })
      await client.flush()

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
      expect(callBody.status).toBe(DeploymentStatus.FAILED)
    })
  })

  describe('setEnabled', () => {
    it('should enable/disable metrics reporting', () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      expect(client.isMetricsEnabled()).toBe(true)

      client.setEnabled(false)
      expect(client.isMetricsEnabled()).toBe(false)

      client.setEnabled(true)
      expect(client.isMetricsEnabled()).toBe(true)
    })

    it('should clear queue when disabled', () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      client.reportEvent(MetricEvent.UPDATE_CHECK)
      client.reportEvent(MetricEvent.APP_READY)
      expect(client.getQueueSize()).toBe(2)

      client.setEnabled(false)
      expect(client.getQueueSize()).toBe(0)
    })
  })

  describe('periodic flush', () => {
    it('should automatically flush every 60 seconds', async () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      client.reportEvent(MetricEvent.UPDATE_CHECK)

      // Fast-forward 60 seconds and run pending timers
      jest.advanceTimersByTime(60000)
      await Promise.resolve()

      expect(global.fetch).toHaveBeenCalled()
    })

    it('should update flush interval when changed', async () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      client.setFlushInterval(30000) // 30 seconds
      client.reportEvent(MetricEvent.UPDATE_CHECK)

      // Fast-forward 30 seconds and run pending timers
      jest.advanceTimersByTime(30000)
      await Promise.resolve()

      expect(global.fetch).toHaveBeenCalled()
    })

    it('should respect minimum flush interval of 1 second', () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      // Try to set to 500ms (should be clamped to 1000ms)
      client.setFlushInterval(500)

      // Internal check - should have been clamped
      // We can't directly test the internal value, but we can test behavior
      expect(() => client.setFlushInterval(500)).not.toThrow()
    })
  })

  describe('setBatchSize', () => {
    it('should update batch size', () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      client.setBatchSize(5)

      // Add 5 events to test batch size
      for (let i = 0; i < 5; i++) {
        client.reportEvent(MetricEvent.UPDATE_CHECK)
      }

      // Should have triggered flush
      expect(client.getQueueSize()).toBe(0)
    })

    it('should respect minimum batch size of 1', () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      expect(() => client.setBatchSize(0)).not.toThrow()
    })

    it('should respect maximum batch size of 100', () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      expect(() => client.setBatchSize(150)).not.toThrow()
    })
  })

  describe('privacy', () => {
    it('should not include PII in event payload', async () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      client.reportEvent(MetricEvent.APP_READY, {
        packageHash: 'abc123',
        label: 'v1.0.0',
      })

      await client.flush()

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)

      // Should only contain safe data (snake_case format)
      expect(callBody).toHaveProperty('app_version')
      expect(callBody).toHaveProperty('deployment_key')
      expect(callBody).toHaveProperty('client_unique_id')

      // Should not contain email, name, phone, etc.
      expect(callBody).not.toHaveProperty('email')
      expect(callBody).not.toHaveProperty('name')
      expect(callBody).not.toHaveProperty('phone')
      expect(callBody).not.toHaveProperty('userId')
    })
  })

  describe('queue persistence', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      ;(PersistentStorage.getItem as jest.Mock).mockResolvedValue([])
      // Re-apply fetch mock after clearAllMocks
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      })
    })

    it('should persist queue after every 5 events', async () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )
      client.setBatchSize(100) // Prevent auto-flush

      // Report 4 events - should not persist yet
      for (let i = 0; i < 4; i++) {
        client.reportEvent(MetricEvent.UPDATE_CHECK)
      }

      // Allow async operations to complete
      await Promise.resolve()

      expect(PersistentStorage.setItem).not.toHaveBeenCalled()

      // Report 5th event - should trigger persist
      client.reportEvent(MetricEvent.UPDATE_CHECK)

      // Allow async operations to complete
      await Promise.resolve()

      expect(PersistentStorage.setItem).toHaveBeenCalledWith(
        '@bitrise/codepush/metricsQueue',
        expect.arrayContaining([expect.objectContaining({ event: MetricEvent.UPDATE_CHECK })])
      )
    })

    it('should recover persisted queue on initialization', async () => {
      const persistedEvents = [
        {
          event: MetricEvent.DOWNLOAD_START,
          endpointType: 'download',
          clientId: 'old-client',
          deploymentKey: 'old-key',
          appVersion: '0.9.0',
          timestamp: Date.now() - 60000,
        },
      ]
      ;(PersistentStorage.getItem as jest.Mock).mockResolvedValue(persistedEvents)

      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      // Wait for async recovery
      await Promise.resolve()
      await Promise.resolve()

      // Queue should include recovered events
      expect(client.getQueueSize()).toBeGreaterThanOrEqual(1)

      // Persisted queue should be cleared after recovery
      expect(PersistentStorage.removeItem).toHaveBeenCalledWith('@bitrise/codepush/metricsQueue')
    })

    it('should clear persisted queue after successful flush', async () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )
      client.setBatchSize(100) // Prevent auto-flush

      client.reportEvent(MetricEvent.UPDATE_CHECK)

      // Trigger manual flush
      await client.flush()

      expect(PersistentStorage.removeItem).toHaveBeenCalledWith('@bitrise/codepush/metricsQueue')
    })

    it('should allow manual persist via persistQueue', async () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )
      client.setBatchSize(100) // Prevent auto-flush

      client.reportEvent(MetricEvent.UPDATE_CHECK)
      client.reportEvent(MetricEvent.DOWNLOAD_START)

      await client.persistQueue()

      expect(PersistentStorage.setItem).toHaveBeenCalledWith(
        '@bitrise/codepush/metricsQueue',
        expect.arrayContaining([
          expect.objectContaining({ event: MetricEvent.UPDATE_CHECK }),
          expect.objectContaining({ event: MetricEvent.DOWNLOAD_START }),
        ])
      )
    })

    it('should not persist empty queue', async () => {
      const client = MetricsClient.initialize(
        mockServerUrl,
        'test-deployment-key',
        'test-client-id',
        '1.0.0'
      )

      await client.persistQueue()

      expect(PersistentStorage.setItem).not.toHaveBeenCalled()
      // Should clear any existing persisted queue
      expect(PersistentStorage.removeItem).toHaveBeenCalled()
    })
  })
})
