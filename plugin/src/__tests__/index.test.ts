/**
 * Tests for main plugin export
 */

import withBitriseSDK from '../index'
import { withBitriseIos, withBitriseAndroid } from '../index'
import type { BitrisePluginOptions } from '../types'
import type { ExpoConfig } from 'expo/config'

describe('withBitriseSDK', () => {
  const mockConfig: ExpoConfig = {
    name: 'TestApp',
    slug: 'test-app',
    ios: {
      bundleIdentifier: 'com.test.app',
    },
    android: {
      package: 'com.test.app',
    },
  }

  it('should export main plugin as default', () => {
    // Assert
    expect(withBitriseSDK).toBeDefined()
    expect(typeof withBitriseSDK).toBe('function')
  })

  it('should export individual iOS and Android plugins', () => {
    // Assert
    expect(withBitriseIos).toBeDefined()
    expect(typeof withBitriseIos).toBe('function')
    expect(withBitriseAndroid).toBeDefined()
    expect(typeof withBitriseAndroid).toBe('function')
  })

  it('should configure both iOS and Android', () => {
    // Arrange
    const options: BitrisePluginOptions = {
      ios: {
        deploymentKey: 'ios-key',
      },
      android: {
        deploymentKey: 'android-key',
      },
    }

    // Act
    const result = withBitriseSDK(mockConfig, options)

    // Assert
    expect(result).toBeDefined()
    expect(result.name).toBe('TestApp')
  })

  it('should work with simple deployment key', () => {
    // Arrange
    const options: BitrisePluginOptions = {
      deploymentKey: 'shared-key',
    }

    // Act
    const result = withBitriseSDK(mockConfig, options)

    // Assert
    expect(result).toBeDefined()
  })
})
