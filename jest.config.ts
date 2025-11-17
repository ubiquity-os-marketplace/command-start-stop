import type { Config } from "jest";

const cfg: Config = {
  testEnvironment: "node",
  transform: {
    "^.+\\.[jt]s$": ["@swc/jest", {}],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  coveragePathIgnorePatterns: ["node_modules", "mocks", "tests"],
  coverageReporters: ["json", "lcov", "text", "clover", "json-summary"],
  reporters: ["default", "jest-junit", "jest-md-dashboard"],
  coverageDirectory: "coverage",
  testTimeout: 20000,
  transformIgnorePatterns: ["node_modules/(?!(@octokit|@ubiquity-os|universal-user-agent|before-after-hook)/)"],
  roots: ["<rootDir>/tests"],
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  setupFilesAfterEnv: ["dotenv/config", "<rootDir>/tests/setup.ts"],
};

export default cfg;
