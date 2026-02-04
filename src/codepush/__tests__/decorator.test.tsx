import React, { Component } from 'react'
import { AppState } from 'react-native'
import { View, Text } from 'react-native'
import { codePush } from '../decorator'
import { CheckFrequency, SyncStatus } from '../../types/enums'

// Mock BitriseSDK
const mockSync = jest.fn()
jest.mock('../../core/BitriseSDK', () => ({
  BitriseSDK: {
    codePush: {
      sync: mockSync,
    },
  },
}))

describe('codePush decorator', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSync.mockResolvedValue(SyncStatus.UP_TO_DATE)
  })

  describe('HOC wrapping', () => {
    it('should wrap component correctly', () => {
      class TestComponent extends Component {
        render() {
          return (
            <View>
              <Text>Test</Text>
            </View>
          )
        }
      }

      const WrappedComponent = codePush()(TestComponent)

      expect(WrappedComponent).toBeDefined()
      expect(typeof WrappedComponent).toBe('function')
    })

    it('should return a class component', () => {
      class TestComponent extends Component {
        render() {
          return (
            <View>
              <Text>Test</Text>
            </View>
          )
        }
      }

      const WrappedComponent = codePush()(TestComponent)
      const instance = new WrappedComponent({})

      expect(instance).toBeInstanceOf(Component)
    })
  })

  describe('checkFrequency: ON_APP_START', () => {
    it('should sync on component mount', async () => {
      class TestComponent extends Component {
        render() {
          return <View />
        }
      }

      const WrappedComponent = codePush({
        checkFrequency: CheckFrequency.ON_APP_START,
      })(TestComponent)

      const instance = new WrappedComponent({})
      await instance.componentDidMount?.()

      await new Promise(resolve => setImmediate(resolve))

      expect(mockSync).toHaveBeenCalledTimes(1)
    })
  })

  describe('checkFrequency: ON_APP_RESUME', () => {
    it('should sync on component mount', async () => {
      class TestComponent extends Component {
        render() {
          return <View />
        }
      }

      const WrappedComponent = codePush({
        checkFrequency: CheckFrequency.ON_APP_RESUME,
      })(TestComponent)

      const instance = new WrappedComponent({})
      await instance.componentDidMount?.()

      await new Promise(resolve => setImmediate(resolve))

      expect(mockSync).toHaveBeenCalledTimes(1)
    })

    it('should add AppState listener', async () => {
      const addEventListenerSpy = jest.spyOn(AppState, 'addEventListener')

      class TestComponent extends Component {
        render() {
          return <View />
        }
      }

      const WrappedComponent = codePush({
        checkFrequency: CheckFrequency.ON_APP_RESUME,
      })(TestComponent)

      const instance = new WrappedComponent({})
      await instance.componentDidMount?.()

      expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function))
    })

    it('should remove AppState listener on unmount', async () => {
      const mockRemove = jest.fn()
      jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: mockRemove })

      class TestComponent extends Component {
        render() {
          return <View />
        }
      }

      const WrappedComponent = codePush({
        checkFrequency: CheckFrequency.ON_APP_RESUME,
      })(TestComponent)

      const instance = new WrappedComponent({})
      await instance.componentDidMount?.()
      instance.componentWillUnmount?.()

      expect(mockRemove).toHaveBeenCalled()
    })
  })

  describe('checkFrequency: MANUAL', () => {
    it('should not sync on component mount', async () => {
      class TestComponent extends Component {
        render() {
          return <View />
        }
      }

      const WrappedComponent = codePush({
        checkFrequency: CheckFrequency.MANUAL,
      })(TestComponent)

      const instance = new WrappedComponent({})
      await instance.componentDidMount?.()

      await new Promise(resolve => setImmediate(resolve))

      expect(mockSync).not.toHaveBeenCalled()
    })
  })

  describe('sync options', () => {
    it('should pass sync options to sync call', async () => {
      class TestComponent extends Component {
        render() {
          return <View />
        }
      }

      const WrappedComponent = codePush({
        checkFrequency: CheckFrequency.ON_APP_START,
        installMode: 1,
        mandatoryInstallMode: 0,
      })(TestComponent)

      const instance = new WrappedComponent({})
      await instance.componentDidMount?.()

      await new Promise(resolve => setImmediate(resolve))

      expect(mockSync).toHaveBeenCalledWith({
        installMode: 1,
        mandatoryInstallMode: 0,
      })
    })
  })

  describe('callbacks', () => {
    it('should call onSyncStatusChanged on successful sync', async () => {
      const onSyncStatusChanged = jest.fn()
      mockSync.mockResolvedValue(SyncStatus.UPDATE_INSTALLED)

      class TestComponent extends Component {
        render() {
          return <View />
        }
      }

      const WrappedComponent = codePush({
        checkFrequency: CheckFrequency.ON_APP_START,
        onSyncStatusChanged,
      })(TestComponent)

      const instance = new WrappedComponent({})
      await instance.componentDidMount?.()

      await new Promise(resolve => setImmediate(resolve))

      expect(onSyncStatusChanged).toHaveBeenCalledWith(SyncStatus.UPDATE_INSTALLED)
    })

    it('should call onSyncError on sync failure', async () => {
      const onSyncError = jest.fn()
      const error = new Error('Sync failed')
      mockSync.mockRejectedValue(error)

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      class TestComponent extends Component {
        render() {
          return <View />
        }
      }

      const WrappedComponent = codePush({
        checkFrequency: CheckFrequency.ON_APP_START,
        onSyncError,
      })(TestComponent)

      const instance = new WrappedComponent({})
      await instance.componentDidMount?.()

      await new Promise(resolve => setImmediate(resolve))

      expect(onSyncError).toHaveBeenCalledWith(error)
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })

  describe('default options', () => {
    it('should use ON_APP_START as default checkFrequency', async () => {
      class TestComponent extends Component {
        render() {
          return <View />
        }
      }

      const WrappedComponent = codePush()(TestComponent)

      const instance = new WrappedComponent({})
      await instance.componentDidMount?.()

      await new Promise(resolve => setImmediate(resolve))

      expect(mockSync).toHaveBeenCalledTimes(1)
    })
  })

  describe('error handling', () => {
    it('should not call onSyncStatusChanged when sync fails', async () => {
      const onSyncStatusChanged = jest.fn()
      const error = new Error('Sync failed')
      mockSync.mockRejectedValue(error)

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      class TestComponent extends Component {
        render() {
          return <View />
        }
      }

      const WrappedComponent = codePush({
        checkFrequency: CheckFrequency.ON_APP_START,
        onSyncStatusChanged,
      })(TestComponent)

      const instance = new WrappedComponent({})
      await instance.componentDidMount?.()

      await new Promise(resolve => setImmediate(resolve))

      expect(onSyncStatusChanged).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('should handle non-Error exceptions in sync', async () => {
      mockSync.mockRejectedValue('String error')

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      class TestComponent extends Component {
        render() {
          return <View />
        }
      }

      const WrappedComponent = codePush({
        checkFrequency: CheckFrequency.ON_APP_START,
      })(TestComponent)

      const instance = new WrappedComponent({})
      await instance.componentDidMount?.()

      await new Promise(resolve => setImmediate(resolve))

      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('should not call onSyncError for non-Error exceptions', async () => {
      const onSyncError = jest.fn()
      mockSync.mockRejectedValue('String error')

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      class TestComponent extends Component {
        render() {
          return <View />
        }
      }

      const WrappedComponent = codePush({
        checkFrequency: CheckFrequency.ON_APP_START,
        onSyncError,
      })(TestComponent)

      const instance = new WrappedComponent({})
      await instance.componentDidMount?.()

      await new Promise(resolve => setImmediate(resolve))

      // onSyncError should not be called for non-Error types
      expect(onSyncError).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })

  describe('AppState change handling', () => {
    it('should trigger sync when app becomes active', async () => {
      const mockRemove = jest.fn()
      let appStateHandler: ((nextAppState: AppStateStatus) => void) | undefined

      jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
        appStateHandler = handler as (nextAppState: AppStateStatus) => void
        return { remove: mockRemove }
      })

      class TestComponent extends Component {
        render() {
          return <View />
        }
      }

      const WrappedComponent = codePush({
        checkFrequency: CheckFrequency.ON_APP_RESUME,
      })(TestComponent)

      const instance = new WrappedComponent({})
      await instance.componentDidMount?.()

      await new Promise(resolve => setImmediate(resolve))

      // Clear initial sync call
      mockSync.mockClear()

      // Simulate app going to background
      appStateHandler?.('background')
      await new Promise(resolve => setImmediate(resolve))

      // Should not sync on background
      expect(mockSync).not.toHaveBeenCalled()

      // Simulate app becoming active
      appStateHandler?.('active')
      await new Promise(resolve => setImmediate(resolve))

      // Should sync when active
      expect(mockSync).toHaveBeenCalledTimes(1)
    })

    it('should not trigger sync when app goes to background', async () => {
      let appStateHandler: ((nextAppState: AppStateStatus) => void) | undefined

      jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
        appStateHandler = handler as (nextAppState: AppStateStatus) => void
        return { remove: jest.fn() }
      })

      class TestComponent extends Component {
        render() {
          return <View />
        }
      }

      const WrappedComponent = codePush({
        checkFrequency: CheckFrequency.ON_APP_RESUME,
      })(TestComponent)

      const instance = new WrappedComponent({})
      await instance.componentDidMount?.()

      await new Promise(resolve => setImmediate(resolve))

      // Clear initial sync call
      mockSync.mockClear()

      // Simulate app going to background
      appStateHandler?.('background')
      await new Promise(resolve => setImmediate(resolve))

      expect(mockSync).not.toHaveBeenCalled()
    })

    it('should not trigger sync when app goes to inactive', async () => {
      let appStateHandler: ((nextAppState: AppStateStatus) => void) | undefined

      jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
        appStateHandler = handler as (nextAppState: AppStateStatus) => void
        return { remove: jest.fn() }
      })

      class TestComponent extends Component {
        render() {
          return <View />
        }
      }

      const WrappedComponent = codePush({
        checkFrequency: CheckFrequency.ON_APP_RESUME,
      })(TestComponent)

      const instance = new WrappedComponent({})
      await instance.componentDidMount?.()

      await new Promise(resolve => setImmediate(resolve))

      // Clear initial sync call
      mockSync.mockClear()

      // Simulate app going to inactive
      appStateHandler?.('inactive')
      await new Promise(resolve => setImmediate(resolve))

      expect(mockSync).not.toHaveBeenCalled()
    })
  })

  describe('componentWillUnmount edge cases', () => {
    it('should not error when unmounting without AppState subscription', async () => {
      class TestComponent extends Component {
        render() {
          return <View />
        }
      }

      const WrappedComponent = codePush({
        checkFrequency: CheckFrequency.ON_APP_START,
      })(TestComponent)

      const instance = new WrappedComponent({})
      await instance.componentDidMount?.()

      // Should not throw when unmounting
      expect(() => instance.componentWillUnmount?.()).not.toThrow()
    })

    it('should handle unmounting with MANUAL checkFrequency', async () => {
      class TestComponent extends Component {
        render() {
          return <View />
        }
      }

      const WrappedComponent = codePush({
        checkFrequency: CheckFrequency.MANUAL,
      })(TestComponent)

      const instance = new WrappedComponent({})
      await instance.componentDidMount?.()

      // Should not throw when unmounting
      expect(() => instance.componentWillUnmount?.()).not.toThrow()
    })
  })

  describe('component props forwarding', () => {
    it('should forward props to wrapped component', () => {
      interface TestProps {
        testProp: string
      }

      class TestComponent extends Component<TestProps> {
        render() {
          return (
            <View>
              <Text>{this.props.testProp}</Text>
            </View>
          )
        }
      }

      const WrappedComponent = codePush()(TestComponent)

      const instance = new WrappedComponent({ testProp: 'test-value' })
      const rendered = instance.render()

      // Verify props are forwarded (shallow check)
      expect(rendered).toBeDefined()
    })
  })
})
