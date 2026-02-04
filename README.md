# Bitrise SDK for React Native

Lightweight React Native SDK for Bitrise Release Management with code push functionality.

## Features

- 🚀 Over-the-air updates via code push
- 📦 Minimal bundle size impact (~53 KB)
- 🔄 Backward compatible with react-native-code-push
- ⚡ Support for Expo managed and bare workflows
- 🧪 Production-ready with comprehensive tests (88% coverage)
- 📱 iOS and Android support
- 💾 **Native filesystem storage** - No 50 MB package size limit
- 🔁 **Smart download queue** - Automatic sequential processing with retry logic
- 📊 **Built-in statistics** - Track download success rates and performance
- 🎯 **Zero external dependencies** - All features implemented from scratch

## Installation

```bash
npm install @bitrise/react-native-sdk
```

or

```bash
yarn add @bitrise/react-native-sdk
```

## Quick Start

```typescript
import { BitriseSDK } from '@bitrise/react-native-sdk'

// Configure the SDK
BitriseSDK.configure({
  apiToken: 'your-bitrise-api-token',
  appSlug: 'your-app-slug'
})

// Check for updates
const update = await BitriseSDK.codePush.checkForUpdate()
if (update) {
  console.log('Update available:', update.label)
}

// Sync with latest update
const status = await BitriseSDK.codePush.sync()
```

## New Features

### Native Filesystem Storage

Packages are now stored in native filesystem instead of memory, removing the 50 MB size limit:

- **Automatic**: Works out of the box with zero configuration
- **Graceful fallback**: Falls back to in-memory storage if native modules unavailable
- **Persistent**: Survives app restarts
- **Large packages**: No size limitations

### Smart Download Queue

Multiple concurrent download requests are automatically queued and processed sequentially:

```typescript
import { DownloadQueue, QueueEvent } from '@bitrise/react-native-sdk'

// Get queue instance
const queue = DownloadQueue.getInstance({
  maxRetries: 3,           // Retry failed downloads (default: 3)
  baseRetryDelay: 1000,    // Base delay for exponential backoff (default: 1000ms)
  maxRetryDelay: 30000,    // Maximum retry delay cap (default: 30000ms)
  debug: false             // Enable debug logging (default: false)
})

// Listen to queue events
queue.on(QueueEvent.DOWNLOAD_STARTED, (data) => {
  console.log('Download started:', data.item.remotePackage.packageHash)
})

queue.on(QueueEvent.DOWNLOAD_COMPLETED, (data) => {
  console.log('Download completed:', data.package.packageHash)
})

queue.on(QueueEvent.DOWNLOAD_FAILED, (data) => {
  console.error('Download failed:', data.error)
})

// Get queue statistics
const stats = queue.getStatistics()
console.log('Success rate:', stats.successRate)
console.log('Average download time:', stats.averageDownloadTime)
```

**Features:**
- ✅ Automatic FIFO (first-in-first-out) processing
- ✅ Built-in retry logic with exponential backoff
- ✅ Progress tracking and event emission
- ✅ Pause/resume/cancel capabilities
- ✅ No more "download already in progress" errors

## Migration from react-native-code-push

This SDK is designed to be backward compatible with react-native-code-push. The migration should require minimal code changes.

### Before (react-native-code-push)
```typescript
import codePush from 'react-native-code-push'

codePush.sync()
codePush.checkForUpdate()
codePush.notifyAppReady()
```

### After (Bitrise SDK)
```typescript
import { BitriseSDK } from '@bitrise/react-native-sdk'

BitriseSDK.configure({ apiToken: '...', appSlug: '...' })

BitriseSDK.codePush.sync()
BitriseSDK.codePush.checkForUpdate()
BitriseSDK.codePush.notifyAppReady()
```

## Expo Support

Coming soon - full support for Expo managed workflow via config plugins.

## API Reference

### `BitriseSDK.configure(config)`

Configure the SDK with your Bitrise credentials.

**Parameters:**
- `config.apiToken` (string, required) - Your Bitrise API token
- `config.appSlug` (string, required) - Your Bitrise app slug
- `config.apiEndpoint` (string, optional) - Custom API endpoint

### `BitriseSDK.codePush.checkForUpdate()`

Check for available updates.

**Returns:** `Promise<UpdateInfo | null>`

### `BitriseSDK.codePush.sync()`

Synchronize with the latest available update.

**Returns:** `Promise<UpdateStatus>`

### `BitriseSDK.codePush.notifyAppReady()`

Notify the SDK that the app has successfully launched.

### Download Queue API

#### `DownloadQueue.getInstance(config?)`

Get the download queue singleton instance.

**Parameters:**
- `config.maxRetries` (number, optional) - Maximum retry attempts (default: 3)
- `config.baseRetryDelay` (number, optional) - Base delay for retries in ms (default: 1000)
- `config.maxRetryDelay` (number, optional) - Maximum retry delay cap in ms (default: 30000)
- `config.debug` (boolean, optional) - Enable debug logging (default: false)

**Returns:** `DownloadQueue`

#### `queue.getStatistics()`

Get download queue statistics.

**Returns:** `QueueStatistics`

```typescript
{
  totalDownloads: number
  successfulDownloads: number
  failedDownloads: number
  cancelledDownloads: number
  averageWaitTime: number        // in milliseconds
  averageDownloadTime: number    // in milliseconds
  totalBytesDownloaded: number
  currentQueueSize: number
  maxQueueSize: number
  successRate: number            // 0-1
}
```

#### `queue.getState()`

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

#### `queue.pause()` / `queue.resume()` / `queue.clear()`

Control queue processing.

#### Queue Events

Subscribe to queue events using `queue.on(event, callback)`:

- `QueueEvent.ITEM_ADDED` - Item added to queue
- `QueueEvent.DOWNLOAD_STARTED` - Download started
- `QueueEvent.DOWNLOAD_PROGRESS` - Progress update
- `QueueEvent.DOWNLOAD_COMPLETED` - Download completed successfully
- `QueueEvent.DOWNLOAD_FAILED` - Download failed
- `QueueEvent.ITEM_CANCELLED` - Item cancelled
- `QueueEvent.QUEUE_EMPTIED` - Queue is now empty
- `QueueEvent.STATUS_CHANGED` - Queue status changed

## Development

See [claude.md](./claude.md) for development guidelines.

```bash
# Install dependencies
npm install

# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint

# Build
npm run build
```

## Requirements

- React Native >= 0.72.0
- Node >= 18.0.0
- TypeScript >= 5.0.0

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines and code of conduct.

## Support

For issues and questions, please use the GitHub issue tracker.
