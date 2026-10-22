module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: { '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { jsx: 'react-jsx', moduleResolution: 'node', module: 'commonjs', target: 'ES2020', esModuleInterop: true, resolveJsonModule: true, strict: true }, diagnostics: true }] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1', '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js' },
  testMatch: ['<rootDir>/src/features/users/__tests__/*.test.ts', '<rootDir>/src/features/users/__tests__/*.test.tsx'],
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
};
