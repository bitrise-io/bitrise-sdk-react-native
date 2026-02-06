/**
 * Tests for iOS config plugin
 */

import { withBitriseIos } from '../withBitriseIos'
import { withInfoPlist } from 'expo/config-plugins'
import type { BitrisePluginOptions } from '../types'
import type { ExpoConfig } from 'expo/config'

// Mock expo/config-plugins
jest.mock('expo/config-plugins', () => ({
  withInfoPlist: jest.fn((config, callback) => {
    const modResults = {}
    return callback({ ...config, modResults })
  }),
}))

describe('withBitriseIos', () => {
  const mockConfig: ExpoConfig = {
    name: 'TestApp',
    slug: 'test-app',
    ios: {
      bundleIdentifier: 'com.test.app',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should add deployment key and default server URL to Info.plist', () => {
    // Arrange
    const options: BitrisePluginOptions = {
      deploymentKey: 'test-deployment-key',
    }

    // Act
    const result = withBitriseIos(mockConfig, options)

    // Assert
    expect(result).toBeDefined()
    expect(withInfoPlist).toHaveBeenCalledWith(mockConfig, expect.any(Function))
    expect(result.modResults).toEqual({
      CodePushDeploymentKey: 'test-deployment-key',
      CodePushServerURL: 'https://api.bitrise.io',
    })
  })

  it('should use iOS-specific deployment key when provided', () => {
    // Arrange
    const options: BitrisePluginOptions = {
      deploymentKey: 'fallback-key',
      ios: {
        deploymentKey: 'ios-specific-key',
      },
    }

    // Act
    const result = withBitriseIos(mockConfig, options)

    // Assert
    expect(result).toBeDefined()
    expect(result.modResults.CodePushDeploymentKey).toBe('ios-specific-key')
  })

  it('should use iOS-specific server URL when provided', () => {
    // Arrange
    const options: BitrisePluginOptions = {
      deploymentKey: 'test-key',
      serverUrl: 'https://fallback.url',
      ios: {
        deploymentKey: 'ios-key',
        serverUrl: 'https://ios-specific.url',
      },
    }

    // Act
    const result = withBitriseIos(mockConfig, options)

    // Assert
    expect(result).toBeDefined()
    expect(result.modResults.CodePushServerURL).toBe('https://ios-specific.url')
  })

  it('should use top-level deployment key when iOS-specific key is not provided', () => {
    // Arrange
    const options: BitrisePluginOptions = {
      deploymentKey: 'top-level-key',
    }

    // Act
    const result = withBitriseIos(mockConfig, options)

    // Assert
    expect(result).toBeDefined()
    expect(result.modResults.CodePushDeploymentKey).toBe('top-level-key')
  })

  it('should use top-level server URL when iOS-specific URL is not provided', () => {
    // Arrange
    const options: BitrisePluginOptions = {
      deploymentKey: 'test-key',
      serverUrl: 'https://custom.url',
    }

    // Act
    const result = withBitriseIos(mockConfig, options)

    // Assert
    expect(result).toBeDefined()
    expect(result.modResults.CodePushServerURL).toBe('https://custom.url')
  })

  it('should use default server URL when no server URL is provided', () => {
    // Arrange
    const options: BitrisePluginOptions = {
      deploymentKey: 'test-key',
    }

    // Act
    const result = withBitriseIos(mockConfig, options)

    // Assert
    expect(result).toBeDefined()
    expect(result.modResults.CodePushServerURL).toBe('https://api.bitrise.io')
  })

  it('should throw error when deployment key is missing', () => {
    // Arrange
    const options: BitrisePluginOptions = {}

    // Act & Assert
    expect(() => withBitriseIos(mockConfig, options)).toThrow(
      '[BitriseSDK] iOS deployment key is required'
    )
  })

  it('should throw error when iOS config exists but deployment key is missing', () => {
    // Arrange
    const options: BitrisePluginOptions = {
      ios: {
        deploymentKey: '',
      },
    }

    // Act & Assert
    expect(() => withBitriseIos(mockConfig, options)).toThrow(
      '[BitriseSDK] iOS deployment key is required'
    )
  })
})
