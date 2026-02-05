import { SimpleEventEmitter } from '../EventEmitter'
import { QueueEvent } from '../QueueEvents'

describe('SimpleEventEmitter', () => {
  let emitter: SimpleEventEmitter

  beforeEach(() => {
    emitter = new SimpleEventEmitter()
  })

  describe('on', () => {
    it('registers event listener', () => {
      const callback = jest.fn()

      emitter.on(QueueEvent.DOWNLOAD_STARTED, callback)

      expect(emitter.listenerCount(QueueEvent.DOWNLOAD_STARTED)).toBe(1)
    })

    it('allows multiple listeners for same event', () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()

      emitter.on(QueueEvent.DOWNLOAD_STARTED, callback1)
      emitter.on(QueueEvent.DOWNLOAD_STARTED, callback2)

      expect(emitter.listenerCount(QueueEvent.DOWNLOAD_STARTED)).toBe(2)
    })

    it('allows same callback to be registered once', () => {
      const callback = jest.fn()

      emitter.on(QueueEvent.DOWNLOAD_STARTED, callback)
      emitter.on(QueueEvent.DOWNLOAD_STARTED, callback)

      expect(emitter.listenerCount(QueueEvent.DOWNLOAD_STARTED)).toBe(1)
    })
  })

  describe('off', () => {
    it('removes event listener', () => {
      const callback = jest.fn()

      emitter.on(QueueEvent.DOWNLOAD_STARTED, callback)
      emitter.off(QueueEvent.DOWNLOAD_STARTED, callback)

      expect(emitter.listenerCount(QueueEvent.DOWNLOAD_STARTED)).toBe(0)
    })

    it('does nothing if callback not registered', () => {
      const callback = jest.fn()

      emitter.off(QueueEvent.DOWNLOAD_STARTED, callback)

      expect(emitter.listenerCount(QueueEvent.DOWNLOAD_STARTED)).toBe(0)
    })

    it('removes only specified callback', () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()

      emitter.on(QueueEvent.DOWNLOAD_STARTED, callback1)
      emitter.on(QueueEvent.DOWNLOAD_STARTED, callback2)
      emitter.off(QueueEvent.DOWNLOAD_STARTED, callback1)

      expect(emitter.listenerCount(QueueEvent.DOWNLOAD_STARTED)).toBe(1)
    })
  })

  describe('emit', () => {
    it('calls registered listeners with data', () => {
      const callback = jest.fn()
      const data = { foo: 'bar' }

      emitter.on(QueueEvent.DOWNLOAD_STARTED, callback)
      emitter.emit(QueueEvent.DOWNLOAD_STARTED, data)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(data)
    })

    it('calls multiple listeners in order', () => {
      const calls: number[] = []
      const callback1 = jest.fn(() => calls.push(1))
      const callback2 = jest.fn(() => calls.push(2))

      emitter.on(QueueEvent.DOWNLOAD_STARTED, callback1)
      emitter.on(QueueEvent.DOWNLOAD_STARTED, callback2)
      emitter.emit(QueueEvent.DOWNLOAD_STARTED)

      expect(calls).toEqual([1, 2])
    })

    it('does nothing if no listeners registered', () => {
      expect(() => {
        emitter.emit(QueueEvent.DOWNLOAD_STARTED, { foo: 'bar' })
      }).not.toThrow()
    })

    it('catches and logs errors in callbacks', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      const callback1 = jest.fn(() => {
        throw new Error('Test error')
      })
      const callback2 = jest.fn()

      emitter.on(QueueEvent.DOWNLOAD_STARTED, callback1)
      emitter.on(QueueEvent.DOWNLOAD_STARTED, callback2)
      emitter.emit(QueueEvent.DOWNLOAD_STARTED)

      expect(callback1).toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })

  describe('removeAllListeners', () => {
    it('removes all listeners for all events', () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()

      emitter.on(QueueEvent.DOWNLOAD_STARTED, callback1)
      emitter.on(QueueEvent.DOWNLOAD_COMPLETED, callback2)

      emitter.removeAllListeners()

      expect(emitter.listenerCount(QueueEvent.DOWNLOAD_STARTED)).toBe(0)
      expect(emitter.listenerCount(QueueEvent.DOWNLOAD_COMPLETED)).toBe(0)
    })
  })

  describe('listenerCount', () => {
    it('returns 0 when no listeners registered', () => {
      expect(emitter.listenerCount(QueueEvent.DOWNLOAD_STARTED)).toBe(0)
    })

    it('returns correct count', () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()

      emitter.on(QueueEvent.DOWNLOAD_STARTED, callback1)
      emitter.on(QueueEvent.DOWNLOAD_STARTED, callback2)

      expect(emitter.listenerCount(QueueEvent.DOWNLOAD_STARTED)).toBe(2)
    })
  })
})
