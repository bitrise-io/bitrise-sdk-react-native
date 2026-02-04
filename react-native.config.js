module.exports = {
  dependency: {
    platforms: {
      ios: {},
      android: {
        packageImportPath: 'import com.bitrise.BitriseFileSystemPackage;',
        packageInstance: 'new BitriseFileSystemPackage()',
      },
    },
  },
}
