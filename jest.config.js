module.exports = {
  preset: 'react-native',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testMatch: ['**/__tests__/**/*.test.(ts|tsx|js)', '**/*.test.(ts|tsx|js)'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'plugin/src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/types/**',
    '!plugin/src/**/*.test.{ts,tsx}',
    '!plugin/src/**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coveragePathIgnorePatterns: ['/node_modules/', '/lib/', '/plugin/build/', 'src/index.ts', 'plugin/src/index.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|expo|@expo)/)',
  ],
}
