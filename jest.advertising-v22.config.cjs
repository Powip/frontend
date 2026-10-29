/** Focused runtime checks; run `npm run typecheck` separately for project-wide types. */
module.exports = {
  rootDir: __dirname,
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
          module: "commonjs",
          moduleResolution: "node16",
          esModuleInterop: true,
          isolatedModules: true,
        },
        diagnostics: false,
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(css|less|scss|sass)$": "<rootDir>/__mocks__/styleMock.js",
    "\\.(jpg|jpeg|png|gif|svg|webp)$": "<rootDir>/__mocks__/fileMock.js",
  },
  testMatch: [
    "<rootDir>/src/components/advertising/v22/__tests__/**/*.test.[jt]s?(x)",
    "<rootDir>/src/components/advertising/__tests__/AdvertisingModuleNavigation.test.tsx",
    "<rootDir>/src/components/layout/__tests__/Sidebar.publicidad-integration.test.tsx",
    "<rootDir>/src/components/layout/__tests__/Sidebar.partners-main.test.tsx",
  ],
};
