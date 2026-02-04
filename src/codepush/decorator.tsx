import React, { Component, ComponentType } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { CheckFrequency } from '../types/enums'
import type { SyncOptions } from '../types/package'
import type { CodePush } from './CodePush'

/**
 * Options for the codePush() HOC
 */
export interface CodePushOptions extends SyncOptions {
  /**
   * When to check for updates
   * @default CheckFrequency.ON_APP_START
   */
  checkFrequency?: CheckFrequency

  /**
   * Callback when sync status changes
   */
  onSyncStatusChanged?: (status: number) => void

  /**
   * Callback when sync encounters an error
   */
  onSyncError?: (error: Error) => void
}

/**
 * Higher-Order Component for automatic CodePush synchronization
 *
 * Wraps a React component and automatically checks for updates based on
 * the configured checkFrequency. Supports app lifecycle integration for
 * checking updates on app start or resume.
 *
 * @example
 * ```typescript
 * import { codePush, CheckFrequency, InstallMode } from '@bitrise/react-native-sdk'
 *
 * class App extends Component {
 *   render() {
 *     return (
 *       <View>
 *         <Text>My App</Text>
 *       </View>
 *     )
 *   }
 * }
 *
 * export default codePush({
 *   checkFrequency: CheckFrequency.ON_APP_RESUME,
 *   installMode: InstallMode.ON_NEXT_RESTART,
 *   onSyncStatusChanged: (status) => {
 *     console.log('Sync status:', status)
 *   }
 * })(App)
 * ```
 *
 * @param options - Configuration options for CodePush sync behavior
 * @returns A function that takes a component and returns a wrapped component
 */
export function codePush(options: CodePushOptions = {}) {
  const {
    checkFrequency = CheckFrequency.ON_APP_START,
    onSyncStatusChanged,
    onSyncError,
    ...syncOptions
  } = options

  return function <P extends object>(WrappedComponent: ComponentType<P>): ComponentType<P> {
    return class CodePushWrapper extends Component<P> {
      private appStateSubscription: { remove: () => void } | null = null
      private codePushInstance: CodePush | null = null

      async componentDidMount() {
        // Get CodePush instance from SDK
        try {
          // Import dynamically to avoid circular dependencies
          const { BitriseSDK } = await import('../core/BitriseSDK')
          this.codePushInstance = BitriseSDK.codePush
        } catch (error) {
          console.error('[CodePush] Failed to get CodePush instance:', error)
          if (onSyncError && error instanceof Error) {
            onSyncError(error)
          }
          return
        }

        // Sync on mount if configured
        if (
          checkFrequency === CheckFrequency.ON_APP_START ||
          checkFrequency === CheckFrequency.ON_APP_RESUME
        ) {
          this.syncUpdate()
        }

        // Listen for app state changes if configured
        if (checkFrequency === CheckFrequency.ON_APP_RESUME) {
          this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange)
        }
      }

      componentWillUnmount() {
        // Clean up app state listener
        if (this.appStateSubscription) {
          this.appStateSubscription.remove()
          this.appStateSubscription = null
        }
      }

      handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          this.syncUpdate()
        }
      }

      async syncUpdate() {
        if (!this.codePushInstance) {
          return
        }

        try {
          const status = await this.codePushInstance.sync(syncOptions)

          if (onSyncStatusChanged) {
            onSyncStatusChanged(status)
          }
        } catch (error) {
          console.error('[CodePush] Sync error:', error)

          if (onSyncError && error instanceof Error) {
            onSyncError(error)
          }
        }
      }

      render() {
        return <WrappedComponent {...this.props} />
      }
    }
  }
}
