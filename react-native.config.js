module.exports = {
  dependency: {
    platforms: {
      ios: {
        podspecPath: './bitrise-react-native-sdk.podspec',
      },
      android: {
        packageImportPath: 'import com.bitrise.BitriseFileSystemPackage;',
        packageInstance: 'new BitriseFileSystemPackage()',
      },
    },
  },
}
