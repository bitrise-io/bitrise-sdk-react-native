import { BitriseSDK } from '../BitriseSDK'
import { ConfigurationError } from '../../types/errors'

describe('BitriseSDK', () => {
  beforeEach(() => {
    // Reset SDK state before each test
    ;(BitriseSDK as any).config = null
    ;(BitriseSDK as any)._codePush = null
  })

  describe('configure', () => {
    it('should configure SDK with valid config', () => {
      // Arrange
      const config = {
        apiToken: 'test-token',
        appSlug: 'test-slug',
      }

      // Act
      BitriseSDK.configure(config)

      // Assert
      expect(BitriseSDK.getConfig()).toEqual({
        ...config,
        apiEndpoint: 'https://api.bitrise.io/v0.1',
        serverUrl: undefined, // No default serverUrl without workspaceSlug
      })
    })

    it('should accept custom API endpoint', () => {
      // Arrange
      const config = {
        apiToken: 'test-token',
        appSlug: 'test-slug',
        apiEndpoint: 'https://custom.api.endpoint',
      }

      // Act
      BitriseSDK.configure(config)

      // Assert
      expect(BitriseSDK.getConfig().apiEndpoint).toBe('https://custom.api.endpoint')
    })

    it('should throw ConfigurationError if apiToken is empty', () => {
      // Arrange
      const config = {
        apiToken: '',
        appSlug: 'test-slug',
      }

      // Act & Assert
      expect(() => BitriseSDK.configure(config)).toThrow(ConfigurationError)
      expect(() => BitriseSDK.configure(config)).toThrow('apiToken is required and cannot be empty')
    })

    it('should throw ConfigurationError if appSlug is empty', () => {
      // Arrange
      const config = {
        apiToken: 'test-token',
        appSlug: '',
      }

      // Act & Assert
      expect(() => BitriseSDK.configure(config)).toThrow(ConfigurationError)
      expect(() => BitriseSDK.configure(config)).toThrow('appSlug is required and cannot be empty')
    })

    it('should accept deploymentKey with workspaceSlug', () => {
      // Arrange
      const config = {
        apiToken: 'test-token',
        appSlug: 'test-slug',
        deploymentKey: 'test-deployment-key',
        workspaceSlug: 'test-workspace',
      }

      // Act
      BitriseSDK.configure(config)

      // Assert
      expect(BitriseSDK.getConfig().deploymentKey).toBe('test-deployment-key')
    })

    it('should throw ConfigurationError if deploymentKey is empty string', () => {
      // Arrange
      const config = {
        apiToken: 'test-token',
        appSlug: 'test-slug',
        deploymentKey: '',
      }

      // Act & Assert
      expect(() => BitriseSDK.configure(config)).toThrow(ConfigurationError)
      expect(() => BitriseSDK.configure(config)).toThrow('deploymentKey must be a non-empty string')
    })

    it('should accept custom serverUrl', () => {
      // Arrange
      const config = {
        apiToken: 'test-token',
        appSlug: 'test-slug',
        serverUrl: 'https://custom.server.url',
      }

      // Act
      BitriseSDK.configure(config)

      // Assert
      expect(BitriseSDK.getConfig().serverUrl).toBe('https://custom.server.url')
    })

    describe('workspaceSlug', () => {
      it('should construct serverUrl from workspaceSlug', () => {
        // Arrange
        const config = {
          apiToken: 'test-token',
          appSlug: 'test-slug',
          workspaceSlug: 'my-workspace',
        }

        // Act
        BitriseSDK.configure(config)

        // Assert
        expect(BitriseSDK.getConfig().serverUrl).toBe('https://my-workspace.codepush.bitrise.io')
      })

      it('should throw ConfigurationError if workspaceSlug is empty string', () => {
        // Arrange
        const config = {
          apiToken: 'test-token',
          appSlug: 'test-slug',
          workspaceSlug: '',
        }

        // Act & Assert
        expect(() => BitriseSDK.configure(config)).toThrow(ConfigurationError)
        expect(() => BitriseSDK.configure(config)).toThrow(
          'workspaceSlug must be a non-empty string'
        )
      })

      it('should prioritize workspaceSlug over explicit serverUrl', () => {
        // Arrange
        const config = {
          apiToken: 'test-token',
          appSlug: 'test-slug',
          workspaceSlug: 'my-workspace',
          serverUrl: 'https://explicit.url.com',
        }

        // Act
        BitriseSDK.configure(config)

        // Assert - workspaceSlug should take precedence
        expect(BitriseSDK.getConfig().serverUrl).toBe('https://my-workspace.codepush.bitrise.io')
      })

      it('should throw if deploymentKey provided without workspaceSlug or serverUrl', () => {
        // Arrange
        const config = {
          apiToken: 'test-token',
          appSlug: 'test-slug',
          deploymentKey: 'test-key',
        }

        // Act & Assert
        expect(() => BitriseSDK.configure(config)).toThrow(ConfigurationError)
        expect(() => BitriseSDK.configure(config)).toThrow(
          'workspaceSlug is required when using CodePush'
        )
      })

      it('should allow deploymentKey with serverUrl (no workspaceSlug)', () => {
        // Arrange
        const config = {
          apiToken: 'test-token',
          appSlug: 'test-slug',
          deploymentKey: 'test-key',
          serverUrl: 'https://custom.codepush.server.io',
        }

        // Act
        BitriseSDK.configure(config)

        // Assert
        expect(BitriseSDK.getConfig().serverUrl).toBe('https://custom.codepush.server.io')
        expect(BitriseSDK.getConfig().deploymentKey).toBe('test-key')
      })
    })
  })

  describe('getConfig', () => {
    it('should throw ConfigurationError if SDK is not configured', () => {
      // Act & Assert
      expect(() => BitriseSDK.getConfig()).toThrow(ConfigurationError)
      expect(() => BitriseSDK.getConfig()).toThrow(
        'SDK not configured. Call BitriseSDK.configure() first.'
      )
    })
  })

  describe('codePush', () => {
    it('should return CodePush instance after configuration', () => {
      // Arrange
      BitriseSDK.configure({
        apiToken: 'test-token',
        appSlug: 'test-slug',
      })

      // Act
      const codePush = BitriseSDK.codePush

      // Assert
      expect(codePush).toBeDefined()
      expect(codePush.checkForUpdate).toBeDefined()
      expect(codePush.sync).toBeDefined()
      expect(codePush.notifyAppReady).toBeDefined()
    })

    it('should return same CodePush instance on multiple calls', () => {
      // Arrange
      BitriseSDK.configure({
        apiToken: 'test-token',
        appSlug: 'test-slug',
      })

      // Act
      const codePush1 = BitriseSDK.codePush
      const codePush2 = BitriseSDK.codePush

      // Assert
      expect(codePush1).toBe(codePush2)
    })
  })
})
