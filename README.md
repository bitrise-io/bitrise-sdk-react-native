# Bitrise SDK for React Native

Lightweight React Native SDK for Bitrise Release Management with code push functionality.

## Features

- 🚀 Over-the-air updates via code push
- 📦 Minimal bundle size impact
- 🔄 Backward compatible with react-native-code-push
- ⚡ Support for Expo managed and bare workflows
- 🧪 Production-ready with comprehensive tests
- 📱 iOS and Android support

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
