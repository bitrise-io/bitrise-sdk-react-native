import { NativeModules, Platform } from 'react-native'

/**
 * Trigger native app restart
 * Uses DevSettings.reload() in development mode
 * Falls back to console warning if unavailable
 *
 * @example
 * ```typescript
 * restartApp() // Reloads the app in dev mode
 * ```
 */
export function restartApp(): void {
  try {
    const DevSettings = NativeModules.DevSettings

    if (DevSettings && typeof DevSettings.reload === 'function') {
      // Use DevSettings.reload() (works in dev mode)
      console.log('[CodePush] Restarting app via DevSettings...')
      DevSettings.reload()
      return
    }

    // Fallback: DevSettings not available (production build)
    console.warn(
      '[CodePush] Native restart not available in production. ' +
        'Please restart the app manually or reload from developer menu. ' +
        `Platform: ${Platform.OS}`
    )
  } catch (error) {
    console.error('[CodePush] Failed to trigger restart:', error)
  }
}
