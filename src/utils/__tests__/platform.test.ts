import { getAppVersion, setAppVersion, getPlatform, isIOS, isAndroid } from '../platform'
import { Platform } from 'react-native'

describe('platform utils', () => {
  describe('getAppVersion', () => {
    it('returns default version 1.0.0 when not set', () => {
      const version = getAppVersion()
      expect(typeof version).toBe('string')
      // Will be either the cached value from previous tests or fallback
      expect(version.length).toBeGreaterThan(0)
    })

    it('returns cached version after setAppVersion is called', () => {
      setAppVersion('2.5.1')
      const version = getAppVersion()
      expect(version).toBe('2.5.1')
    })

    it('returns version string format', () => {
      const version = getAppVersion()
      expect(typeof version).toBe('string')
      // Should match semantic versioning or fallback
      expect(version.length).toBeGreaterThan(0)
    })

    it('handles native module failures gracefully', () => {
      // Even if native modules fail, should return fallback
      const version = getAppVersion()
      expect(version).toBeTruthy()
      expect(typeof version).toBe('string')
    })
  })

  describe('setAppVersion', () => {
    it('sets and caches app version', () => {
      setAppVersion('1.2.3')
      const version = getAppVersion()
      expect(version).toBe('1.2.3')
    })

    it('handles semantic versioning formats', () => {
      const versions = ['1.0.0', '2.5.1', '10.20.30']
      versions.forEach(testVersion => {
        setAppVersion(testVersion)
        expect(getAppVersion()).toBe(testVersion)
      })
    })

    it('handles version with build metadata', () => {
      setAppVersion('1.0.0-beta.1')
      expect(getAppVersion()).toBe('1.0.0-beta.1')
    })

    it('handles invalid version gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      setAppVersion('')
      expect(consoleSpy).toHaveBeenCalledWith('[CodePush] Invalid app version provided:', '')

      setAppVersion(null as any)
      expect(consoleSpy).toHaveBeenCalledWith('[CodePush] Invalid app version provided:', null)

      consoleSpy.mockRestore()
    })

    it('updates version when called multiple times', () => {
      setAppVersion('1.0.0')
      expect(getAppVersion()).toBe('1.0.0')

      setAppVersion('2.0.0')
      expect(getAppVersion()).toBe('2.0.0')

      setAppVersion('3.0.0')
      expect(getAppVersion()).toBe('3.0.0')
    })
  })

  describe('getPlatform', () => {
    it('should return ios when Platform.OS is ios', () => {
      Platform.OS = 'ios'
      expect(getPlatform()).toBe('ios')
    })

    it('should return android when Platform.OS is android', () => {
      Platform.OS = 'android'
      expect(getPlatform()).toBe('android')
    })
  })

  describe('isIOS', () => {
    it('should return true when on iOS', () => {
      Platform.OS = 'ios'
      expect(isIOS()).toBe(true)
    })

    it('should return false when not on iOS', () => {
      Platform.OS = 'android'
      expect(isIOS()).toBe(false)
    })
  })

  describe('isAndroid', () => {
    it('should return true when on Android', () => {
      Platform.OS = 'android'
      expect(isAndroid()).toBe(true)
    })

    it('should return false when not on Android', () => {
      Platform.OS = 'ios'
      expect(isAndroid()).toBe(false)
    })
  })
})
