import { Platform } from 'react-native'

/**
 * Get the native app version
 * This should match the version in Info.plist (iOS) or build.gradle (Android)
 */
export function getAppVersion(): string {
  // TODO: Get actual version from native modules
  // For now, return a placeholder
  // In production, this should use react-native-device-info or a native module
  return '1.0.0'
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
