import { RestartQueue } from '../RestartQueue'

describe('RestartQueue', () => {
  let queue: RestartQueue

  beforeEach(() => {
    // Get a fresh instance for each test
    queue = RestartQueue.getInstance()
    // Reset state
    queue.allowRestart()
    queue.clearQueue()
  })

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = RestartQueue.getInstance()
      const instance2 = RestartQueue.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('isRestartAllowed', () => {
    it('should return true by default', () => {
      expect(queue.isRestartAllowed()).toBe(true)
    })

    it('should return false after disallowRestart', () => {
      queue.disallowRestart()
      expect(queue.isRestartAllowed()).toBe(false)
    })

    it('should return true after allowRestart', () => {
      queue.disallowRestart()
      queue.allowRestart()
      expect(queue.isRestartAllowed()).toBe(true)
    })
  })

  describe('queueRestart', () => {
    it('should execute restart immediately when allowed', () => {
      const mockRestart = jest.fn()
      queue.queueRestart(mockRestart)
      expect(mockRestart).toHaveBeenCalledTimes(1)
    })

    it('should queue restart when disallowed', () => {
      const mockRestart = jest.fn()
      queue.disallowRestart()
      queue.queueRestart(mockRestart)
      expect(mockRestart).not.toHaveBeenCalled()
    })

    it('should replace queued restart with latest', () => {
      const mockRestart1 = jest.fn()
      const mockRestart2 = jest.fn()

      queue.disallowRestart()
      queue.queueRestart(mockRestart1)
      queue.queueRestart(mockRestart2)

      queue.allowRestart()

      expect(mockRestart1).not.toHaveBeenCalled()
      expect(mockRestart2).toHaveBeenCalledTimes(1)
    })
  })

  describe('allowRestart', () => {
    it('should execute queued restart', () => {
      const mockRestart = jest.fn()

      queue.disallowRestart()
      queue.queueRestart(mockRestart)
      expect(mockRestart).not.toHaveBeenCalled()

      queue.allowRestart()
      expect(mockRestart).toHaveBeenCalledTimes(1)
    })

    it('should do nothing if no restart is queued', () => {
      queue.disallowRestart()
      // Should not throw
      expect(() => queue.allowRestart()).not.toThrow()
    })

    it('should allow future restarts to execute immediately', () => {
      const mockRestart = jest.fn()

      queue.disallowRestart()
      queue.allowRestart()
      queue.queueRestart(mockRestart)

      expect(mockRestart).toHaveBeenCalledTimes(1)
    })
  })

  describe('disallowRestart', () => {
    it('should prevent restarts from executing', () => {
      const mockRestart = jest.fn()

      queue.disallowRestart()
      queue.queueRestart(mockRestart)

      expect(mockRestart).not.toHaveBeenCalled()
    })

    it('should queue subsequent restarts', () => {
      const mockRestart1 = jest.fn()
      const mockRestart2 = jest.fn()

      queue.disallowRestart()
      queue.queueRestart(mockRestart1)
      queue.queueRestart(mockRestart2) // Replaces first

      queue.allowRestart()

      expect(mockRestart1).not.toHaveBeenCalled()
      expect(mockRestart2).toHaveBeenCalledTimes(1)
    })
  })

  describe('clearQueue', () => {
    it('should remove queued restart without executing', () => {
      const mockRestart = jest.fn()

      queue.disallowRestart()
      queue.queueRestart(mockRestart)
      queue.clearQueue()
      queue.allowRestart()

      expect(mockRestart).not.toHaveBeenCalled()
    })

    it('should not affect future queued restarts', () => {
      const mockRestart1 = jest.fn()
      const mockRestart2 = jest.fn()

      queue.disallowRestart()
      queue.queueRestart(mockRestart1)
      queue.clearQueue()
      queue.queueRestart(mockRestart2)
      queue.allowRestart()

      expect(mockRestart1).not.toHaveBeenCalled()
      expect(mockRestart2).toHaveBeenCalledTimes(1)
    })
  })

  describe('multiple disallow/allow cycles', () => {
    it('should handle multiple cycles correctly', () => {
      const mockRestart1 = jest.fn()
      const mockRestart2 = jest.fn()
      const mockRestart3 = jest.fn()

      // Cycle 1
      queue.disallowRestart()
      queue.queueRestart(mockRestart1)
      queue.allowRestart()
      expect(mockRestart1).toHaveBeenCalledTimes(1)

      // Cycle 2
      queue.disallowRestart()
      queue.queueRestart(mockRestart2)
      queue.allowRestart()
      expect(mockRestart2).toHaveBeenCalledTimes(1)

      // Cycle 3 - immediate execution (allowed state)
      queue.queueRestart(mockRestart3)
      expect(mockRestart3).toHaveBeenCalledTimes(1)
    })
  })

  describe('console logging', () => {
    let consoleLogSpy: jest.SpyInstance

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    })

    afterEach(() => {
      consoleLogSpy.mockRestore()
    })

    it('should log when restart is queued', () => {
      queue.disallowRestart()
      queue.queueRestart(() => {})

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[CodePush] Restart queued. Call allowRestart() to proceed.'
      )
    })

    it('should not log when restart executes immediately', () => {
      queue.queueRestart(() => {})

      expect(consoleLogSpy).not.toHaveBeenCalled()
    })
  })
})
