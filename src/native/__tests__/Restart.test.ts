import { NativeModules, Platform } from 'react-native'
import { restartApp, isRestartAvailable, restartIfPending } from '../Restart'

// Mock React Native modules
jest.mock('react-native', () => ({
  NativeModules: {
    DevSettings: {
      reload: jest.fn(),
    },
  },
  Platform: {
    OS: 'ios',
  },
}))

describe('Restart', () => {
  let consoleLogSpy: jest.SpyInstance
  let consoleWarnSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe('restartApp', () => {
    it('should call DevSettings.reload() when available', () => {
      const mockReload = jest.fn()
      NativeModules.DevSettings = { reload: mockReload }

      restartApp()

      expect(mockReload).toHaveBeenCalledTimes(1)
      expect(consoleLogSpy).toHaveBeenCalledWith('[CodePush] Restarting app via DevSettings...')
      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })

    it('should warn when DevSettings is unavailable', () => {
      NativeModules.DevSettings = undefined

      restartApp()

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CodePush] Native restart not available')
      )
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Platform: ios'))
    })

    it('should warn when DevSettings.reload is not a function', () => {
      NativeModules.DevSettings = { reload: null }

      restartApp()

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CodePush] Native restart not available')
      )
    })

    it('should include platform in warning message', () => {
      NativeModules.DevSettings = undefined
      ;(Platform as any).OS = 'android'

      restartApp()

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Platform: android'))
    })

    it('should handle errors gracefully', () => {
      const mockReload = jest.fn(() => {
        throw new Error('Reload failed')
      })
      NativeModules.DevSettings = { reload: mockReload }

      // Should not throw
      expect(() => restartApp()).not.toThrow()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[CodePush] Failed to trigger restart:',
        expect.any(Error)
      )
    })

    it('should handle DevSettings being null', () => {
      NativeModules.DevSettings = null

      restartApp()

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CodePush] Native restart not available')
      )
    })

    it('should handle reload being a non-function value', () => {
      NativeModules.DevSettings = { reload: 'not a function' }

      restartApp()

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CodePush] Native restart not available')
      )
    })
  })

  describe('iOS specific behavior', () => {
    beforeEach(() => {
      ;(Platform as any).OS = 'ios'
    })

    it('should work on iOS with DevSettings', () => {
      const mockReload = jest.fn()
      NativeModules.DevSettings = { reload: mockReload }

      restartApp()

      expect(mockReload).toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith('[CodePush] Restarting app via DevSettings...')
    })
  })

  describe('Android specific behavior', () => {
    beforeEach(() => {
      ;(Platform as any).OS = 'android'
    })

    it('should work on Android with DevSettings', () => {
      const mockReload = jest.fn()
      NativeModules.DevSettings = { reload: mockReload }

      restartApp()

      expect(mockReload).toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith('[CodePush] Restarting app via DevSettings...')
    })
  })

  describe('BitriseRestart native module', () => {
    beforeEach(() => {
      // Reset modules between tests
      NativeModules.BitriseRestart = undefined
      NativeModules.DevSettings = undefined
    })

    it('should use BitriseRestart module when available', () => {
      const mockRestart = jest.fn()
      NativeModules.BitriseRestart = { restart: mockRestart }
      NativeModules.DevSettings = { reload: jest.fn() }

      restartApp()

      expect(mockRestart).toHaveBeenCalledTimes(1)
      expect(NativeModules.DevSettings.reload).not.toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith('[CodePush] Restarting app via native module...')
    })

    it('should prefer BitriseRestart over DevSettings', () => {
      const mockRestart = jest.fn()
      const mockReload = jest.fn()
      NativeModules.BitriseRestart = { restart: mockRestart }
      NativeModules.DevSettings = { reload: mockReload }

      restartApp()

      expect(mockRestart).toHaveBeenCalled()
      expect(mockReload).not.toHaveBeenCalled()
    })

    it('should fall back to DevSettings when BitriseRestart has no restart method', () => {
      const mockReload = jest.fn()
      NativeModules.BitriseRestart = {} // No restart method
      NativeModules.DevSettings = { reload: mockReload }

      restartApp()

      expect(mockReload).toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith('[CodePush] Restarting app via DevSettings...')
    })

    it('should fall back to DevSettings when BitriseRestart.restart is not a function', () => {
      const mockReload = jest.fn()
      NativeModules.BitriseRestart = { restart: 'not a function' }
      NativeModules.DevSettings = { reload: mockReload }

      restartApp()

      expect(mockReload).toHaveBeenCalled()
    })

    it('should handle error in BitriseRestart.restart gracefully', () => {
      NativeModules.BitriseRestart = {
        restart: jest.fn(() => {
          throw new Error('Native restart failed')
        }),
      }
      NativeModules.DevSettings = undefined

      expect(() => restartApp()).not.toThrow()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[CodePush] Failed to trigger restart:',
        expect.any(Error)
      )
    })
  })

  describe('isRestartAvailable', () => {
    beforeEach(() => {
      NativeModules.BitriseRestart = undefined
      NativeModules.DevSettings = undefined
    })

    it('should return true when BitriseRestart module is available', () => {
      NativeModules.BitriseRestart = { restart: jest.fn() }

      expect(isRestartAvailable()).toBe(true)
    })

    it('should return true when DevSettings is available', () => {
      NativeModules.DevSettings = { reload: jest.fn() }

      expect(isRestartAvailable()).toBe(true)
    })

    it('should return true when both BitriseRestart and DevSettings are available', () => {
      NativeModules.BitriseRestart = { restart: jest.fn() }
      NativeModules.DevSettings = { reload: jest.fn() }

      expect(isRestartAvailable()).toBe(true)
    })

    it('should return falsy when no restart mechanism is available', () => {
      NativeModules.BitriseRestart = undefined
      NativeModules.DevSettings = undefined

      expect(isRestartAvailable()).toBeFalsy()
    })

    it('should return falsy when BitriseRestart has no restart method and DevSettings unavailable', () => {
      NativeModules.BitriseRestart = {} // No restart method
      NativeModules.DevSettings = undefined

      expect(isRestartAvailable()).toBeFalsy()
    })

    it('should return falsy when BitriseRestart.restart is not a function and DevSettings unavailable', () => {
      NativeModules.BitriseRestart = { restart: 'not a function' }
      NativeModules.DevSettings = undefined

      expect(isRestartAvailable()).toBeFalsy()
    })

    it('should return false when DevSettings.reload is not a function', () => {
      NativeModules.BitriseRestart = undefined
      NativeModules.DevSettings = { reload: null }

      expect(isRestartAvailable()).toBe(false)
    })

    it('should return true with DevSettings even when BitriseRestart is invalid', () => {
      NativeModules.BitriseRestart = { restart: null } // Invalid
      NativeModules.DevSettings = { reload: jest.fn() }

      expect(isRestartAvailable()).toBe(true)
    })
  })

  describe('restartIfPending', () => {
    beforeEach(() => {
      NativeModules.BitriseRestart = undefined
      NativeModules.DevSettings = { reload: jest.fn() }
    })

    it('should call restartApp when update is pending', async () => {
      const mockReload = jest.fn()
      NativeModules.DevSettings = { reload: mockReload }
      const hasPendingUpdate = jest.fn().mockResolvedValue(true)

      await restartIfPending(hasPendingUpdate)

      expect(hasPendingUpdate).toHaveBeenCalled()
      expect(mockReload).toHaveBeenCalled()
    })

    it('should not call restartApp when no update is pending', async () => {
      const mockReload = jest.fn()
      NativeModules.DevSettings = { reload: mockReload }
      const hasPendingUpdate = jest.fn().mockResolvedValue(false)

      await restartIfPending(hasPendingUpdate)

      expect(hasPendingUpdate).toHaveBeenCalled()
      expect(mockReload).not.toHaveBeenCalled()
    })

    it('should handle errors in hasPendingUpdate gracefully', async () => {
      const hasPendingUpdate = jest.fn().mockRejectedValue(new Error('Check failed'))

      await expect(restartIfPending(hasPendingUpdate)).resolves.not.toThrow()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[CodePush] Failed to check for pending update:',
        expect.any(Error)
      )
    })

    it('should not restart when hasPendingUpdate throws', async () => {
      const mockReload = jest.fn()
      NativeModules.DevSettings = { reload: mockReload }
      const hasPendingUpdate = jest.fn().mockRejectedValue(new Error('Check failed'))

      await restartIfPending(hasPendingUpdate)

      expect(mockReload).not.toHaveBeenCalled()
    })

    it('should work with async hasPendingUpdate function', async () => {
      const mockReload = jest.fn()
      NativeModules.DevSettings = { reload: mockReload }
      const hasPendingUpdate = jest
        .fn()
        .mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(true), 10)))

      await restartIfPending(hasPendingUpdate)

      expect(hasPendingUpdate).toHaveBeenCalled()
      expect(mockReload).toHaveBeenCalled()
    })

    it('should use BitriseRestart when pending and available', async () => {
      const mockRestart = jest.fn()
      NativeModules.BitriseRestart = { restart: mockRestart }
      NativeModules.DevSettings = { reload: jest.fn() }
      const hasPendingUpdate = jest.fn().mockResolvedValue(true)

      await restartIfPending(hasPendingUpdate)

      expect(mockRestart).toHaveBeenCalled()
      expect(NativeModules.DevSettings.reload).not.toHaveBeenCalled()
    })
  })
})
