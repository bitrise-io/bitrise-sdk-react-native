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

/**
 * Error thrown when filesystem operations fail
 */
export class FileSystemError extends BitriseError {
  constructor(
    message: string,
    details?: { code?: string; path?: string; originalError?: unknown }
  ) {
    super(message, details?.code || 'FILESYSTEM_ERROR', details)
    this.name = 'FileSystemError'
    Object.setPrototypeOf(this, FileSystemError.prototype)
  }
}

/**
 * Error thrown when operations timeout
 */
export class TimeoutError extends BitriseError {
  constructor(message: string, details?: { timeoutMs?: number; operation?: string }) {
    super(message, 'TIMEOUT_ERROR', details)
    this.name = 'TimeoutError'
    Object.setPrototypeOf(this, TimeoutError.prototype)
  }
}
