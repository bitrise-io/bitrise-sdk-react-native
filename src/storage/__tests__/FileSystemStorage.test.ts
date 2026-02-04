import { FileSystemStorage } from '../FileSystemStorage'
import { FileSystem } from '../../native/FileSystem'

jest.mock('../../native/FileSystem')

describe('FileSystemStorage', () => {
  const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset the cached storage directory
    ;(FileSystemStorage as any).storageDir = null
    mockFileSystem.getStorageDirectory.mockResolvedValue('/storage')
    mockFileSystem.createDirectory.mockResolvedValue()
  })

  describe('setPackageData', () => {
    it('writes package data to filesystem', async () => {
      mockFileSystem.writeFile.mockResolvedValue()

      const hash = 'abc123'
      const data = new Uint8Array([1, 2, 3])

      await FileSystemStorage.setPackageData(hash, data)

      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
        '/storage/packages/abc123.dat',
        data
      )
    })

    it('creates storage directories on first call', async () => {
      mockFileSystem.writeFile.mockResolvedValue()

      const hash = 'abc123'
      const data = new Uint8Array([1, 2, 3])

      await FileSystemStorage.setPackageData(hash, data)

      expect(mockFileSystem.createDirectory).toHaveBeenCalledWith(
        '/storage/packages'
      )
      expect(mockFileSystem.createDirectory).toHaveBeenCalledWith(
        '/storage/metadata'
      )
    })
  })

  describe('getPackageData', () => {
    it('returns null when package does not exist', async () => {
      mockFileSystem.readFile.mockResolvedValue(null)

      const data = await FileSystemStorage.getPackageData('abc123')

      expect(data).toBeNull()
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        '/storage/packages/abc123.dat'
      )
    })

    it('returns package data when it exists', async () => {
      const expectedData = new Uint8Array([1, 2, 3])
      mockFileSystem.readFile.mockResolvedValue(expectedData)

      const data = await FileSystemStorage.getPackageData('abc123')

      expect(data).toEqual(expectedData)
    })
  })

  describe('deletePackageData', () => {
    it('returns false when package does not exist', async () => {
      mockFileSystem.deleteFile.mockResolvedValue(false)

      const result = await FileSystemStorage.deletePackageData('abc123')

      expect(result).toBe(false)
      expect(mockFileSystem.deleteFile).toHaveBeenCalledWith(
        '/storage/packages/abc123.dat'
      )
    })

    it('returns true when package deleted', async () => {
      mockFileSystem.deleteFile.mockResolvedValue(true)

      const result = await FileSystemStorage.deletePackageData('abc123')

      expect(result).toBe(true)
    })
  })

  describe('hasPackageData', () => {
    it('returns false when package does not exist', async () => {
      mockFileSystem.fileExists.mockResolvedValue(false)

      const exists = await FileSystemStorage.hasPackageData('abc123')

      expect(exists).toBe(false)
      expect(mockFileSystem.fileExists).toHaveBeenCalledWith(
        '/storage/packages/abc123.dat'
      )
    })

    it('returns true when package exists', async () => {
      mockFileSystem.fileExists.mockResolvedValue(true)

      const exists = await FileSystemStorage.hasPackageData('abc123')

      expect(exists).toBe(true)
    })
  })

  describe('getPackageSize', () => {
    it('returns 0 when package does not exist', async () => {
      mockFileSystem.getFileSize.mockResolvedValue(0)

      const size = await FileSystemStorage.getPackageSize('abc123')

      expect(size).toBe(0)
    })

    it('returns package size in bytes', async () => {
      mockFileSystem.getFileSize.mockResolvedValue(1024)

      const size = await FileSystemStorage.getPackageSize('abc123')

      expect(size).toBe(1024)
      expect(mockFileSystem.getFileSize).toHaveBeenCalledWith(
        '/storage/packages/abc123.dat'
      )
    })
  })

  describe('setPackageMetadata', () => {
    it('writes metadata as JSON', async () => {
      mockFileSystem.writeFile.mockResolvedValue()

      const hash = 'abc123'
      const metadata = { version: '1.0.0', size: 1024 }

      await FileSystemStorage.setPackageMetadata(hash, metadata)

      const expectedJson = JSON.stringify(metadata)
      const expectedData = new TextEncoder().encode(expectedJson)

      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
        '/storage/metadata/abc123.json',
        expectedData
      )
    })
  })

  describe('getPackageMetadata', () => {
    it('returns null when metadata does not exist', async () => {
      mockFileSystem.readFile.mockResolvedValue(null)

      const metadata = await FileSystemStorage.getPackageMetadata('abc123')

      expect(metadata).toBeNull()
    })

    it('returns parsed metadata', async () => {
      const metadata = { version: '1.0.0', size: 1024 }
      const json = JSON.stringify(metadata)
      const data = new TextEncoder().encode(json)
      mockFileSystem.readFile.mockResolvedValue(data)

      const result = await FileSystemStorage.getPackageMetadata('abc123')

      expect(result).toEqual(metadata)
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        '/storage/metadata/abc123.json'
      )
    })
  })

  describe('deletePackageMetadata', () => {
    it('deletes metadata file', async () => {
      mockFileSystem.deleteFile.mockResolvedValue(true)

      const result = await FileSystemStorage.deletePackageMetadata('abc123')

      expect(result).toBe(true)
      expect(mockFileSystem.deleteFile).toHaveBeenCalledWith(
        '/storage/metadata/abc123.json'
      )
    })
  })

  describe('deletePackage', () => {
    it('deletes both data and metadata', async () => {
      mockFileSystem.deleteFile.mockResolvedValue(true)

      await FileSystemStorage.deletePackage('abc123')

      expect(mockFileSystem.deleteFile).toHaveBeenCalledWith(
        '/storage/packages/abc123.dat'
      )
      expect(mockFileSystem.deleteFile).toHaveBeenCalledWith(
        '/storage/metadata/abc123.json'
      )
    })
  })

  describe('listPackages', () => {
    it('returns empty array when no packages exist', async () => {
      mockFileSystem.listDirectory.mockResolvedValue([])

      const packages = await FileSystemStorage.listPackages()

      expect(packages).toEqual([])
      expect(mockFileSystem.listDirectory).toHaveBeenCalledWith(
        '/storage/packages'
      )
    })

    it('returns package hashes without extension', async () => {
      mockFileSystem.listDirectory.mockResolvedValue([
        'abc123.dat',
        'def456.dat',
        'metadata.json', // Should be filtered out
      ])

      const packages = await FileSystemStorage.listPackages()

      expect(packages).toEqual(['abc123', 'def456'])
    })
  })

  describe('clearAll', () => {
    it('deletes all packages', async () => {
      mockFileSystem.listDirectory.mockResolvedValue([
        'abc123.dat',
        'def456.dat',
      ])
      mockFileSystem.deleteFile.mockResolvedValue(true)

      await FileSystemStorage.clearAll()

      expect(mockFileSystem.deleteFile).toHaveBeenCalledWith(
        '/storage/packages/abc123.dat'
      )
      expect(mockFileSystem.deleteFile).toHaveBeenCalledWith(
        '/storage/metadata/abc123.json'
      )
      expect(mockFileSystem.deleteFile).toHaveBeenCalledWith(
        '/storage/packages/def456.dat'
      )
      expect(mockFileSystem.deleteFile).toHaveBeenCalledWith(
        '/storage/metadata/def456.json'
      )
    })

    it('handles empty storage', async () => {
      mockFileSystem.listDirectory.mockResolvedValue([])

      await FileSystemStorage.clearAll()

      expect(mockFileSystem.deleteFile).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('propagates filesystem errors', async () => {
      const error = new Error('Disk full')
      mockFileSystem.writeFile.mockRejectedValue(error)

      const data = new Uint8Array([1, 2, 3])

      await expect(
        FileSystemStorage.setPackageData('abc123', data)
      ).rejects.toThrow('Disk full')
    })
  })

  describe('concurrent operations', () => {
    it('handles concurrent writes to different packages', async () => {
      mockFileSystem.writeFile.mockResolvedValue()

      const data1 = new Uint8Array([1, 2, 3])
      const data2 = new Uint8Array([4, 5, 6])

      await Promise.all([
        FileSystemStorage.setPackageData('hash1', data1),
        FileSystemStorage.setPackageData('hash2', data2),
      ])

      expect(mockFileSystem.writeFile).toHaveBeenCalledTimes(2)
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
        '/storage/packages/hash1.dat',
        data1
      )
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
        '/storage/packages/hash2.dat',
        data2
      )
    })

    it('handles concurrent reads', async () => {
      const data1 = new Uint8Array([1, 2, 3])
      const data2 = new Uint8Array([4, 5, 6])

      mockFileSystem.readFile.mockImplementation(async (path: string) => {
        if (path.includes('hash1')) return data1
        if (path.includes('hash2')) return data2
        return null
      })

      const [result1, result2] = await Promise.all([
        FileSystemStorage.getPackageData('hash1'),
        FileSystemStorage.getPackageData('hash2'),
      ])

      expect(result1).toEqual(data1)
      expect(result2).toEqual(data2)
    })
  })
})
