import { defineConfig } from "vitest/config";

/**
 * Vitest config for E2E tests.
 * Longer timeouts needed since live tests call real Playwright / note.com.
 */
export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    testTimeout: 60_000,   // 60s per test
    hookTimeout: 30_000,   // 30s for beforeAll/afterAll
    pool: "forks",         // isolated process — prevents env pollution
    poolOptions: {
      forks: {
        singleFork: true,  // run serially — live tests must not overlap
      },
    },
  },
});
