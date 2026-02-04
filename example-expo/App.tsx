/**
 * Bitrise SDK for React Native - Expo Example
 *
 * This example demonstrates how to integrate the Bitrise SDK with CodePush
 * in an Expo managed workflow application.
 */

import React, { useEffect, useState } from 'react'
import {
  StyleSheet,
  Text,
  View,
  Button,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import {
  BitriseSDK,
  InstallMode,
  SyncStatus,
  UpdateStatus,
  type UpdateInfo,
  type DownloadProgress,
} from '@bitrise/react-native-sdk'

export default function App() {
  const [status, setStatus] = useState<string>('Initializing...')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<number>(0)
  const [isChecking, setIsChecking] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  // Add log entry
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 20))
  }

  useEffect(() => {
    initializeSDK()
  }, [])

  const initializeSDK = () => {
    try {
      // Configure SDK
      // Note: deploymentKey is automatically read from native config (injected by plugin)
      BitriseSDK.configure({
        apiToken: 'test-api-token', // Replace with your actual token
        appSlug: 'test-app-slug', // Replace with your actual app slug
        // deploymentKey is read from Info.plist/strings.xml automatically
      })

      addLog('SDK initialized successfully')
      setStatus('Ready')

      // Automatically check for updates on app start
      checkForUpdates()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      addLog(`Error initializing SDK: ${errorMessage}`)
      setStatus(`Error: ${errorMessage}`)
    }
  }

  const checkForUpdates = async () => {
    try {
      setIsChecking(true)
      setStatus('Checking for updates...')
      addLog('Checking for updates...')

      const update = await BitriseSDK.codePush.checkForUpdate()

      if (update) {
        setUpdateInfo(update)
        setStatus(`Update available: ${update.label}`)
        addLog(`Update found: ${update.label} (${update.description})`)
      } else {
        setUpdateInfo(null)
        setStatus('App is up to date')
        addLog('No updates available')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setStatus(`Error: ${errorMessage}`)
      addLog(`Error checking for updates: ${errorMessage}`)
    } finally {
      setIsChecking(false)
    }
  }

  const downloadUpdate = async () => {
    if (!updateInfo) return

    try {
      setStatus('Downloading update...')
      addLog(`Downloading update ${updateInfo.label}...`)

      await updateInfo.download((progress: DownloadProgress) => {
        const percent = Math.round((progress.receivedBytes / progress.totalBytes) * 100)
        setDownloadProgress(percent)
        setStatus(`Downloading: ${percent}%`)
      })

      setStatus('Update downloaded. Ready to install.')
      addLog('Update downloaded successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setStatus(`Download error: ${errorMessage}`)
      addLog(`Error downloading update: ${errorMessage}`)
    }
  }

  const installUpdate = async () => {
    if (!updateInfo) return

    try {
      setStatus('Installing update...')
      addLog('Installing update...')

      await BitriseSDK.codePush.notifyAppReady()
      await (updateInfo as any).install(InstallMode.IMMEDIATE)

      // This code won't execute as the app will restart
      setStatus('Update installed. Restarting...')
      addLog('Update installed. Restarting app...')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setStatus(`Install error: ${errorMessage}`)
      addLog(`Error installing update: ${errorMessage}`)
    }
  }

  const syncUpdate = async () => {
    try {
      setIsSyncing(true)
      setStatus('Syncing...')
      addLog('Starting sync...')

      const result = await BitriseSDK.codePush.sync({
        installMode: InstallMode.ON_NEXT_RESTART,
        updateDialog: {
          title: 'Update Available',
          optionalUpdateMessage: 'An update is available. Would you like to install it?',
          optionalInstallButtonLabel: 'Install',
          optionalIgnoreButtonLabel: 'Later',
        },
      })

      switch (result) {
        case SyncStatus.UP_TO_DATE:
          setStatus('App is up to date')
          addLog('Sync complete: App is up to date')
          break
        case SyncStatus.UPDATE_INSTALLED:
          setStatus('Update installed. Will apply on next restart.')
          addLog('Sync complete: Update installed')
          break
        case SyncStatus.UPDATE_IGNORED:
          setStatus('Update ignored by user')
          addLog('Sync complete: Update ignored')
          break
        case SyncStatus.UNKNOWN_ERROR:
          setStatus('Sync error occurred')
          addLog('Sync error: Unknown error')
          break
        default:
          setStatus(`Sync result: ${result}`)
          addLog(`Sync complete: ${result}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setStatus(`Sync error: ${errorMessage}`)
      addLog(`Sync error: ${errorMessage}`)
    } finally {
      setIsSyncing(false)
    }
  }

  const restartApp = () => {
    Alert.alert(
      'Restart App',
      'This will restart the application to apply pending updates.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restart',
          onPress: () => {
            addLog('Restarting app...')
            BitriseSDK.codePush.restartApp()
          },
        },
      ]
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      <View style={styles.header}>
        <Text style={styles.title}>Bitrise SDK - Expo Example</Text>
        <Text style={styles.version}>v1.0.0</Text>
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Status:</Text>
        <Text style={styles.statusText}>{status}</Text>
      </View>

      {updateInfo && (
        <View style={styles.updateInfoContainer}>
          <Text style={styles.updateInfoTitle}>Update Information</Text>
          <Text style={styles.updateInfoText}>Label: {updateInfo.label}</Text>
          <Text style={styles.updateInfoText}>Description: {updateInfo.description}</Text>
          <Text style={styles.updateInfoText}>
            Size: {(updateInfo.packageSize / 1024 / 1024).toFixed(2)} MB
          </Text>
          <Text style={styles.updateInfoText}>
            Mandatory: {updateInfo.isMandatory ? 'Yes' : 'No'}
          </Text>
          {downloadProgress > 0 && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: `${downloadProgress}%` }]} />
              <Text style={styles.progressText}>{downloadProgress}%</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.buttonContainer}>
        <Button
          title={isChecking ? 'Checking...' : 'Check for Updates'}
          onPress={checkForUpdates}
          disabled={isChecking || isSyncing}
        />

        {updateInfo && (
          <>
            <Button
              title="Download Update"
              onPress={downloadUpdate}
              disabled={isChecking || isSyncing}
            />
            <Button
              title="Install Update (Immediate)"
              onPress={installUpdate}
              disabled={isChecking || isSyncing}
            />
          </>
        )}

        <Button
          title={isSyncing ? 'Syncing...' : 'Sync (Auto)'}
          onPress={syncUpdate}
          disabled={isChecking || isSyncing}
        />

        <Button
          title="Restart App"
          onPress={restartApp}
          disabled={isChecking || isSyncing}
        />
      </View>

      <View style={styles.logsContainer}>
        <Text style={styles.logsTitle}>Activity Log</Text>
        <ScrollView style={styles.logsScroll}>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logText}>
              {log}
            </Text>
          ))}
        </ScrollView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 50,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#683D9F',
  },
  version: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  statusContainer: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    marginHorizontal: 20,
    borderRadius: 8,
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 5,
  },
  statusText: {
    fontSize: 16,
    color: '#333',
  },
  updateInfoContainer: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    marginHorizontal: 20,
    borderRadius: 8,
    marginBottom: 20,
  },
  updateInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 10,
  },
  updateInfoText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  progressContainer: {
    marginTop: 10,
    height: 30,
    backgroundColor: '#fff',
    borderRadius: 15,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4caf50',
  },
  progressText: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    textAlign: 'center',
    lineHeight: 30,
    fontWeight: 'bold',
    color: '#333',
  },
  buttonContainer: {
    marginHorizontal: 20,
    gap: 10,
  },
  logsContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
  },
  logsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  logsScroll: {
    flex: 1,
  },
  logText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
    fontFamily: 'monospace',
  },
})
