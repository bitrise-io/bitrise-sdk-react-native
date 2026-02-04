import { getAppVersion, getPlatform, isIOS, isAndroid } from '../platform'
import { Platform } from 'react-native'

describe('platform utils', () => {
  describe('getAppVersion', () => {
    it('should return a version string', () => {
      const version = getAppVersion()
      expect(typeof version).toBe('string')
      expect(version).toBe('1.0.0')
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
