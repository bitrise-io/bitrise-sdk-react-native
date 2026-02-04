import { DownloadQueue } from '../DownloadQueue'
import type { RemotePackage, LocalPackage } from '../../types/package'

describe('DownloadQueue Configuration', () => {
  let mockRemotePackage: RemotePackage

  beforeEach(() => {
    // Reset singleton for each test
    ;(DownloadQueue as any).instance = null

    mockRemotePackage = {
      appVersion: '1.0.0',
      deploymentKey: 'test-key',
      description: 'Test package',
      failedInstall: false,
      isFirstRun: false,
      isMandatory: false,
      isPending: false,
      label: 'v1',
      packageHash: 'hash123',
      packageSize: 1024,
      downloadUrl: 'https://example.com/package.zip',
      download: jest.fn(),
    } as any
  })

  describe('default configuration', () => {
    it('uses default values when no config provided', () => {
      const queue = DownloadQueue.getInstance()
      const config = queue.getConfig()

      expect(config).toEqual({
        maxRetries: 3,
        baseRetryDelay: 1000,
        maxRetryDelay: 30000,
        debug: false,
      })
    })
  })

  describe('custom configuration', () => {
    it('accepts custom configuration on first getInstance call', () => {
      const queue = DownloadQueue.getInstance({
        maxRetries: 5,
        baseRetryDelay: 2000,
        debug: true,
      })

      const config = queue.getConfig()

      expect(config).toEqual({
        maxRetries: 5,
        baseRetryDelay: 2000,
        maxRetryDelay: 30000, // default value
        debug: true,
      })
    })

    it('ignores config on subsequent getInstance calls', () => {
      const queue1 = DownloadQueue.getInstance({ maxRetries: 5 })
      const queue2 = DownloadQueue.getInstance({ maxRetries: 10 })

      expect(queue1).toBe(queue2)
      expect(queue1.getConfig().maxRetries).toBe(5)
    })
  })

  describe('updateConfig', () => {
    it('updates configuration after initialization', () => {
      const queue = DownloadQueue.getInstance()

      queue.updateConfig({ maxRetries: 7 })

      const config = queue.getConfig()
      expect(config.maxRetries).toBe(7)
      expect(config.baseRetryDelay).toBe(1000) // unchanged
    })

    it('merges partial configuration', () => {
      const queue = DownloadQueue.getInstance({
        maxRetries: 5,
        baseRetryDelay: 2000,
      })

      queue.updateConfig({ debug: true })

      const config = queue.getConfig()
      expect(config).toEqual({
        maxRetries: 5,
        baseRetryDelay: 2000,
        maxRetryDelay: 30000,
        debug: true,
      })
    })
  })

  describe('maxRetries configuration', () => {
    it(
      'respects custom maxRetries setting',
      async () => {
        const queue = DownloadQueue.getInstance({ maxRetries: 2 })

        ;(mockRemotePackage as any)._downloadInternal = jest
          .fn()
          .mockRejectedValue(new Error('Network error'))

        await expect(queue.enqueue(mockRemotePackage)).rejects.toThrow()

        expect((mockRemotePackage as any)._downloadInternal).toHaveBeenCalledTimes(
          2
        )
      },
      10000
    )
  })

  describe('retry delay configuration', () => {
    it(
      'uses custom base retry delay',
      async () => {
        const queue = DownloadQueue.getInstance({
          maxRetries: 2,
          baseRetryDelay: 100, // Fast retries for testing
        })

        let attempts = 0
        ;(mockRemotePackage as any)._downloadInternal = jest.fn(async () => {
          attempts++
          if (attempts < 2) {
            throw new Error('Temporary error')
          }
          return { packageHash: 'hash123' } as LocalPackage
        })

        const startTime = Date.now()
        await queue.enqueue(mockRemotePackage)
        const elapsed = Date.now() - startTime

        // Should have one retry with ~200ms delay (100ms * 2^1)
        expect(elapsed).toBeGreaterThan(150)
        expect(elapsed).toBeLessThan(500)
      },
      10000
    )

    it(
      'respects maxRetryDelay cap',
      async () => {
        const queue = DownloadQueue.getInstance({
          maxRetries: 10,
          baseRetryDelay: 1000,
          maxRetryDelay: 2000, // Cap at 2 seconds
        })

        let attempts = 0
        ;(mockRemotePackage as any)._downloadInternal = jest.fn(async () => {
          attempts++
          if (attempts < 5) {
            throw new Error('Temporary error')
          }
          return { packageHash: 'hash123' } as LocalPackage
        })

        const startTime = Date.now()
        await queue.enqueue(mockRemotePackage)
        const elapsed = Date.now() - startTime

        // With exponential backoff and max cap, should not take too long
        // 4 retries: 2s + 2s + 2s + 2s = 8s max
        expect(elapsed).toBeLessThan(10000)
      },
      15000
    )
  })

  describe('debug logging', () => {
    it('logs debug messages when debug is enabled', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      const queue = DownloadQueue.getInstance({ debug: true, maxRetries: 2 })

      ;(mockRemotePackage as any)._downloadInternal = jest
        .fn()
        .mockResolvedValue({ packageHash: 'hash123' } as LocalPackage)

      await queue.enqueue(mockRemotePackage)

      const debugLogs = consoleLogSpy.mock.calls.filter(
        (call) =>
          call[0]?.toString().includes('[DownloadQueue]') &&
          call[0]?.toString().includes('Attempt')
      )

      expect(debugLogs.length).toBeGreaterThan(0)

      consoleLogSpy.mockRestore()
    })

    it('does not log download attempts when debug is disabled', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      const queue = DownloadQueue.getInstance({ debug: false })

      ;(mockRemotePackage as any)._downloadInternal = jest
        .fn()
        .mockResolvedValue({ packageHash: 'hash123' } as LocalPackage)

      await queue.enqueue(mockRemotePackage)

      const debugLogs = consoleLogSpy.mock.calls.filter(
        (call) =>
          call[0]?.toString().includes('[DownloadQueue]') &&
          call[0]?.toString().includes('Attempt')
      )

      expect(debugLogs.length).toBe(0)

      consoleLogSpy.mockRestore()
    })
  })
})
