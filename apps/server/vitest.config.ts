import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // chromium.launch() in getDependencyChecks can take 4-5s on Windows
    testTimeout: 15_000,
    hookTimeout: 10_000,
  },
});
