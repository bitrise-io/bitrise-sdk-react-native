# API Reference

Complete API documentation for the Bitrise SDK for React Native.

## BitriseSDK

Main entry point for the SDK.

### `BitriseSDK.configure(config)`

Initialize the SDK with your Bitrise credentials.

```typescript
BitriseSDK.configure({
  apiToken: 'your-api-token',
  appSlug: 'your-app-slug',
  apiEndpoint: 'https://api.bitrise.io' // optional
})
```

**Parameters:**
- `apiToken` (string, required) - Your Bitrise API token
- `appSlug` (string, required) - Your Bitrise app slug
- `apiEndpoint` (string, optional) - Custom API endpoint

### `BitriseSDK.codePush`

Access the CodePush interface. See [CodePush](#codepush) section.

### `BitriseSDK.getConfig()`

Get the current SDK configuration.

**Returns:** `BitriseConfig`

---

## CodePush

Core update functionality, accessed via `BitriseSDK.codePush`.

### `checkForUpdate(deploymentKey?, handleBinaryVersionMismatchCallback?)`

Check for available updates.

```typescript
const update = await BitriseSDK.codePush.checkForUpdate()
if (update) {
  console.log('Update available:', update.label)
}
```

**Parameters:**
- `deploymentKey` (string, optional) - Override configured deployment key
- `handleBinaryVersionMismatchCallback` (function, optional) - Called when update requires newer native binary

**Returns:** `Promise<RemotePackage | null>`

### `sync(options?, syncStatusChangedCallback?, downloadProgressCallback?, handleBinaryVersionMismatchCallback?)`

Check for updates and install if available.

```typescript
const status = await BitriseSDK.codePush.sync({
  installMode: InstallMode.ON_NEXT_RESTART,
  updateDialog: true
})
```

**Parameters:**
- `options` (SyncOptions, optional) - Sync configuration
- `syncStatusChangedCallback` (function, optional) - Called when sync status changes
- `downloadProgressCallback` (function, optional) - Called during download with progress
- `handleBinaryVersionMismatchCallback` (function, optional) - Called for binary mismatch

**Returns:** `Promise<SyncStatus>`

### `notifyAppReady()`

Notify that the update was applied successfully. Required when using manual install modes.

```typescript
BitriseSDK.codePush.notifyAppReady()
```

### `getUpdateMetadata(updateState?)`

Get metadata about the currently installed update.

**Parameters:**
- `updateState` (UpdateState, optional) - Filter by update state

**Returns:** `Promise<Package | null>`

### `restartApp(onlyIfUpdateIsPending?)`

Restart the app, optionally only if an update is pending.

**Parameters:**
- `onlyIfUpdateIsPending` (boolean, optional) - Only restart if update pending

### `allowRestart()` / `disallowRestart()`

Control automatic restarts during critical operations.

```typescript
BitriseSDK.codePush.disallowRestart()
// ... perform critical operation
BitriseSDK.codePush.allowRestart()
```

### `clearUpdates()`

Clear all pending updates.

**Returns:** `Promise<void>`

### `getConfiguration()`

Get current CodePush configuration.

**Returns:** `Configuration`

---

## codePush (HOC)

Higher-order component for automatic sync.

```typescript
import { codePush, CheckFrequency, InstallMode } from '@bitrise/react-native-sdk'

const App = () => <View>...</View>

export default codePush({
  checkFrequency: CheckFrequency.ON_APP_RESUME,
  installMode: InstallMode.ON_NEXT_RESTART
})(App)
```

**Options:**
- `checkFrequency` - When to check for updates
- `installMode` - How to install optional updates
- `mandatoryInstallMode` - How to install mandatory updates
- `minimumBackgroundDuration` - Minimum background time before applying
- `updateDialog` - Dialog configuration or false to disable

---

## DownloadQueue

Manages concurrent download requests with automatic queuing.

### `DownloadQueue.getInstance(config?)`

Get the singleton queue instance.

```typescript
const queue = DownloadQueue.getInstance({
  maxRetries: 3,
  baseRetryDelay: 1000,
  maxRetryDelay: 30000,
  debug: false
})
```

**Parameters:**
- `maxRetries` (number, optional) - Maximum retry attempts (default: 3)
- `baseRetryDelay` (number, optional) - Base delay for retries in ms (default: 1000)
- `maxRetryDelay` (number, optional) - Maximum retry delay cap in ms (default: 30000)
- `debug` (boolean, optional) - Enable debug logging (default: false)

### `enqueue(remotePackage, progressCallback?)`

Add a package to the download queue.

**Returns:** `Promise<LocalPackage>`

### `getStatistics()`

Get queue performance statistics.

**Returns:** `QueueStatistics`

```typescript
{
  totalDownloads: number
  successfulDownloads: number
  failedDownloads: number
  cancelledDownloads: number
  averageWaitTime: number        // milliseconds
  averageDownloadTime: number    // milliseconds
  totalBytesDownloaded: number
  currentQueueSize: number
  maxQueueSize: number
  successRate: number            // 0-1
}
```

### `getState()`

Get current queue state.

**Returns:** `QueueState`

```typescript
{
  status: 'idle' | 'downloading' | 'paused'
  currentItem: QueueItem | null
  queuedItems: QueueItem[]
  totalItems: number
}
```

### `pause()` / `resume()` / `clear()`

Control queue processing.

### `on(event, callback)`

Subscribe to queue events.

```typescript
queue.on(QueueEvent.DOWNLOAD_COMPLETED, (data) => {
  console.log('Downloaded:', data.package.label)
})
```

---

## Enums

### InstallMode

When to apply updates.

| Value | Code | Description |
|-------|------|-------------|
| `IMMEDIATE` | 0 | Install and restart immediately |
| `ON_NEXT_RESTART` | 1 | Install, apply on next restart |
| `ON_NEXT_RESUME` | 2 | Install, apply when app resumes |
| `ON_NEXT_SUSPEND` | 3 | Install, apply when app suspends |

### SyncStatus

Status codes from `sync()`.

| Value | Code | Description |
|-------|------|-------------|
| `UP_TO_DATE` | 0 | No update available |
| `UPDATE_INSTALLED` | 1 | Update downloaded and installed |
| `UPDATE_IGNORED` | 2 | User chose to ignore update |
| `UNKNOWN_ERROR` | 3 | Error during sync |
| `SYNC_IN_PROGRESS` | 4 | Sync already running |
| `CHECKING_FOR_UPDATE` | 5 | Checking server for update |
| `AWAITING_USER_ACTION` | 6 | Waiting for user response |
| `DOWNLOADING_PACKAGE` | 7 | Downloading update package |
| `INSTALLING_UPDATE` | 8 | Installing downloaded update |

### UpdateState

Package state for `getUpdateMetadata()`.

| Value | Code | Description |
|-------|------|-------------|
| `RUNNING` | 0 | Update is currently running |
| `PENDING` | 1 | Update installed, awaiting restart |
| `LATEST` | 2 | Latest available update |

### CheckFrequency

For the codePush HOC.

| Value | Code | Description |
|-------|------|-------------|
| `ON_APP_START` | 0 | Check only on app start |
| `ON_APP_RESUME` | 1 | Check on start and resume |
| `MANUAL` | 2 | Never check automatically |

### QueueEvent

Download queue events.

| Value | Description |
|-------|-------------|
| `ITEM_ADDED` | Item added to queue |
| `DOWNLOAD_STARTED` | Download began |
| `DOWNLOAD_PROGRESS` | Progress update |
| `DOWNLOAD_COMPLETED` | Download succeeded |
| `DOWNLOAD_FAILED` | Download failed |
| `ITEM_CANCELLED` | Item was cancelled |
| `QUEUE_EMPTIED` | Queue is empty |
| `STATUS_CHANGED` | Queue status changed |

---

## Types

### Package

Base package information.

```typescript
interface Package {
  appVersion: string
  deploymentKey: string
  description: string
  failedInstall: boolean
  isFirstRun: boolean
  isMandatory: boolean
  isPending: boolean
  label: string
  packageHash: string
  packageSize: number
}
```

### RemotePackage

Package available for download (extends Package).

```typescript
interface RemotePackage extends Package {
  downloadUrl: string
  diffUrl?: string
  diffSize?: number
  download(progressCallback?): Promise<LocalPackage>
}
```

### LocalPackage

Downloaded package ready to install (extends Package).

```typescript
interface LocalPackage extends Package {
  localPath: string
  install(installMode?, minimumBackgroundDuration?): Promise<void>
}
```

### DownloadProgress

```typescript
interface DownloadProgress {
  receivedBytes: number
  totalBytes: number
}
```

### SyncOptions

```typescript
interface SyncOptions {
  deploymentKey?: string
  installMode?: InstallMode
  mandatoryInstallMode?: InstallMode
  minimumBackgroundDuration?: number
  updateDialog?: UpdateDialogOptions | boolean
  rollbackRetryOptions?: RollbackRetryOptions
  ignoreFailedUpdates?: boolean
  syncTimeoutMs?: number  // default: 300000 (5 min)
}
```

### UpdateDialogOptions

```typescript
interface UpdateDialogOptions {
  title?: string
  optionalUpdateMessage?: string
  mandatoryUpdateMessage?: string
  optionalInstallButtonLabel?: string
  mandatoryContinueButtonLabel?: string
  optionalIgnoreButtonLabel?: string
  appendReleaseDescription?: boolean
  descriptionPrefix?: string
}
```

---

## Error Classes

All errors extend `BitriseError` with `code` and `details` properties.

| Class | Code | Description |
|-------|------|-------------|
| `BitriseError` | varies | Base error class |
| `ConfigurationError` | `CONFIGURATION_ERROR` | Invalid configuration |
| `NetworkError` | `NETWORK_ERROR` | Network request failed |
| `UpdateError` | `UPDATE_ERROR` | Update operation failed |
| `FileSystemError` | `FILESYSTEM_ERROR` | File operation failed |
| `TimeoutError` | `TIMEOUT_ERROR` | Operation timed out |
| `QueueError` | `QUEUE_ERROR` | Queue operation failed |
| `QueueFullError` | `QUEUE_FULL` | Queue capacity exceeded |
| `DownloadTimeoutError` | `DOWNLOAD_TIMEOUT` | Download timed out |

**Example:**

```typescript
import { NetworkError } from '@bitrise/react-native-sdk'

try {
  await BitriseSDK.codePush.sync()
} catch (error) {
  if (error instanceof NetworkError) {
    console.log('Network issue:', error.code, error.details)
  }
}
```
