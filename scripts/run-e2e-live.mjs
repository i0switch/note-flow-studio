#!/usr/bin/env node
/**
 * scripts/run-e2e-live.mjs
 *
 * Cross-platform launcher for live E2E tests.
 * Sets required env vars and delegates to vitest.
 *
 * Usage:
 *   node scripts/run-e2e-live.mjs draft
 *   node scripts/run-e2e-live.mjs publish
 *   node scripts/run-e2e-live.mjs schedule
 *   node scripts/run-e2e-live.mjs all
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(__dirname, "..", "apps", "server");

const target = process.argv[2] ?? "all";

const patterns = {
  draft:    "src/tests/e2e/live/e2e-live-draft",
  publish:  "src/tests/e2e/live/e2e-live-publish",
  schedule: "src/tests/e2e/live/e2e-live-schedule",
  all:      "src/tests/e2e/live",
};

if (!patterns[target]) {
  console.error(`Unknown target: ${target}`);
  console.error(`Valid targets: ${Object.keys(patterns).join(", ")}`);
  process.exit(1);
}

const extraEnv = {
  E2E_LIVE_DRAFT:   target === "draft"   || target === "all" || target === "schedule" ? "true" : undefined,
  E2E_LIVE_PUBLISH: target === "publish" || target === "all" ? "true" : undefined,
};

const env = { ...process.env };
for (const [k, v] of Object.entries(extraEnv)) {
  if (v) env[k] = v;
}

console.log(`\n▶  Running e2e:live target="${target}" …\n`);

const result = spawnSync(
  "npx",
  [
    "vitest",
    "run",
    "--config", "vitest.e2e.config.ts",
    patterns[target],
  ],
  {
    cwd: serverDir,
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  }
);

process.exit(result.status ?? 1);
