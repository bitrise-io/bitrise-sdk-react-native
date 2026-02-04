import { NativeModules } from 'react-native'
import { FileSystem } from '../FileSystem'
import { FileSystemError } from '../../types/errors'

jest.mock('react-native', () => ({
  NativeModules: {
    BitriseFileSystem: null,
  },
}))

describe('FileSystem', () => {
  const mockNativeModule = {
    getDocumentsDirectory: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    deleteFile: jest.fn(),
    fileExists: jest.fn(),
    getFileSize: jest.fn(),
    createDirectory: jest.fn(),
    listDirectory: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset the cached native module
    ;(FileSystem as any)._nativeModule = undefined
  })

  describe('isAvailable', () => {
    it('returns false when native module is unavailable', () => {
      NativeModules.BitriseFileSystem = null
      expect(FileSystem.isAvailable()).toBe(false)
    })

    it('returns true when native module is available', () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      expect(FileSystem.isAvailable()).toBe(true)
    })
  })

  describe('getStorageDirectory', () => {
    it('throws when native module unavailable', async () => {
      NativeModules.BitriseFileSystem = null

      await expect(FileSystem.getStorageDirectory()).rejects.toThrow(
        FileSystemError
      )
      await expect(FileSystem.getStorageDirectory()).rejects.toThrow(
        'FileSystem not available'
      )
    })

    it('returns storage directory path', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      mockNativeModule.getDocumentsDirectory.mockResolvedValue(
        '/path/to/storage'
      )

      const path = await FileSystem.getStorageDirectory()

      expect(path).toBe('/path/to/storage')
      expect(mockNativeModule.getDocumentsDirectory).toHaveBeenCalledTimes(1)
    })

    it('throws FileSystemError on native error', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      const error = new Error('Permission denied')
      mockNativeModule.getDocumentsDirectory.mockRejectedValue(error)

      await expect(FileSystem.getStorageDirectory()).rejects.toThrow(
        FileSystemError
      )
      await expect(FileSystem.getStorageDirectory()).rejects.toThrow(
        'Failed to get storage directory'
      )
    })
  })

  describe('writeFile', () => {
    it('throws when native module unavailable', async () => {
      NativeModules.BitriseFileSystem = null
      const data = new Uint8Array([1, 2, 3])

      await expect(FileSystem.writeFile('/path/to/file', data)).rejects.toThrow(
        FileSystemError
      )
    })

    it('writes file successfully', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      mockNativeModule.writeFile.mockResolvedValue(true)

      const data = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
      await FileSystem.writeFile('/path/to/file', data)

      expect(mockNativeModule.writeFile).toHaveBeenCalledTimes(1)
      expect(mockNativeModule.writeFile).toHaveBeenCalledWith(
        '/path/to/file',
        'SGVsbG8=' // base64 of "Hello"
      )
    })

    it('throws FileSystemError on write failure', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      const error = new Error('Disk full')
      mockNativeModule.writeFile.mockRejectedValue(error)

      const data = new Uint8Array([1, 2, 3])

      await expect(FileSystem.writeFile('/path/to/file', data)).rejects.toThrow(
        FileSystemError
      )
      await expect(FileSystem.writeFile('/path/to/file', data)).rejects.toThrow(
        'Failed to write file'
      )
    })

    it('handles empty data', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      mockNativeModule.writeFile.mockResolvedValue(true)

      const data = new Uint8Array([])
      await FileSystem.writeFile('/path/to/file', data)

      expect(mockNativeModule.writeFile).toHaveBeenCalledWith(
        '/path/to/file',
        ''
      )
    })

    it('handles large data', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      mockNativeModule.writeFile.mockResolvedValue(true)

      const data = new Uint8Array(10 * 1024 * 1024) // 10 MB
      data.fill(65) // Fill with 'A'

      await FileSystem.writeFile('/path/to/file', data)

      expect(mockNativeModule.writeFile).toHaveBeenCalledTimes(1)
    })
  })

  describe('readFile', () => {
    it('throws when native module unavailable', async () => {
      NativeModules.BitriseFileSystem = null

      await expect(FileSystem.readFile('/path/to/file')).rejects.toThrow(
        FileSystemError
      )
    })

    it('returns null when file does not exist', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      mockNativeModule.readFile.mockResolvedValue(null)

      const data = await FileSystem.readFile('/path/to/file')

      expect(data).toBeNull()
      expect(mockNativeModule.readFile).toHaveBeenCalledWith('/path/to/file')
    })

    it('reads file successfully', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      mockNativeModule.readFile.mockResolvedValue('SGVsbG8=') // base64 of "Hello"

      const data = await FileSystem.readFile('/path/to/file')

      expect(data).toEqual(new Uint8Array([72, 101, 108, 108, 111]))
      expect(mockNativeModule.readFile).toHaveBeenCalledTimes(1)
    })

    it('throws FileSystemError on read failure', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      const error = new Error('Permission denied')
      mockNativeModule.readFile.mockRejectedValue(error)

      await expect(FileSystem.readFile('/path/to/file')).rejects.toThrow(
        FileSystemError
      )
      await expect(FileSystem.readFile('/path/to/file')).rejects.toThrow(
        'Failed to read file'
      )
    })
  })

  describe('deleteFile', () => {
    it('throws when native module unavailable', async () => {
      NativeModules.BitriseFileSystem = null

      await expect(FileSystem.deleteFile('/path/to/file')).rejects.toThrow(
        FileSystemError
      )
    })

    it('returns false when file does not exist', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      mockNativeModule.deleteFile.mockResolvedValue(false)

      const result = await FileSystem.deleteFile('/path/to/file')

      expect(result).toBe(false)
      expect(mockNativeModule.deleteFile).toHaveBeenCalledWith('/path/to/file')
    })

    it('returns true when file deleted', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      mockNativeModule.deleteFile.mockResolvedValue(true)

      const result = await FileSystem.deleteFile('/path/to/file')

      expect(result).toBe(true)
      expect(mockNativeModule.deleteFile).toHaveBeenCalledTimes(1)
    })

    it('throws FileSystemError on delete failure', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      const error = new Error('Permission denied')
      mockNativeModule.deleteFile.mockRejectedValue(error)

      await expect(FileSystem.deleteFile('/path/to/file')).rejects.toThrow(
        FileSystemError
      )
    })
  })

  describe('fileExists', () => {
    it('throws when native module unavailable', async () => {
      NativeModules.BitriseFileSystem = null

      await expect(FileSystem.fileExists('/path/to/file')).rejects.toThrow(
        FileSystemError
      )
    })

    it('returns true when file exists', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      mockNativeModule.fileExists.mockResolvedValue(true)

      const exists = await FileSystem.fileExists('/path/to/file')

      expect(exists).toBe(true)
      expect(mockNativeModule.fileExists).toHaveBeenCalledWith('/path/to/file')
    })

    it('returns false when file does not exist', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      mockNativeModule.fileExists.mockResolvedValue(false)

      const exists = await FileSystem.fileExists('/path/to/file')

      expect(exists).toBe(false)
    })

    it('throws FileSystemError on check failure', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      const error = new Error('Permission denied')
      mockNativeModule.fileExists.mockRejectedValue(error)

      await expect(FileSystem.fileExists('/path/to/file')).rejects.toThrow(
        FileSystemError
      )
    })
  })

  describe('getFileSize', () => {
    it('throws when native module unavailable', async () => {
      NativeModules.BitriseFileSystem = null

      await expect(FileSystem.getFileSize('/path/to/file')).rejects.toThrow(
        FileSystemError
      )
    })

    it('returns 0 when file does not exist', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      mockNativeModule.getFileSize.mockResolvedValue(0)

      const size = await FileSystem.getFileSize('/path/to/file')

      expect(size).toBe(0)
    })

    it('returns file size in bytes', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      mockNativeModule.getFileSize.mockResolvedValue(1024)

      const size = await FileSystem.getFileSize('/path/to/file')

      expect(size).toBe(1024)
      expect(mockNativeModule.getFileSize).toHaveBeenCalledWith('/path/to/file')
    })

    it('throws FileSystemError on stat failure', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      const error = new Error('Permission denied')
      mockNativeModule.getFileSize.mockRejectedValue(error)

      await expect(FileSystem.getFileSize('/path/to/file')).rejects.toThrow(
        FileSystemError
      )
    })
  })

  describe('createDirectory', () => {
    it('throws when native module unavailable', async () => {
      NativeModules.BitriseFileSystem = null

      await expect(FileSystem.createDirectory('/path/to/dir')).rejects.toThrow(
        FileSystemError
      )
    })

    it('creates directory successfully', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      mockNativeModule.createDirectory.mockResolvedValue(true)

      await FileSystem.createDirectory('/path/to/dir')

      expect(mockNativeModule.createDirectory).toHaveBeenCalledWith(
        '/path/to/dir'
      )
    })

    it('throws FileSystemError on creation failure', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      const error = new Error('Permission denied')
      mockNativeModule.createDirectory.mockRejectedValue(error)

      await expect(FileSystem.createDirectory('/path/to/dir')).rejects.toThrow(
        FileSystemError
      )
      await expect(FileSystem.createDirectory('/path/to/dir')).rejects.toThrow(
        'Failed to create directory'
      )
    })
  })

  describe('listDirectory', () => {
    it('throws when native module unavailable', async () => {
      NativeModules.BitriseFileSystem = null

      await expect(FileSystem.listDirectory('/path/to/dir')).rejects.toThrow(
        FileSystemError
      )
    })

    it('returns empty array when directory does not exist', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      mockNativeModule.listDirectory.mockResolvedValue([])

      const files = await FileSystem.listDirectory('/path/to/dir')

      expect(files).toEqual([])
    })

    it('lists directory contents', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      mockNativeModule.listDirectory.mockResolvedValue(['file1.txt', 'file2.txt'])

      const files = await FileSystem.listDirectory('/path/to/dir')

      expect(files).toEqual(['file1.txt', 'file2.txt'])
      expect(mockNativeModule.listDirectory).toHaveBeenCalledWith('/path/to/dir')
    })

    it('throws FileSystemError on list failure', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      const error = new Error('Permission denied')
      mockNativeModule.listDirectory.mockRejectedValue(error)

      await expect(FileSystem.listDirectory('/path/to/dir')).rejects.toThrow(
        FileSystemError
      )
    })
  })

  describe('base64 encoding/decoding', () => {
    it('handles binary data correctly', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      mockNativeModule.writeFile.mockResolvedValue(true)
      mockNativeModule.readFile.mockImplementation((_path: string) => {
        const call = mockNativeModule.writeFile.mock.calls[0]
        return Promise.resolve(call[1])
      })

      const originalData = new Uint8Array([0, 1, 2, 255, 254, 253])
      await FileSystem.writeFile('/path/to/file', originalData)

      const readData = await FileSystem.readFile('/path/to/file')

      expect(readData).toEqual(originalData)
    })

    it('handles UTF-8 text correctly', async () => {
      NativeModules.BitriseFileSystem = mockNativeModule
      mockNativeModule.writeFile.mockResolvedValue(true)
      mockNativeModule.readFile.mockImplementation((_path: string) => {
        const call = mockNativeModule.writeFile.mock.calls[0]
        return Promise.resolve(call[1])
      })

      const text = 'Hello, World! 🚀'
      const encoder = new TextEncoder()
      const originalData = encoder.encode(text)

      await FileSystem.writeFile('/path/to/file', originalData)
      const readData = await FileSystem.readFile('/path/to/file')

      const decoder = new TextDecoder()
      const decodedText = decoder.decode(readData!)

      expect(decodedText).toBe(text)
    })
  })
})
