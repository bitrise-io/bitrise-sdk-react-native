/**
 * Text encoding/decoding utilities for React Native
 * React Native doesn't have TextEncoder/TextDecoder by default
 */

/**
 * Encode a string to UTF-8 bytes
 * Uses TextEncoder if available, falls back to manual implementation
 */
export function encodeText(text: string): Uint8Array {
  // Try native TextEncoder first
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text)
  }

  // Manual UTF-8 encoding for React Native
  const bytes: number[] = []
  for (let i = 0; i < text.length; i++) {
    let charCode = text.charCodeAt(i)

    // Handle surrogate pairs for characters outside BMP
    if (charCode >= 0xd800 && charCode <= 0xdbff && i + 1 < text.length) {
      const nextCharCode = text.charCodeAt(i + 1)
      if (nextCharCode >= 0xdc00 && nextCharCode <= 0xdfff) {
        charCode = ((charCode - 0xd800) << 10) + (nextCharCode - 0xdc00) + 0x10000
        i++
      }
    }

    if (charCode < 0x80) {
      bytes.push(charCode)
    } else if (charCode < 0x800) {
      bytes.push(0xc0 | (charCode >> 6))
      bytes.push(0x80 | (charCode & 0x3f))
    } else if (charCode < 0x10000) {
      bytes.push(0xe0 | (charCode >> 12))
      bytes.push(0x80 | ((charCode >> 6) & 0x3f))
      bytes.push(0x80 | (charCode & 0x3f))
    } else {
      bytes.push(0xf0 | (charCode >> 18))
      bytes.push(0x80 | ((charCode >> 12) & 0x3f))
      bytes.push(0x80 | ((charCode >> 6) & 0x3f))
      bytes.push(0x80 | (charCode & 0x3f))
    }
  }

  return new Uint8Array(bytes)
}

/**
 * Decode UTF-8 bytes to a string
 * Uses TextDecoder if available, falls back to manual implementation
 */
export function decodeText(bytes: Uint8Array): string {
  // Try native TextDecoder first
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(bytes)
  }

  // Manual UTF-8 decoding for React Native
  let result = ''
  let i = 0

  while (i < bytes.length) {
    const byte1 = bytes[i]!

    if (byte1 < 0x80) {
      result += String.fromCharCode(byte1)
      i++
    } else if ((byte1 & 0xe0) === 0xc0) {
      const byte2 = bytes[i + 1]!
      const charCode = ((byte1 & 0x1f) << 6) | (byte2 & 0x3f)
      result += String.fromCharCode(charCode)
      i += 2
    } else if ((byte1 & 0xf0) === 0xe0) {
      const byte2 = bytes[i + 1]!
      const byte3 = bytes[i + 2]!
      const charCode = ((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f)
      result += String.fromCharCode(charCode)
      i += 3
    } else if ((byte1 & 0xf8) === 0xf0) {
      const byte2 = bytes[i + 1]!
      const byte3 = bytes[i + 2]!
      const byte4 = bytes[i + 3]!
      let charCode =
        ((byte1 & 0x07) << 18) | ((byte2 & 0x3f) << 12) | ((byte3 & 0x3f) << 6) | (byte4 & 0x3f)
      // Convert to surrogate pair
      charCode -= 0x10000
      result += String.fromCharCode(0xd800 + (charCode >> 10), 0xdc00 + (charCode & 0x3ff))
      i += 4
    } else {
      // Invalid UTF-8, skip byte
      i++
    }
  }

  return result
}
