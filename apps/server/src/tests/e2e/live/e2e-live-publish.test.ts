/**
 * e2e:live — publish (実投稿)
 *
 * ⚠️  DESTRUCTIVE: publishes articles to the REAL note.com
 *
 * REQUIRES:
 *   E2E_LIVE_PUBLISH=true         — strict opt-in guard
 *   data/note-storage-state.json  — live Playwright session
 *
 * Published notes are deleted in afterAll via NoteCleanup.
 *
 * Run: E2E_LIVE_PUBLISH=true npx vitest run src/tests/e2e/live/e2e-live-publish
 */
import fs from "node:fs";
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../../app.js";
import { createDatabase } from "../../../db/client.js";
import { env } from "../../../config.js";
import { ArtifactWriter } from "../__helpers__/artifact-writer.js";
import { NoteVerificationDriver } from "../__helpers__/note-verification-driver.js";
import { NoteCleanup } from "../__helpers__/cleanup.js";
import { makeJobPayload, makeSavePayload, makeRunId } from "../__helpers__/test-data-factory.js";
import { resolveDataPath } from "../../../config.js";

// ── Guard: strict opt-in required ────────────────────────────────────────────
if (process.env.E2E_LIVE_PUBLISH !== "true") {
  describe("e2e:live publish (skipped — E2E_LIVE_PUBLISH not set)", () => {
    it.skip("skipped", () => {});
  });
  throw new Error("E2E_LIVE_PUBLISH=true required to run live publish tests");
}

// ── Session file check ────────────────────────────────────────────────────────
const sessionPath = resolveDataPath("note-storage-state.json");
if (!fs.existsSync(sessionPath)) {
  throw new Error(
    `Live publish test requires ${sessionPath}. ` +
    "Run the session setup flow in the app first."
  );
}

const RUN_ID = makeRunId("e2e-live-publish");
let artifacts: ArtifactWriter;
let driver: NoteVerificationDriver;
let app: Awaited<ReturnType<typeof buildApp>>;
const cleanup = new NoteCleanup();

beforeAll(async () => {
  artifacts = await ArtifactWriter.init(RUN_ID, "live");
});

beforeEach(async () => {
  env.MOCK_AI_MODE = true;
  env.ENABLE_REAL_NOTE_AUTOMATION = true;

  app = await buildApp({ db: createDatabase(":memory:") });
  driver = new NoteVerificationDriver(app, artifacts);
});

afterEach(async () => {
  await app.close();
});

afterAll(async () => {
  const report = await cleanup.run(artifacts);
  await artifacts.appendLog({
    ts: new Date().toISOString(),
    level: report.failed.length > 0 ? "warn" : "info",
    test: "cleanup",
    step: "afterAll",
    cleanupSucceeded: report.succeeded,
    cleanupFailed: report.failed,
  } as Parameters<typeof artifacts.appendLog>[0]);
  await artifacts.writeSummary();
});

describe("e2e:live publish", () => {
  it("note.com に実投稿できる — URL が note.com/<urlname>/n/<key> 形式", async () => {
    const TEST = "live publish";

    const jobId = await driver.createJob(makeJobPayload({ runId: RUN_ID }), TEST);
    await driver.waitForJob(jobId, TEST);

    const result = await driver.publish(
      jobId,
      makeSavePayload({ forceMethod: "playwright" }),
      TEST
    );

    expect(result.statusCode).toBe(200);
    expect(result.draftUrl).toBeTruthy();
    expect(result.draftUrl).toContain("note.com");
    expect(result.draftUrl).not.toContain("/mock/");

    // Register for cleanup (publish URL uses /n/<key> pattern)
    if (result.draftUrl) {
      const noteKey =
        NoteCleanup.keyFromPublishUrl(result.draftUrl) ??
        NoteCleanup.keyFromDraftUrl(result.draftUrl);
      if (noteKey) {
        cleanup.register({ noteKey, draftUrl: result.draftUrl, label: TEST });
      }
    }

    artifacts.recordResult({
      test: TEST,
      status: "passed",
      draftUrl: result.draftUrl ?? undefined,
      methodUsed: result.methodUsed ?? undefined,
    });
  });
});
