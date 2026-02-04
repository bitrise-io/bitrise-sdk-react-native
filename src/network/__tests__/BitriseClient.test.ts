import { BitriseClient } from '../BitriseClient'
import { NetworkError } from '../../types/errors'

// Mock global fetch
global.fetch = jest.fn()

describe('BitriseClient', () => {
  const mockServerUrl = 'https://api.bitrise.io'
  const mockDeploymentKey = 'test-deployment-key'
  const mockAppVersion = '1.0.0'

  let client: BitriseClient

  beforeEach(() => {
    client = new BitriseClient(mockServerUrl, mockDeploymentKey, mockAppVersion)
    jest.clearAllMocks()
  })

  describe('checkForUpdate', () => {
    it('should return RemotePackage when update is available', async () => {
      const mockResponse = {
        updateInfo: {
          downloadUrl: 'https://example.com/package.zip',
          description: 'Test update',
          isAvailable: true,
          isMandatory: false,
          appVersion: '1.0.0',
          packageHash: 'abc123',
          label: 'v1',
          packageSize: 1024,
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
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.bitrise.io/release-management/v1/code-push/update_check',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      )
    })

    it('should return null when no update is available', async () => {
      const mockResponse = {
        updateInfo: {
          isAvailable: false,
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

    it('should return null when updateInfo is missing', async () => {
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
        updateInfo: {
          isAvailable: true,
          shouldRunBinaryVersion: true,
          appVersion: '2.0.0',
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

    it('should include current package hash in request', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ updateInfo: { isAvailable: false } }),
      })

      await client.checkForUpdate('existing-hash-123')

      const callArgs = (global.fetch as jest.Mock).mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)

      expect(requestBody.packageHash).toBe('existing-hash-123')
      expect(requestBody.appVersion).toBe('1.0.0')
      expect(requestBody.deploymentKey).toBe('test-deployment-key')
    })

    it('should retry on network failure', async () => {
      ;(global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network failure'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ updateInfo: { isAvailable: false } }),
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
    it('should remove trailing slash from server URL', () => {
      const clientWithSlash = new BitriseClient(
        'https://api.bitrise.io/',
        mockDeploymentKey,
        mockAppVersion
      )

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      })

      clientWithSlash.checkForUpdate()

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.bitrise.io/release-management/v1/code-push/update_check',
        expect.anything()
      )
    })
  })
})
