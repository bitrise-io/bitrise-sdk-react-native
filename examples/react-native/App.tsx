/**
 * Bitrise SDK for React Native - Bare React Native Example
 *
 * This example demonstrates how to integrate the Bitrise SDK with CodePush
 * in a bare React Native project (without Expo).
 */

import React, { useEffect, useState, useCallback } from 'react'
import { StyleSheet, Text, View, Button, ScrollView, Alert, Platform } from 'react-native'
import {
  BitriseSDK,
  InstallMode,
  SyncStatus,
  type UpdateInfo,
  type SyncStatusChangedCallback,
  type DownloadProgressCallback,
  type HandleBinaryVersionMismatchCallback,
  type RemotePackage,
} from '@bitrise/react-native-sdk'

// Status label mapping for display
const syncStatusLabels: Record<number, string> = {
  [SyncStatus.UP_TO_DATE]: 'Up to date',
  [SyncStatus.UPDATE_INSTALLED]: 'Update installed',
  [SyncStatus.UPDATE_IGNORED]: 'Update ignored',
  [SyncStatus.UNKNOWN_ERROR]: 'Unknown error',
  [SyncStatus.SYNC_IN_PROGRESS]: 'Sync in progress',
  [SyncStatus.CHECKING_FOR_UPDATE]: 'Checking for update...',
  [SyncStatus.AWAITING_USER_ACTION]: 'Awaiting user action',
  [SyncStatus.DOWNLOADING_PACKAGE]: 'Downloading...',
  [SyncStatus.INSTALLING_UPDATE]: 'Installing...',
}

export default function App() {
  const [status, setStatus] = useState<string>('Initializing...')
  const [_syncStatusValue, setSyncStatusValue] = useState<SyncStatus | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Logging helper
  const log = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 50))
    console.log(`[BitriseSDK] ${message}`)
  }, [])

  // Initialize SDK on mount
  useEffect(() => {
    initializeSDK()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const initializeSDK = () => {
    try {
      // Configure SDK
      // For bare RN, you must provide the deploymentKey explicitly
      // (Expo apps can read it from native config via the plugin)
      BitriseSDK.configure({
        apiToken: 'YOUR_API_TOKEN', // Replace with your actual token
        appSlug: 'YOUR_APP_SLUG', // Replace with your actual slug
        deploymentKey: 'YOUR_DEPLOYMENT_KEY', // Required for bare RN
        serverUrl: 'https://api.bitrise.io',
      })

      log('SDK configured successfully')
      setStatus('Ready')

      // Notify app is ready (important for update lifecycle)
      BitriseSDK.codePush.notifyAppReady()
      log('notifyAppReady() called')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      log(`Configuration error: ${message}`)
      setStatus(`Error: ${message}`)
    }
  }

  // Status callback for sync()
  const handleSyncStatusChange: SyncStatusChangedCallback = syncStatus => {
    setSyncStatusValue(syncStatus)
    log(`Sync status: ${syncStatusLabels[syncStatus] || syncStatus}`)
  }

  // Progress callback for downloads
  const handleDownloadProgress: DownloadProgressCallback = progressData => {
    const percent = Math.round((progressData.receivedBytes / progressData.totalBytes) * 100)
    setProgress(percent)
    log(`Download progress: ${percent}%`)
  }

  // Binary mismatch callback
  const handleBinaryMismatch: HandleBinaryVersionMismatchCallback = (
    remotePackage: RemotePackage
  ) => {
    log(`Binary mismatch! Update requires app version: ${remotePackage.appVersion}`)
    Alert.alert(
      'Update Available',
      `This update requires a newer version of the app (${remotePackage.appVersion}). Please update from the App Store.`
    )
  }

  // Full sync cycle with specific InstallMode
  const handleSync = async (installMode: InstallMode) => {
    setIsLoading(true)
    setProgress(0)
    log(`Starting sync with InstallMode: ${InstallMode[installMode]}`)

    try {
      const result = await BitriseSDK.codePush.sync(
        {
          installMode,
          mandatoryInstallMode: InstallMode.IMMEDIATE,
          updateDialog: {
            title: 'Update Available',
            optionalUpdateMessage: 'A new version is available. Would you like to install it?',
            mandatoryUpdateMessage: 'An important update is available and will be installed.',
            optionalInstallButtonLabel: 'Install',
            optionalIgnoreButtonLabel: 'Later',
            mandatoryContinueButtonLabel: 'Continue',
            appendReleaseDescription: true,
            descriptionPrefix: '\n\nRelease notes:\n',
          },
        },
        handleSyncStatusChange,
        handleDownloadProgress,
        handleBinaryMismatch
      )

      setStatus(syncStatusLabels[result] || `Sync result: ${result}`)
      log(`Sync completed: ${syncStatusLabels[result]}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      log(`Sync error: ${message}`)
      setStatus(`Error: ${message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Manual check for updates
  const handleCheckForUpdate = async () => {
    setIsLoading(true)
    log('Checking for updates...')

    try {
      const remotePackage = await BitriseSDK.codePush.checkForUpdate(
        undefined,
        handleBinaryMismatch
      )

      if (remotePackage) {
        setUpdateInfo(remotePackage)
        log(`Update available: ${remotePackage.label} (${remotePackage.packageSize} bytes)`)
        setStatus(`Update: ${remotePackage.label}`)
      } else {
        setUpdateInfo(null)
        log('No updates available')
        setStatus('Up to date')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      log(`Check error: ${message}`)
      setStatus(`Error: ${message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Manual download and install
  const handleDownloadAndInstall = async () => {
    if (!updateInfo) {
      return
    }

    setIsLoading(true)
    log('Downloading update...')

    try {
      const localPackage = await updateInfo.download(handleDownloadProgress)
      log('Download complete, installing...')

      await localPackage.install(InstallMode.ON_NEXT_RESTART)
      log('Update installed, will apply on next restart')
      setStatus('Update pending - restart to apply')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      log(`Install error: ${message}`)
      setStatus(`Error: ${message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Restart app
  const handleRestart = () => {
    Alert.alert('Restart App', 'This will restart the app to apply any pending updates.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restart',
        onPress: () => {
          log('Restarting app...')
          BitriseSDK.codePush.restartApp()
        },
      },
    ])
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bitrise SDK Example</Text>
        <Text style={styles.subtitle}>Bare React Native</Text>
        <Text style={styles.platform}>{Platform.OS} - v1.0.0</Text>
      </View>

      <View style={styles.statusBox}>
        <Text style={styles.statusLabel}>Status</Text>
        <Text style={styles.statusText}>{status}</Text>
        {progress > 0 && progress < 100 && (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Automatic Sync</Text>
        <View style={styles.buttonGroup}>
          <Button
            title="Sync (Immediate)"
            onPress={() => handleSync(InstallMode.IMMEDIATE)}
            disabled={isLoading}
          />
        </View>
        <View style={styles.buttonGroup}>
          <Button
            title="Sync (On Next Restart)"
            onPress={() => handleSync(InstallMode.ON_NEXT_RESTART)}
            disabled={isLoading}
          />
        </View>
        <View style={styles.buttonGroup}>
          <Button
            title="Sync (On Next Resume)"
            onPress={() => handleSync(InstallMode.ON_NEXT_RESUME)}
            disabled={isLoading}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manual Flow</Text>
        <View style={styles.buttonGroup}>
          <Button title="Check for Update" onPress={handleCheckForUpdate} disabled={isLoading} />
        </View>
        {updateInfo && (
          <>
            <View style={styles.updateInfo}>
              <Text style={styles.updateInfoText}>Label: {updateInfo.label}</Text>
              <Text style={styles.updateInfoText}>
                Size: {(updateInfo.packageSize / 1024).toFixed(1)} KB
              </Text>
              <Text style={styles.updateInfoText}>
                Mandatory: {updateInfo.isMandatory ? 'Yes' : 'No'}
              </Text>
            </View>
            <View style={styles.buttonGroup}>
              <Button
                title="Download & Install"
                onPress={handleDownloadAndInstall}
                disabled={isLoading}
              />
            </View>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Control</Text>
        <View style={styles.buttonGroup}>
          <Button title="Restart App" onPress={handleRestart} disabled={isLoading} />
        </View>
      </View>

      <View style={styles.logsSection}>
        <Text style={styles.sectionTitle}>Activity Log</Text>
        <ScrollView style={styles.logsContainer} nestedScrollEnabled>
          {logs.map((logEntry, index) => (
            <Text key={index} style={styles.logText}>
              {logEntry}
            </Text>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#683D9F',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#e0d0f0',
    marginTop: 4,
  },
  platform: {
    fontSize: 12,
    color: '#c0b0d0',
    marginTop: 8,
  },
  statusBox: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 8,
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    marginTop: 12,
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4caf50',
    borderRadius: 2,
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  buttonGroup: {
    marginBottom: 8,
  },
  updateInfo: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  updateInfoText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  logsSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 8,
    marginBottom: 32,
  },
  logsContainer: {
    maxHeight: 200,
  },
  logText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#666',
    marginBottom: 4,
  },
})
