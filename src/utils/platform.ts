import { Platform, NativeModules } from 'react-native'

/**
 * Cached app version (set during SDK initialization)
 */
let cachedAppVersion: string | null = null

/**
 * Get the native app version
 * Returns version set via setAppVersion() or attempts to read from native modules
 * Falls back to '1.0.0' if unavailable
 *
 * Best practice: Call setAppVersion() during app initialization with the actual version
 *
 * @returns App version string (e.g., "1.2.3")
 *
 * @example
 * ```typescript
 * // Set version during initialization
 * setAppVersion('1.2.3')
 *
 * // Later, retrieve it
 * const version = getAppVersion() // "1.2.3"
 * ```
 */
export function getAppVersion(): string {
  // Return cached version if set
  if (cachedAppVersion) {
    return cachedAppVersion
  }

  try {
    // Attempt to get version from native DeviceInfo module (if installed by host app)
    const { PlatformConstants } = NativeModules
    if (PlatformConstants && typeof PlatformConstants.appVersion === 'string') {
      const version = PlatformConstants.appVersion
      cachedAppVersion = version
      return version
    }

    // iOS: Try to get from RCTDeviceInfo
    if (Platform.OS === 'ios') {
      const { RCTDeviceInfo } = NativeModules
      if (RCTDeviceInfo && typeof RCTDeviceInfo.appVersion === 'string') {
        const version = RCTDeviceInfo.appVersion
        cachedAppVersion = version
        return version
      }
    }

    // Android: Try Platform.constants
    if (Platform.OS === 'android' && Platform.constants) {
      const constants = Platform.constants as any
      if (constants.Version) {
        // This is Android API version, not app version, so skip
      }
    }
  } catch (error) {
    console.warn('[CodePush] Failed to get app version from native modules:', error)
  }

  // Fallback: Return default version
  // In production, app should call setAppVersion() during initialization
  return '1.0.0'
}

/**
 * Set the app version manually
 * Should be called during app initialization with the actual app version
 *
 * @param version - App version string (e.g., "1.2.3")
 *
 * @example
 * ```typescript
 * // In your app's initialization code:
 * import { setAppVersion } from '@bitrise/react-native-sdk'
 * setAppVersion('1.2.3')
 * ```
 */
export function setAppVersion(version: string): void {
  if (!version || typeof version !== 'string') {
    console.warn('[CodePush] Invalid app version provided:', version)
    return
  }
  cachedAppVersion = version
  console.log('[CodePush] App version set to:', version)
}

/**
 * Get the platform name
 */
export function getPlatform(): 'ios' | 'android' {
  return Platform.OS === 'ios' ? 'ios' : 'android'
}

/**
 * Check if running on iOS
 */
export function isIOS(): boolean {
  return Platform.OS === 'ios'
}

/**
 * Check if running on Android
 */
export function isAndroid(): boolean {
  return Platform.OS === 'android'
}
