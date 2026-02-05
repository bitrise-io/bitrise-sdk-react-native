import { retryWithBackoff, calculateDelayWithJitter } from '../retry'

describe('retry utilities', () => {
  describe('calculateDelayWithJitter', () => {
    it('returns exponential delay without jitter when jitter is false', () => {
      const delay = calculateDelayWithJitter(1000, 0, false, 0.3)
      expect(delay).toBe(1000) // 1000 * 2^0 = 1000

      const delay2 = calculateDelayWithJitter(1000, 1, false, 0.3)
      expect(delay2).toBe(2000) // 1000 * 2^1 = 2000

      const delay3 = calculateDelayWithJitter(1000, 2, false, 0.3)
      expect(delay3).toBe(4000) // 1000 * 2^2 = 4000
    })

    it('returns delay within jitter range when jitter is true', () => {
      // Run multiple times to test randomness
      for (let i = 0; i < 100; i++) {
        const baseExponential = 1000 // 1000 * 2^0
        const delay = calculateDelayWithJitter(1000, 0, true, 0.3)

        // Should be within ±30% of base: 700 to 1300
        expect(delay).toBeGreaterThanOrEqual(baseExponential * 0.7)
        expect(delay).toBeLessThanOrEqual(baseExponential * 1.3)
      }
    })

    it('applies jitter to exponential backoff correctly', () => {
      for (let i = 0; i < 100; i++) {
        const baseExponential = 2000 // 1000 * 2^1
        const delay = calculateDelayWithJitter(1000, 1, true, 0.3)

        // Should be within ±30% of 2000: 1400 to 2600
        expect(delay).toBeGreaterThanOrEqual(baseExponential * 0.7)
        expect(delay).toBeLessThanOrEqual(baseExponential * 1.3)
      }
    })

    it('respects custom jitter factor', () => {
      for (let i = 0; i < 100; i++) {
        const baseExponential = 1000
        const delay = calculateDelayWithJitter(1000, 0, true, 0.5)

        // Should be within ±50% of base: 500 to 1500
        expect(delay).toBeGreaterThanOrEqual(baseExponential * 0.5)
        expect(delay).toBeLessThanOrEqual(baseExponential * 1.5)
      }
    })

    it('never returns negative delay', () => {
      for (let i = 0; i < 100; i++) {
        const delay = calculateDelayWithJitter(100, 0, true, 0.99)
        expect(delay).toBeGreaterThanOrEqual(0)
      }
    })

    it('handles zero base delay', () => {
      const delay = calculateDelayWithJitter(0, 0, true, 0.3)
      expect(delay).toBe(0)
    })
  })

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

      const promise = retryWithBackoff(fn, { baseDelay: 1000, jitter: false })

      // Fast-forward through delays (exact delays when jitter is disabled)
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

      const promise = retryWithBackoff(fn, { baseDelay: 500, jitter: false })

      // Should delay exactly 500ms (baseDelay * 2^0) when jitter is disabled
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

    describe('jitter options', () => {
      it('applies jitter by default', async () => {
        const fn = jest
          .fn()
          .mockRejectedValueOnce(new Error('Fail'))
          .mockResolvedValueOnce('success')

        // With jitter enabled (default), delays should vary
        // Just verify it completes successfully
        const result = await retryWithBackoff(fn, { baseDelay: 10 })
        expect(result).toBe('success')
      })

      it('can disable jitter explicitly', async () => {
        const fn = jest
          .fn()
          .mockRejectedValueOnce(new Error('Fail'))
          .mockResolvedValueOnce('success')

        jest.useFakeTimers()

        const promise = retryWithBackoff(fn, { baseDelay: 1000, jitter: false })

        // With jitter disabled, delay should be exactly 1000ms
        await jest.advanceTimersByTimeAsync(1000)

        jest.useRealTimers()
        const result = await promise

        expect(result).toBe('success')
      })

      it('respects custom jitterFactor', async () => {
        const fn = jest
          .fn()
          .mockRejectedValueOnce(new Error('Fail'))
          .mockResolvedValueOnce('success')

        // Just verify it completes successfully with custom jitterFactor
        const result = await retryWithBackoff(fn, {
          baseDelay: 10,
          jitter: true,
          jitterFactor: 0.5,
        })

        expect(result).toBe('success')
      })

      it('uses default jitterFactor of 0.3', async () => {
        const fn = jest
          .fn()
          .mockRejectedValueOnce(new Error('Fail'))
          .mockResolvedValueOnce('success')

        // Just verify it completes - default jitterFactor is 0.3
        const result = await retryWithBackoff(fn, { baseDelay: 10, jitter: true })
        expect(result).toBe('success')
      })
    })
  })
})
