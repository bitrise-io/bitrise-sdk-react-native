import { NativeModules, Platform } from 'react-native'

/**
 * Native module interface for app restart
 */
interface RestartNativeModule {
  restart(): void
}

/**
 * Get the native restart module if available
 */
function getNativeRestartModule(): RestartNativeModule | null {
  // Try BitriseRestart module first (production)
  const BitriseRestart = NativeModules.BitriseRestart as RestartNativeModule | undefined
  if (BitriseRestart && typeof BitriseRestart.restart === 'function') {
    return BitriseRestart
  }
  return null
}

/**
 * Check if native restart is available for production
 */
export function isRestartAvailable(): boolean {
  // Check for native restart module
  if (getNativeRestartModule()) {
    return true
  }

  // Check for DevSettings (development mode)
  const DevSettings = NativeModules.DevSettings
  return DevSettings && typeof DevSettings.reload === 'function'
}

/**
 * Trigger native app restart
 * Uses BitriseRestart native module in production, DevSettings.reload() in development
 * Falls back to console warning if unavailable
 *
 * @example
 * ```typescript
 * restartApp() // Reloads the app
 * ```
 */
export function restartApp(): void {
  try {
    // Try native restart module first (works in production)
    const nativeModule = getNativeRestartModule()
    if (nativeModule) {
      console.log('[CodePush] Restarting app via native module...')
      nativeModule.restart()
      return
    }

    // Fall back to DevSettings.reload() (development only)
    const DevSettings = NativeModules.DevSettings
    if (DevSettings && typeof DevSettings.reload === 'function') {
      console.log('[CodePush] Restarting app via DevSettings...')
      DevSettings.reload()
      return
    }

    // No restart method available
    console.warn(
      '[CodePush] Native restart not available. ' +
        'To enable restart in production, ensure BitriseRestart native module is linked. ' +
        `Platform: ${Platform.OS}`
    )
  } catch (error) {
    console.error('[CodePush] Failed to trigger restart:', error)
  }
}

/**
 * Restart the app only if an update is pending
 * This is a convenience method that combines pending check with restart
 *
 * @param hasPendingUpdate - Function that returns whether an update is pending
 */
export async function restartIfPending(hasPendingUpdate: () => Promise<boolean>): Promise<void> {
  try {
    const isPending = await hasPendingUpdate()
    if (isPending) {
      restartApp()
    }
  } catch (error) {
    console.error('[CodePush] Failed to check for pending update:', error)
  }
}
