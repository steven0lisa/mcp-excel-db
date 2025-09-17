export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { 
      useESM: true,
      tsconfig: {
        module: 'ES2022',
        target: 'ES2022',
        moduleResolution: 'node',
      }
    }],
  },
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/test-new-features.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  }
};