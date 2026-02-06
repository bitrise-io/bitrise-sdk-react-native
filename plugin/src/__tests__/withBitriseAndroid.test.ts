/**
 * Tests for Android config plugin
 */

import { withBitriseAndroid } from '../withBitriseAndroid'
import { withStringsXml, AndroidConfig } from 'expo/config-plugins'
import type { BitrisePluginOptions } from '../types'
import type { ExpoConfig } from 'expo/config'

// Mock expo/config-plugins
jest.mock('expo/config-plugins', () => ({
  withStringsXml: jest.fn((config, callback) => {
    const modResults = { resources: { string: [] } }
    return callback({ ...config, modResults })
  }),
  AndroidConfig: {
    Strings: {
      setStringItem: jest.fn((items, modResults) => {
        return {
          ...modResults,
          resources: {
            string: items,
          },
        }
      }),
    },
  },
}))

describe('withBitriseAndroid', () => {
  const mockConfig: ExpoConfig = {
    name: 'TestApp',
    slug: 'test-app',
    android: {
      package: 'com.test.app',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should add deployment key and default server URL to strings.xml', () => {
    // Arrange
    const options: BitrisePluginOptions = {
      deploymentKey: 'test-deployment-key',
    }

    // Act
    const result = withBitriseAndroid(mockConfig, options)

    // Assert
    expect(result).toBeDefined()
    expect(withStringsXml).toHaveBeenCalledWith(mockConfig, expect.any(Function))
    expect(AndroidConfig.Strings.setStringItem).toHaveBeenCalledWith(
      [
        {
          $: { name: 'CodePushDeploymentKey', translatable: 'false' },
          _: 'test-deployment-key',
        },
        {
          $: { name: 'CodePushServerURL', translatable: 'false' },
          _: 'https://api.bitrise.io',
        },
      ],
      expect.any(Object)
    )
  })

  it('should use Android-specific deployment key when provided', () => {
    // Arrange
    const options: BitrisePluginOptions = {
      deploymentKey: 'fallback-key',
      android: {
        deploymentKey: 'android-specific-key',
      },
    }

    // Act
    const result = withBitriseAndroid(mockConfig, options)

    // Assert
    expect(result).toBeDefined()
    expect(AndroidConfig.Strings.setStringItem).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ _: 'android-specific-key' })]),
      expect.any(Object)
    )
  })

  it('should use Android-specific server URL when provided', () => {
    // Arrange
    const options: BitrisePluginOptions = {
      deploymentKey: 'test-key',
      serverUrl: 'https://fallback.url',
      android: {
        deploymentKey: 'android-key',
        serverUrl: 'https://android-specific.url',
      },
    }

    // Act
    const result = withBitriseAndroid(mockConfig, options)

    // Assert
    expect(result).toBeDefined()
    expect(AndroidConfig.Strings.setStringItem).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ _: 'https://android-specific.url' })]),
      expect.any(Object)
    )
  })

  it('should use top-level deployment key when Android-specific key is not provided', () => {
    // Arrange
    const options: BitrisePluginOptions = {
      deploymentKey: 'top-level-key',
    }

    // Act
    const result = withBitriseAndroid(mockConfig, options)

    // Assert
    expect(result).toBeDefined()
    expect(AndroidConfig.Strings.setStringItem).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ _: 'top-level-key' })]),
      expect.any(Object)
    )
  })

  it('should use top-level server URL when Android-specific URL is not provided', () => {
    // Arrange
    const options: BitrisePluginOptions = {
      deploymentKey: 'test-key',
      serverUrl: 'https://custom.url',
    }

    // Act
    const result = withBitriseAndroid(mockConfig, options)

    // Assert
    expect(result).toBeDefined()
    expect(AndroidConfig.Strings.setStringItem).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ _: 'https://custom.url' })]),
      expect.any(Object)
    )
  })

  it('should use default server URL when no server URL is provided', () => {
    // Arrange
    const options: BitrisePluginOptions = {
      deploymentKey: 'test-key',
    }

    // Act
    const result = withBitriseAndroid(mockConfig, options)

    // Assert
    expect(result).toBeDefined()
    expect(AndroidConfig.Strings.setStringItem).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ _: 'https://api.bitrise.io' })]),
      expect.any(Object)
    )
  })

  it('should throw error when deployment key is missing', () => {
    // Arrange
    const options: BitrisePluginOptions = {}

    // Act & Assert
    expect(() => withBitriseAndroid(mockConfig, options)).toThrow(
      '[BitriseSDK] Android deployment key is required'
    )
  })

  it('should throw error when Android config exists but deployment key is missing', () => {
    // Arrange
    const options: BitrisePluginOptions = {
      android: {
        deploymentKey: '',
      },
    }

    // Act & Assert
    expect(() => withBitriseAndroid(mockConfig, options)).toThrow(
      '[BitriseSDK] Android deployment key is required'
    )
  })
})
