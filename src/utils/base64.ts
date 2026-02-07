/**
 * Base64 encoding/decoding utilities for React Native
 * React Native's btoa/atob may not handle all byte values correctly
 */

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/**
 * Encode Uint8Array to base64 string
 * Works reliably in React Native without btoa
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let result = ''
  const len = bytes.length

  for (let i = 0; i < len; i += 3) {
    const byte1 = bytes[i]!
    const byte2 = bytes[i + 1]
    const byte3 = bytes[i + 2]

    const enc1 = byte1 >> 2
    const enc2 = ((byte1 & 3) << 4) | ((byte2 ?? 0) >> 4)
    const enc3 = byte2 !== undefined ? ((byte2 & 15) << 2) | ((byte3 ?? 0) >> 6) : 64
    const enc4 = byte3 !== undefined ? byte3 & 63 : 64

    result +=
      BASE64_CHARS[enc1]! +
      BASE64_CHARS[enc2]! +
      (enc3 === 64 ? '=' : BASE64_CHARS[enc3]!) +
      (enc4 === 64 ? '=' : BASE64_CHARS[enc4]!)
  }

  return result
}

/**
 * Decode base64 string to Uint8Array
 * Works reliably in React Native without atob
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  // Remove any whitespace and padding info
  const cleanBase64 = base64.replace(/\s/g, '')
  const padding = cleanBase64.endsWith('==') ? 2 : cleanBase64.endsWith('=') ? 1 : 0
  const len = (cleanBase64.length * 3) / 4 - padding

  const bytes = new Uint8Array(len)
  let byteIndex = 0

  for (let i = 0; i < cleanBase64.length; i += 4) {
    const enc1 = BASE64_CHARS.indexOf(cleanBase64[i]!)
    const enc2 = BASE64_CHARS.indexOf(cleanBase64[i + 1]!)
    const enc3 = BASE64_CHARS.indexOf(cleanBase64[i + 2]!)
    const enc4 = BASE64_CHARS.indexOf(cleanBase64[i + 3]!)

    const byte1 = (enc1 << 2) | (enc2 >> 4)
    const byte2 = ((enc2 & 15) << 4) | (enc3 >> 2)
    const byte3 = ((enc3 & 3) << 6) | enc4

    if (byteIndex < len) bytes[byteIndex++] = byte1
    if (byteIndex < len && enc3 !== -1) bytes[byteIndex++] = byte2
    if (byteIndex < len && enc4 !== -1) bytes[byteIndex++] = byte3
  }

  return bytes
}

/**
 * Encode string to base64 (replacement for btoa)
 * Handles UTF-8 strings properly
 */
export function stringToBase64(str: string): string {
  // Convert string to UTF-8 bytes first
  const bytes: number[] = []
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code < 0x80) {
      bytes.push(code)
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6))
      bytes.push(0x80 | (code & 0x3f))
    } else {
      bytes.push(0xe0 | (code >> 12))
      bytes.push(0x80 | ((code >> 6) & 0x3f))
      bytes.push(0x80 | (code & 0x3f))
    }
  }
  return uint8ArrayToBase64(new Uint8Array(bytes))
}

/**
 * Decode base64 to string (replacement for atob)
 * Handles UTF-8 strings properly
 */
export function base64ToString(base64: string): string {
  const bytes = base64ToUint8Array(base64)
  let result = ''
  let i = 0

  while (i < bytes.length) {
    const byte1 = bytes[i]!
    if (byte1 < 0x80) {
      result += String.fromCharCode(byte1)
      i++
    } else if ((byte1 & 0xe0) === 0xc0) {
      const byte2 = bytes[i + 1]!
      result += String.fromCharCode(((byte1 & 0x1f) << 6) | (byte2 & 0x3f))
      i += 2
    } else {
      const byte2 = bytes[i + 1]!
      const byte3 = bytes[i + 2]!
      result += String.fromCharCode(((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f))
      i += 3
    }
  }

  return result
}
