/**
 * Base error class for all Bitrise SDK errors
 */
export class BitriseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'BitriseError'
    Object.setPrototypeOf(this, BitriseError.prototype)
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends BitriseError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFIGURATION_ERROR', details)
    this.name = 'ConfigurationError'
    Object.setPrototypeOf(this, ConfigurationError.prototype)
  }
}

/**
 * Error thrown when network requests fail
 */
export class NetworkError extends BitriseError {
  constructor(message: string, details?: unknown) {
    super(message, 'NETWORK_ERROR', details)
    this.name = 'NetworkError'
    Object.setPrototypeOf(this, NetworkError.prototype)
  }
}

/**
 * Error thrown when update operations fail
 */
export class UpdateError extends BitriseError {
  constructor(message: string, details?: unknown) {
    super(message, 'UPDATE_ERROR', details)
    this.name = 'UpdateError'
    Object.setPrototypeOf(this, UpdateError.prototype)
  }
}
