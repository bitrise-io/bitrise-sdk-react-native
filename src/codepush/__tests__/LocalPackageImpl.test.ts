import { LocalPackageImpl } from '../LocalPackageImpl'
import { InstallMode } from '../../types/enums'
import { UpdateError } from '../../types/errors'
import { PackageStorage } from '../../storage/PackageStorage'

jest.mock('../../storage/PackageStorage')

describe('LocalPackageImpl', () => {
  const mockPackageData = {
    appVersion: '1.0.0',
    deploymentKey: 'test-key',
    description: 'Test update',
    failedInstall: false,
    isFirstRun: false,
    isMandatory: false,
    isPending: false,
    label: 'v1',
    packageHash: 'abc123',
    packageSize: 1024,
    localPath: '/codepush/abc123/index.bundle',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'warn').mockImplementation()
    jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create LocalPackage with all properties', () => {
      const pkg = new LocalPackageImpl(mockPackageData)

      expect(pkg.appVersion).toBe('1.0.0')
      expect(pkg.packageHash).toBe('abc123')
      expect(pkg.localPath).toBe('/codepush/abc123/index.bundle')
      expect(pkg.isPending).toBe(false)
    })
  })

  describe('install', () => {
    it('should install with ON_NEXT_RESTART mode by default', async () => {
      const pkg = new LocalPackageImpl(mockPackageData)

      ;(PackageStorage.getPackageData as jest.Mock).mockResolvedValue('base64data')
      ;(PackageStorage.setPendingPackage as jest.Mock).mockResolvedValue(undefined)
      ;(PackageStorage.setInstallMetadata as jest.Mock).mockResolvedValue(undefined)

      await pkg.install()

      expect(PackageStorage.setPendingPackage).toHaveBeenCalled()
      expect(PackageStorage.setInstallMetadata).toHaveBeenCalledWith('abc123', {
        installMode: InstallMode.ON_NEXT_RESTART,
        timestamp: expect.any(Number),
        minimumBackgroundDuration: undefined,
      })
      expect(pkg.isPending).toBe(true)
    })

    it('should install with IMMEDIATE mode', async () => {
      const pkg = new LocalPackageImpl(mockPackageData)

      ;(PackageStorage.getPackageData as jest.Mock).mockResolvedValue('base64data')
      ;(PackageStorage.setPendingPackage as jest.Mock).mockResolvedValue(undefined)
      ;(PackageStorage.setInstallMetadata as jest.Mock).mockResolvedValue(undefined)

      await pkg.install(InstallMode.IMMEDIATE)

      expect(PackageStorage.setInstallMetadata).toHaveBeenCalledWith('abc123', {
        installMode: InstallMode.IMMEDIATE,
        timestamp: expect.any(Number),
        minimumBackgroundDuration: undefined,
      })
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Immediate restart requested')
      )
    })

    it('should install with ON_NEXT_RESUME mode', async () => {
      const pkg = new LocalPackageImpl(mockPackageData)

      ;(PackageStorage.getPackageData as jest.Mock).mockResolvedValue('base64data')
      ;(PackageStorage.setPendingPackage as jest.Mock).mockResolvedValue(undefined)
      ;(PackageStorage.setInstallMetadata as jest.Mock).mockResolvedValue(undefined)

      await pkg.install(InstallMode.ON_NEXT_RESUME, 60)

      expect(PackageStorage.setInstallMetadata).toHaveBeenCalledWith('abc123', {
        installMode: InstallMode.ON_NEXT_RESUME,
        timestamp: expect.any(Number),
        minimumBackgroundDuration: 60,
      })
    })

    it('should install with ON_NEXT_SUSPEND mode', async () => {
      const pkg = new LocalPackageImpl(mockPackageData)

      ;(PackageStorage.getPackageData as jest.Mock).mockResolvedValue('base64data')
      ;(PackageStorage.setPendingPackage as jest.Mock).mockResolvedValue(undefined)
      ;(PackageStorage.setInstallMetadata as jest.Mock).mockResolvedValue(undefined)

      await pkg.install(InstallMode.ON_NEXT_SUSPEND, 30)

      expect(PackageStorage.setInstallMetadata).toHaveBeenCalledWith('abc123', {
        installMode: InstallMode.ON_NEXT_SUSPEND,
        timestamp: expect.any(Number),
        minimumBackgroundDuration: 30,
      })
    })

    it('should throw error if package data not found', async () => {
      const pkg = new LocalPackageImpl(mockPackageData)

      ;(PackageStorage.getPackageData as jest.Mock).mockResolvedValue(null)

      await expect(pkg.install()).rejects.toThrow(UpdateError)
      await expect(pkg.install()).rejects.toThrow('Package data not found')
    })

    it('should throw error if marking as pending fails', async () => {
      const pkg = new LocalPackageImpl(mockPackageData)

      ;(PackageStorage.getPackageData as jest.Mock).mockResolvedValue('base64data')
      ;(PackageStorage.setPendingPackage as jest.Mock).mockRejectedValue(new Error('Storage error'))

      await expect(pkg.install()).rejects.toThrow(UpdateError)
      await expect(pkg.install()).rejects.toThrow('Failed to mark package as pending')
    })

    it('should throw error if setting install metadata fails', async () => {
      const pkg = new LocalPackageImpl(mockPackageData)

      ;(PackageStorage.getPackageData as jest.Mock).mockResolvedValue('base64data')
      ;(PackageStorage.setPendingPackage as jest.Mock).mockResolvedValue(undefined)
      ;(PackageStorage.setInstallMetadata as jest.Mock).mockRejectedValue(
        new Error('Metadata error')
      )

      await expect(pkg.install()).rejects.toThrow(UpdateError)
    })

    it('should warn for invalid install mode and default to ON_NEXT_RESTART', async () => {
      const pkg = new LocalPackageImpl(mockPackageData)

      ;(PackageStorage.getPackageData as jest.Mock).mockResolvedValue('base64data')
      ;(PackageStorage.setPendingPackage as jest.Mock).mockResolvedValue(undefined)
      ;(PackageStorage.setInstallMetadata as jest.Mock).mockResolvedValue(undefined)

      // Use invalid install mode
      await pkg.install(999)

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid install mode: 999')
      )
      expect(PackageStorage.setInstallMetadata).toHaveBeenCalledWith('abc123', {
        installMode: 999,
        timestamp: expect.any(Number),
        minimumBackgroundDuration: undefined,
      })
    })

    it('should store minimumBackgroundDuration correctly', async () => {
      const pkg = new LocalPackageImpl(mockPackageData)

      ;(PackageStorage.getPackageData as jest.Mock).mockResolvedValue('base64data')
      ;(PackageStorage.setPendingPackage as jest.Mock).mockResolvedValue(undefined)
      ;(PackageStorage.setInstallMetadata as jest.Mock).mockResolvedValue(undefined)

      await pkg.install(InstallMode.ON_NEXT_RESUME, 120)

      expect(PackageStorage.setInstallMetadata).toHaveBeenCalledWith('abc123', {
        installMode: InstallMode.ON_NEXT_RESUME,
        timestamp: expect.any(Number),
        minimumBackgroundDuration: 120,
      })
    })

    it('should update isPending flag after installation', async () => {
      const pkg = new LocalPackageImpl(mockPackageData)

      expect(pkg.isPending).toBe(false)
      ;(PackageStorage.getPackageData as jest.Mock).mockResolvedValue('base64data')
      ;(PackageStorage.setPendingPackage as jest.Mock).mockResolvedValue(undefined)
      ;(PackageStorage.setInstallMetadata as jest.Mock).mockResolvedValue(undefined)

      await pkg.install()

      expect(pkg.isPending).toBe(true)
    })

    it('should pass updated package to setPendingPackage', async () => {
      const pkg = new LocalPackageImpl(mockPackageData)

      ;(PackageStorage.getPackageData as jest.Mock).mockResolvedValue('base64data')
      ;(PackageStorage.setPendingPackage as jest.Mock).mockResolvedValue(undefined)
      ;(PackageStorage.setInstallMetadata as jest.Mock).mockResolvedValue(undefined)

      await pkg.install()

      expect(PackageStorage.setPendingPackage).toHaveBeenCalledWith(
        expect.objectContaining({
          packageHash: 'abc123',
          isPending: true,
        })
      )
    })
  })
})
