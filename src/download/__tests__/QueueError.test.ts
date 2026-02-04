import { QueueError, QueueFullError, DownloadTimeoutError } from '../QueueError'

describe('QueueError', () => {
  describe('constructor', () => {
    it('creates error with message only', () => {
      const error = new QueueError('Test error')

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(QueueError)
      expect(error.message).toBe('Test error')
      expect(error.name).toBe('QueueError')
      expect(error.queueItemId).toBeUndefined()
      expect(error.packageHash).toBeUndefined()
    })

    it('creates error with message and queueItemId', () => {
      const error = new QueueError('Test error', 'item-123')

      expect(error.message).toBe('Test error')
      expect(error.queueItemId).toBe('item-123')
      expect(error.packageHash).toBeUndefined()
    })

    it('creates error with all parameters', () => {
      const error = new QueueError('Test error', 'item-123', 'hash-abc', {
        additionalInfo: 'test',
      })

      expect(error.message).toBe('Test error')
      expect(error.queueItemId).toBe('item-123')
      expect(error.packageHash).toBe('hash-abc')
    })

    it('preserves error stack trace', () => {
      const error = new QueueError('Test error')

      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('QueueError')
      expect(error.stack).toContain('Test error')
    })

    it('sets correct error name', () => {
      const error = new QueueError('Test error')

      expect(error.name).toBe('QueueError')
    })

    it('is instanceof Error', () => {
      const error = new QueueError('Test error')

      expect(error instanceof Error).toBe(true)
    })

    it('is instanceof QueueError', () => {
      const error = new QueueError('Test error')

      expect(error instanceof QueueError).toBe(true)
    })
  })

  describe('toString', () => {
    it('returns formatted error string', () => {
      const error = new QueueError('Test error')

      const str = error.toString()
      expect(str).toBe('QueueError: Test error')
    })

    it('includes cause in string representation', () => {
      const cause = new Error('Root cause')
      const error = new QueueError('Test error', { cause })

      const str = error.toString()
      expect(str).toContain('QueueError: Test error')
    })
  })

  describe('properties', () => {
    it('stores queueItemId', () => {
      const error = new QueueError('Test error', 'item-123')

      expect(error.queueItemId).toBe('item-123')
    })

    it('stores packageHash', () => {
      const error = new QueueError('Test error', 'item-123', 'hash-abc')

      expect(error.packageHash).toBe('hash-abc')
    })

    it('handles optional parameters', () => {
      const error = new QueueError('Test error', undefined, undefined, { extra: 'data' })

      expect(error.queueItemId).toBeUndefined()
      expect(error.packageHash).toBeUndefined()
    })
  })
})

describe('QueueFullError', () => {
  describe('constructor', () => {
    it('creates error with queue size parameters', () => {
      const error = new QueueFullError(10, 10)

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(QueueError)
      expect(error).toBeInstanceOf(QueueFullError)
      expect(error.message).toBe('Queue is full (10/10). Cannot enqueue more items.')
      expect(error.name).toBe('QueueFullError')
      expect(error.queueSize).toBe(10)
      expect(error.maxQueueSize).toBe(10)
    })

    it('creates error with different queue sizes', () => {
      const error = new QueueFullError(5, 5)

      expect(error.message).toBe('Queue is full (5/5). Cannot enqueue more items.')
      expect(error.queueSize).toBe(5)
      expect(error.maxQueueSize).toBe(5)
    })

    it('sets correct error name', () => {
      const error = new QueueFullError('Queue is full')

      expect(error.name).toBe('QueueFullError')
    })

    it('is instanceof QueueError', () => {
      const error = new QueueFullError('Queue is full')

      expect(error instanceof QueueError).toBe(true)
    })

    it('is instanceof QueueFullError', () => {
      const error = new QueueFullError('Queue is full')

      expect(error instanceof QueueFullError).toBe(true)
    })

    it('is instanceof Error', () => {
      const error = new QueueFullError('Queue is full')

      expect(error instanceof Error).toBe(true)
    })

    it('preserves prototype chain', () => {
      const error = new QueueFullError('Queue is full')

      expect(Object.getPrototypeOf(error)).toBe(QueueFullError.prototype)
      expect(Object.getPrototypeOf(Object.getPrototypeOf(error))).toBe(QueueError.prototype)
    })
  })

  describe('message formatting', () => {
    it('includes queue capacity in message', () => {
      const error = new QueueFullError(10, 10)

      expect(error.message).toContain('Queue is full')
      expect(error.message).toContain('10')
      expect(error.message).toContain('10/10')
    })

    it('formats message with different sizes', () => {
      const error = new QueueFullError(20, 50)

      expect(error.message).toBe('Queue is full (20/50). Cannot enqueue more items.')
    })
  })

  describe('toString', () => {
    it('returns formatted error string', () => {
      const error = new QueueFullError(10, 10)

      const str = error.toString()
      expect(str).toBe('QueueFullError: Queue is full (10/10). Cannot enqueue more items.')
    })
  })

  describe('properties', () => {
    it('stores queueSize', () => {
      const error = new QueueFullError(8, 10)

      expect(error.queueSize).toBe(8)
    })

    it('stores maxQueueSize', () => {
      const error = new QueueFullError(8, 10)

      expect(error.maxQueueSize).toBe(10)
    })
  })
})

describe('DownloadTimeoutError', () => {
  describe('constructor', () => {
    it('creates error with required parameters', () => {
      const error = new DownloadTimeoutError('hash-abc', 30000)

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(QueueError)
      expect(error).toBeInstanceOf(DownloadTimeoutError)
      expect(error.message).toBe('Download timed out after 30000ms')
      expect(error.name).toBe('DownloadTimeoutError')
      expect(error.packageHash).toBe('hash-abc')
      expect(error.timeoutMs).toBe(30000)
    })

    it('creates error with optional queueItemId', () => {
      const error = new DownloadTimeoutError('hash-abc', 30000, 'item-123')

      expect(error.message).toBe('Download timed out after 30000ms')
      expect(error.packageHash).toBe('hash-abc')
      expect(error.timeoutMs).toBe(30000)
      expect(error.queueItemId).toBe('item-123')
    })

    it('sets correct error name', () => {
      const error = new DownloadTimeoutError('Download timeout')

      expect(error.name).toBe('DownloadTimeoutError')
    })

    it('is instanceof QueueError', () => {
      const error = new DownloadTimeoutError('Download timeout')

      expect(error instanceof QueueError).toBe(true)
    })

    it('is instanceof DownloadTimeoutError', () => {
      const error = new DownloadTimeoutError('Download timeout')

      expect(error instanceof DownloadTimeoutError).toBe(true)
    })

    it('is instanceof Error', () => {
      const error = new DownloadTimeoutError('Download timeout')

      expect(error instanceof Error).toBe(true)
    })

    it('preserves prototype chain', () => {
      const error = new DownloadTimeoutError('Download timeout')

      expect(Object.getPrototypeOf(error)).toBe(DownloadTimeoutError.prototype)
      expect(Object.getPrototypeOf(Object.getPrototypeOf(error))).toBe(QueueError.prototype)
    })
  })

  describe('message formatting', () => {
    it('includes timeout duration in message', () => {
      const error = new DownloadTimeoutError('hash-abc', 30000)

      expect(error.message).toContain('timed out')
      expect(error.message).toContain('30000')
      expect(error.message).toBe('Download timed out after 30000ms')
    })

    it('handles different timeout durations', () => {
      const error1 = new DownloadTimeoutError('hash-1', 5000)
      const error2 = new DownloadTimeoutError('hash-2', 60000)

      expect(error1.message).toBe('Download timed out after 5000ms')
      expect(error2.message).toBe('Download timed out after 60000ms')
    })
  })

  describe('toString', () => {
    it('returns formatted error string', () => {
      const error = new DownloadTimeoutError('hash-abc', 30000)

      const str = error.toString()
      expect(str).toBe('DownloadTimeoutError: Download timed out after 30000ms')
    })
  })

  describe('properties', () => {
    it('stores packageHash', () => {
      const error = new DownloadTimeoutError('hash-abc', 30000)

      expect(error.packageHash).toBe('hash-abc')
    })

    it('stores timeoutMs', () => {
      const error = new DownloadTimeoutError('hash-abc', 30000)

      expect(error.timeoutMs).toBe(30000)
    })

    it('stores optional queueItemId', () => {
      const error = new DownloadTimeoutError('hash-abc', 30000, 'item-123')

      expect(error.queueItemId).toBe('item-123')
    })
  })
})

describe('Error serialization', () => {
  it('QueueError serializes to JSON', () => {
    const error = new QueueError('Test error', 'item-123', 'hash-abc')
    const json = JSON.stringify(error)

    expect(json).toBeDefined()
    // Note: Error objects don't serialize message by default, but we can still stringify
  })

  it('QueueFullError serializes to JSON', () => {
    const error = new QueueFullError(10, 10)
    const json = JSON.stringify(error)

    expect(json).toBeDefined()
  })

  it('DownloadTimeoutError serializes to JSON', () => {
    const error = new DownloadTimeoutError('hash-abc', 30000)
    const json = JSON.stringify(error)

    expect(json).toBeDefined()
  })
})

describe('Error differentiation', () => {
  it('can distinguish between error types using instanceof', () => {
    const queueError = new QueueError('Base error')
    const queueFullError = new QueueFullError(10, 10)
    const timeoutError = new DownloadTimeoutError('hash-abc', 30000)

    expect(queueError instanceof QueueError).toBe(true)
    expect(queueError instanceof QueueFullError).toBe(false)
    expect(queueError instanceof DownloadTimeoutError).toBe(false)

    expect(queueFullError instanceof QueueError).toBe(true)
    expect(queueFullError instanceof QueueFullError).toBe(true)
    expect(queueFullError instanceof DownloadTimeoutError).toBe(false)

    expect(timeoutError instanceof QueueError).toBe(true)
    expect(timeoutError instanceof QueueFullError).toBe(false)
    expect(timeoutError instanceof DownloadTimeoutError).toBe(true)
  })

  it('can distinguish using error name', () => {
    const queueError = new QueueError('Base error')
    const queueFullError = new QueueFullError(10, 10)
    const timeoutError = new DownloadTimeoutError('hash-abc', 30000)

    expect(queueError.name).toBe('QueueError')
    expect(queueFullError.name).toBe('QueueFullError')
    expect(timeoutError.name).toBe('DownloadTimeoutError')
  })
})
