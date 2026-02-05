import { NativeModules, Platform } from 'react-native'
import { restartApp } from '../Restart'

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
})
