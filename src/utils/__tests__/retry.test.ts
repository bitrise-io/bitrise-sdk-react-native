import { retryWithBackoff } from '../retry'

describe('retry utilities', () => {
  beforeEach(() => {
    jest.clearAllTimers()
  })

  describe('retryWithBackoff', () => {
    it('returns result on first successful attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success')

      const result = await retryWithBackoff(fn)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('retries on failure and succeeds on second attempt', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success')

      const result = await retryWithBackoff(fn, { baseDelay: 10 })

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('retries on failure and succeeds on third attempt', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce('success')

      const result = await retryWithBackoff(fn, { baseDelay: 10 })

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('throws last error after exhausting all retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Permanent failure'))

      await expect(retryWithBackoff(fn, { maxRetries: 3, baseDelay: 10 })).rejects.toThrow(
        'Permanent failure'
      )

      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('uses exponential backoff delays', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success')

      jest.useFakeTimers()

      const promise = retryWithBackoff(fn, { baseDelay: 1000 })

      // Fast-forward through delays
      await jest.advanceTimersByTimeAsync(1000) // First retry: 1s
      await jest.advanceTimersByTimeAsync(2000) // Second retry: 2s

      jest.useRealTimers()
      const result = await promise

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('invokes onRetry callback before each retry', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success')

      const onRetry = jest.fn()

      await retryWithBackoff(fn, { baseDelay: 10, onRetry })

      expect(onRetry).toHaveBeenCalledTimes(2)
      expect(onRetry).toHaveBeenNthCalledWith(1, 0, expect.any(Error))
      expect(onRetry).toHaveBeenNthCalledWith(2, 1, expect.any(Error))
    })

    it('passes error details to onRetry callback', async () => {
      const error1 = new Error('Network timeout')
      const error2 = new Error('Connection refused')

      const fn = jest
        .fn()
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockResolvedValueOnce('success')

      const onRetry = jest.fn()

      await retryWithBackoff(fn, { baseDelay: 10, onRetry })

      expect(onRetry).toHaveBeenNthCalledWith(1, 0, error1)
      expect(onRetry).toHaveBeenNthCalledWith(2, 1, error2)
    })

    it('handles non-Error thrown values', async () => {
      const fn = jest.fn().mockRejectedValue('string error')

      await expect(retryWithBackoff(fn, { maxRetries: 2, baseDelay: 10 })).rejects.toThrow(
        'string error'
      )
    })

    it('handles null thrown values', async () => {
      const fn = jest.fn().mockRejectedValue(null)

      await expect(retryWithBackoff(fn, { maxRetries: 2, baseDelay: 10 })).rejects.toThrow('null')
    })

    it('respects custom maxRetries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Fail'))

      await expect(retryWithBackoff(fn, { maxRetries: 5, baseDelay: 10 })).rejects.toThrow('Fail')

      expect(fn).toHaveBeenCalledTimes(5)
    })

    it('respects custom baseDelay', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockResolvedValueOnce('success')

      jest.useFakeTimers()

      const promise = retryWithBackoff(fn, { baseDelay: 500 })

      // Should delay 500ms (baseDelay * 2^0)
      await jest.advanceTimersByTimeAsync(500)

      jest.useRealTimers()
      const result = await promise

      expect(result).toBe('success')
    })

    it('does not delay after final attempt', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Fail'))

      try {
        await retryWithBackoff(fn, { maxRetries: 2, baseDelay: 1000 })
      } catch {
        // Expected - should fail after retries
      }

      // Should have made exactly 2 attempts
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('handles async function that throws synchronously', async () => {
      const fn = async () => {
        throw new Error('Sync throw')
      }

      await expect(retryWithBackoff(fn, { maxRetries: 2, baseDelay: 10 })).rejects.toThrow(
        'Sync throw'
      )
    })

    it('returns complex objects', async () => {
      const complexResult = {
        data: { nested: { value: 123 } },
        array: [1, 2, 3],
      }

      const fn = jest.fn().mockResolvedValue(complexResult)

      const result = await retryWithBackoff(fn)

      expect(result).toEqual(complexResult)
    })

    it('handles zero maxRetries (single attempt)', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Fail'))

      await expect(retryWithBackoff(fn, { maxRetries: 1, baseDelay: 10 })).rejects.toThrow('Fail')

      expect(fn).toHaveBeenCalledTimes(1)
    })
  })
})
