import { BitriseClient } from '../BitriseClient'
import { NetworkError } from '../../types/errors'

// Mock global fetch
global.fetch = jest.fn()

describe('BitriseClient', () => {
  const mockServerUrl = 'https://test-workspace.codepush.bitrise.io'
  const mockDeploymentKey = 'test-deployment-key'
  const mockAppVersion = '1.0.0'

  let client: BitriseClient

  beforeEach(() => {
    client = new BitriseClient(mockServerUrl, mockDeploymentKey, mockAppVersion)
    jest.clearAllMocks()
  })

  describe('checkForUpdate', () => {
    it('should return RemotePackage when update is available', async () => {
      // Response uses snake_case (from CodePush API)
      const mockResponse = {
        update_info: {
          download_url: 'https://example.com/package.zip',
          description: 'Test update',
          is_available: true,
          is_mandatory: false,
          target_binary_range: '1.0.0',
          package_hash: 'abc123',
          label: 'v1',
          package_size: 1024,
        },
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      })

      const result = await client.checkForUpdate()

      expect(result).not.toBeNull()
      expect(result?.label).toBe('v1')
      expect(result?.packageHash).toBe('abc123')
      expect(result?.isMandatory).toBe(false)
      expect(result?.downloadUrl).toBe('https://example.com/package.zip')

      // Verify GET request to correct endpoint
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string
      const calledOptions = (global.fetch as jest.Mock).mock.calls[0][1]

      expect(calledUrl).toContain('/v0.1/public/codepush/update_check?')
      expect(calledUrl).toContain('deployment_key=test-deployment-key')
      expect(calledUrl).toContain('app_version=1.0.0')
      expect(calledOptions.method).toBe('GET')
    })

    it('should return null when no update is available', async () => {
      const mockResponse = {
        update_info: {
          is_available: false,
        },
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      })

      const result = await client.checkForUpdate()

      expect(result).toBeNull()
    })

    it('should return null when update_info is missing', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      })

      const result = await client.checkForUpdate()

      expect(result).toBeNull()
    })

    it('should return null on 404 response', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      const result = await client.checkForUpdate()

      expect(result).toBeNull()
    })

    it('should throw NetworkError on non-404 HTTP error', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      const error = await client.checkForUpdate().catch(e => e)
      expect(error).toBeInstanceOf(NetworkError)
      expect(error.message).toContain('HTTP 500')
    })

    it('should return null when binary update is required', async () => {
      const mockResponse = {
        update_info: {
          is_available: true,
          should_run_binary_version: true,
          target_binary_range: '2.0.0',
        },
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      })

      const result = await client.checkForUpdate()

      expect(result).toBeNull()
    })

    it('should include current package hash in query parameters', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ update_info: { is_available: false } }),
      })

      await client.checkForUpdate('existing-hash-123')

      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string

      expect(calledUrl).toContain('package_hash=existing-hash-123')
      expect(calledUrl).toContain('app_version=1.0.0')
      expect(calledUrl).toContain('deployment_key=test-deployment-key')
    })

    it('should retry on network failure', async () => {
      ;(global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network failure'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ update_info: { is_available: false } }),
        })

      // Mock setTimeout to avoid actual delays in tests
      jest.useFakeTimers()

      const promise = client.checkForUpdate()

      // Fast-forward through retry delays
      await jest.runAllTimersAsync()

      const result = await promise

      expect(result).toBeNull()
      expect(global.fetch).toHaveBeenCalledTimes(2)

      jest.useRealTimers()
    })

    it('should throw after max retries', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network failure'))

      jest.useFakeTimers()

      const promise = client.checkForUpdate()
      jest.runAllTimersAsync()

      const error = await promise.catch(e => e)
      expect(error).toBeInstanceOf(NetworkError)
      expect(error.message).toContain('failed after 3 attempts')
      expect(global.fetch).toHaveBeenCalledTimes(3)

      jest.useRealTimers()
    })
  })

  describe('constructor', () => {
    it('should remove trailing slash from server URL', async () => {
      const clientWithSlash = new BitriseClient(
        'https://test-workspace.codepush.bitrise.io/',
        mockDeploymentKey,
        mockAppVersion
      )

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      })

      await clientWithSlash.checkForUpdate()

      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string
      expect(calledUrl).toContain(
        'https://test-workspace.codepush.bitrise.io/v0.1/public/codepush/update_check'
      )
    })
  })
})
