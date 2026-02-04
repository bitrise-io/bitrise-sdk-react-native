/**
 * Tests for ExpoConfig utility
 */

import { ExpoConfig } from '../expo-config'
import { NativeModules, Platform } from 'react-native'

// Mock React Native modules
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
  NativeModules: {
    RNBundle: {},
    BitriseFileSystem: {},
  },
}))

describe('ExpoConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset to iOS by default
    ;(Platform as any).OS = 'ios'
  })

  describe('getDeploymentKey', () => {
    describe('iOS', () => {
      beforeEach(() => {
        ;(Platform as any).OS = 'ios'
      })

      it('should return deployment key from RNBundle on iOS', () => {
        // Arrange
        ;(NativeModules as any).RNBundle = {
          BitriseCodePushDeploymentKey: 'test-ios-deployment-key',
        }

        // Act
        const result = ExpoConfig.getDeploymentKey()

        // Assert
        expect(result).toBe('test-ios-deployment-key')
      })

      it('should return null if RNBundle is not available', () => {
        // Arrange
        ;(NativeModules as any).RNBundle = undefined

        // Act
        const result = ExpoConfig.getDeploymentKey()

        // Assert
        expect(result).toBeNull()
      })

      it('should return null if deployment key is not in RNBundle', () => {
        // Arrange
        ;(NativeModules as any).RNBundle = {
          SomeOtherKey: 'value',
        }

        // Act
        const result = ExpoConfig.getDeploymentKey()

        // Assert
        expect(result).toBeNull()
      })

      it('should fallback to InfoPlistReader if RNBundle is not available', () => {
        // Arrange
        ;(NativeModules as any).RNBundle = undefined
        ;(NativeModules as any).InfoPlistReader = {
          BitriseCodePushDeploymentKey: 'test-fallback-key',
        }

        // Act
        const result = ExpoConfig.getDeploymentKey()

        // Assert
        expect(result).toBe('test-fallback-key')
      })
    })

    describe('Android', () => {
      beforeEach(() => {
        ;(Platform as any).OS = 'android'
      })

      it('should return deployment key from BitriseFileSystem on Android', () => {
        // Arrange
        ;(NativeModules as any).BitriseFileSystem = {
          getStringResource: jest.fn().mockReturnValue('test-android-deployment-key'),
        }

        // Act
        const result = ExpoConfig.getDeploymentKey()

        // Assert
        expect(result).toBe('test-android-deployment-key')
        expect(NativeModules.BitriseFileSystem.getStringResource).toHaveBeenCalledWith(
          'BitriseCodePushDeploymentKey'
        )
      })

      it('should return null if BitriseFileSystem is not available', () => {
        // Arrange
        ;(NativeModules as any).BitriseFileSystem = undefined

        // Act
        const result = ExpoConfig.getDeploymentKey()

        // Assert
        expect(result).toBeNull()
      })

      it('should return null if getStringResource is not a function', () => {
        // Arrange
        ;(NativeModules as any).BitriseFileSystem = {
          someOtherMethod: jest.fn(),
        }

        // Act
        const result = ExpoConfig.getDeploymentKey()

        // Assert
        expect(result).toBeNull()
      })

      it('should return null if getStringResource returns null', () => {
        // Arrange
        ;(NativeModules as any).BitriseFileSystem = {
          getStringResource: jest.fn().mockReturnValue(null),
        }

        // Act
        const result = ExpoConfig.getDeploymentKey()

        // Assert
        expect(result).toBeNull()
      })
    })

    it('should return null for unsupported platforms', () => {
      // Arrange
      ;(Platform as any).OS = 'web'

      // Act
      const result = ExpoConfig.getDeploymentKey()

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('getServerUrl', () => {
    describe('iOS', () => {
      beforeEach(() => {
        ;(Platform as any).OS = 'ios'
      })

      it('should return server URL from RNBundle on iOS', () => {
        // Arrange
        ;(NativeModules as any).RNBundle = {
          BitriseCodePushServerURL: 'https://custom-ios.api.bitrise.io',
        }

        // Act
        const result = ExpoConfig.getServerUrl()

        // Assert
        expect(result).toBe('https://custom-ios.api.bitrise.io')
      })

      it('should return null if RNBundle is not available', () => {
        // Arrange
        ;(NativeModules as any).RNBundle = undefined

        // Act
        const result = ExpoConfig.getServerUrl()

        // Assert
        expect(result).toBeNull()
      })

      it('should return null if server URL is not in RNBundle', () => {
        // Arrange
        ;(NativeModules as any).RNBundle = {
          SomeOtherKey: 'value',
        }

        // Act
        const result = ExpoConfig.getServerUrl()

        // Assert
        expect(result).toBeNull()
      })

      it('should fallback to InfoPlistReader if RNBundle is not available', () => {
        // Arrange
        ;(NativeModules as any).RNBundle = undefined
        ;(NativeModules as any).InfoPlistReader = {
          BitriseCodePushServerURL: 'https://fallback.api.bitrise.io',
        }

        // Act
        const result = ExpoConfig.getServerUrl()

        // Assert
        expect(result).toBe('https://fallback.api.bitrise.io')
      })
    })

    describe('Android', () => {
      beforeEach(() => {
        ;(Platform as any).OS = 'android'
      })

      it('should return server URL from BitriseFileSystem on Android', () => {
        // Arrange
        ;(NativeModules as any).BitriseFileSystem = {
          getStringResource: jest.fn().mockReturnValue('https://custom-android.api.bitrise.io'),
        }

        // Act
        const result = ExpoConfig.getServerUrl()

        // Assert
        expect(result).toBe('https://custom-android.api.bitrise.io')
        expect(NativeModules.BitriseFileSystem.getStringResource).toHaveBeenCalledWith(
          'BitriseCodePushServerURL'
        )
      })

      it('should return null if BitriseFileSystem is not available', () => {
        // Arrange
        ;(NativeModules as any).BitriseFileSystem = undefined

        // Act
        const result = ExpoConfig.getServerUrl()

        // Assert
        expect(result).toBeNull()
      })

      it('should return null if getStringResource is not a function', () => {
        // Arrange
        ;(NativeModules as any).BitriseFileSystem = {
          someOtherMethod: jest.fn(),
        }

        // Act
        const result = ExpoConfig.getServerUrl()

        // Assert
        expect(result).toBeNull()
      })

      it('should return null if getStringResource returns null', () => {
        // Arrange
        ;(NativeModules as any).BitriseFileSystem = {
          getStringResource: jest.fn().mockReturnValue(null),
        }

        // Act
        const result = ExpoConfig.getServerUrl()

        // Assert
        expect(result).toBeNull()
      })
    })

    it('should return null for unsupported platforms', () => {
      // Arrange
      ;(Platform as any).OS = 'web'

      // Act
      const result = ExpoConfig.getServerUrl()

      // Assert
      expect(result).toBeNull()
    })
  })
})
