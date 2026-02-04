import { getErrorMessage, wrapError } from '../error'

describe('error utilities', () => {
  describe('getErrorMessage', () => {
    it('extracts message from Error instance', () => {
      const error = new Error('Something went wrong')
      expect(getErrorMessage(error)).toBe('Something went wrong')
    })

    it('converts string to string', () => {
      expect(getErrorMessage('Error string')).toBe('Error string')
    })

    it('converts number to string', () => {
      expect(getErrorMessage(404)).toBe('404')
    })

    it('converts null to string', () => {
      expect(getErrorMessage(null)).toBe('null')
    })

    it('converts undefined to string', () => {
      expect(getErrorMessage(undefined)).toBe('undefined')
    })

    it('converts object to string', () => {
      const obj = { code: 'ERR_NETWORK' }
      expect(getErrorMessage(obj)).toBe('[object Object]')
    })

    it('converts array to string', () => {
      expect(getErrorMessage([1, 2, 3])).toBe('1,2,3')
    })

    it('handles TypeError instance', () => {
      const error = new TypeError('Type mismatch')
      expect(getErrorMessage(error)).toBe('Type mismatch')
    })

    it('handles custom Error subclass', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'CustomError'
        }
      }
      const error = new CustomError('Custom error message')
      expect(getErrorMessage(error)).toBe('Custom error message')
    })
  })

  describe('wrapError', () => {
    it('wraps Error instance with context', () => {
      const original = new Error('Original message')
      const wrapped = wrapError(original, 'Failed to process')

      expect(wrapped).toBeInstanceOf(Error)
      expect(wrapped.message).toBe('Failed to process: Original message')
    })

    it('wraps string error with context', () => {
      const wrapped = wrapError('Network timeout', 'Failed to download')

      expect(wrapped).toBeInstanceOf(Error)
      expect(wrapped.message).toBe('Failed to download: Network timeout')
    })

    it('wraps number error with context', () => {
      const wrapped = wrapError(500, 'Server error')

      expect(wrapped).toBeInstanceOf(Error)
      expect(wrapped.message).toBe('Server error: 500')
    })

    it('wraps null with context', () => {
      const wrapped = wrapError(null, 'Unexpected null')

      expect(wrapped).toBeInstanceOf(Error)
      expect(wrapped.message).toBe('Unexpected null: null')
    })

    it('preserves context format', () => {
      const wrapped = wrapError('timeout', 'Operation failed')

      expect(wrapped.message).toContain(': ')
      expect(wrapped.message.split(': ')).toHaveLength(2)
    })
  })
})
