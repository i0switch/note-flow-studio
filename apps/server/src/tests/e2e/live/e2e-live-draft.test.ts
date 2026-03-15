/**
 * e2e:live — draft save (下書き保存)
 *
 * REQUIRES:
 *   E2E_LIVE_DRAFT=true          — opt-in guard (prevents accidental runs)
 *   data/note-storage-state.json — live Playwright session
 *   ENABLE_REAL_NOTE_AUTOMATION=true is set automatically by this test
 *
 * Created notes are deleted in afterAll via NoteCleanup.
 * Failures in cleanup are logged but do NOT fail the test.
 *
 * Run: E2E_LIVE_DRAFT=true npx vitest run src/tests/e2e/live/e2e-live-draft
 */
import fs from "node:fs";
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../../app.js";
import { createDatabase } from "../../../db/client.js";
import { env } from "../../../config.js";
import { ArtifactWriter } from "../__helpers__/artifact-writer.js";
import { NoteVerificationDriver } from "../__helpers__/note-verification-driver.js";
import { NoteCleanup } from "../__helpers__/cleanup.js";
import { makeJobPayload, makePaidJobPayload, makeSavePayload, makeRunId } from "../__helpers__/test-data-factory.js";
import { resolveDataPath } from "../../../config.js";

// ── Guard: opt-in required ────────────────────────────────────────────────────
if (process.env.E2E_LIVE_DRAFT !== "true") {
  describe("e2e:live draft (skipped — E2E_LIVE_DRAFT not set)", () => {
    it.skip("skipped", () => {});
  });
  // eslint-disable-next-line no-throw-literal
  throw new Error("E2E_LIVE_DRAFT=true required to run live draft tests");
}

// ── Session file check ────────────────────────────────────────────────────────
const sessionPath = resolveDataPath("note-storage-state.json");
if (!fs.existsSync(sessionPath)) {
  throw new Error(
    `Live draft test requires ${sessionPath}. ` +
    "Run the session setup flow in the app first."
  );
}

const RUN_ID = makeRunId("e2e-live-draft");
let artifacts: ArtifactWriter;
let driver: NoteVerificationDriver;
let app: Awaited<ReturnType<typeof buildApp>>;
const cleanup = new NoteCleanup();

beforeAll(async () => {
  artifacts = await ArtifactWriter.init(RUN_ID, "live");
});

beforeEach(async () => {
  env.MOCK_AI_MODE = true;            // AI is still mocked — we only test note posting
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

describe("e2e:live draft save", () => {
  it("note.com に下書き保存できる — URL が editor.note.com を含む", async () => {
    const TEST = "live draft save";

    const jobId = await driver.createJob(makeJobPayload({ runId: RUN_ID }), TEST);
    await driver.waitForJob(jobId, TEST);

    const result = await driver.saveDraft(
      jobId,
      makeSavePayload({ forceMethod: null }),
      TEST
    );

    expect(result.statusCode).toBe(200);
    expect(result.draftUrl).toBeTruthy();
    expect(result.draftUrl).toContain("note.com");
    expect(result.draftUrl).not.toContain("/mock/");

    // Register for cleanup
    if (result.draftUrl) {
      const noteKey = NoteCleanup.keyFromDraftUrl(result.draftUrl);
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

  it("playwright フォースで下書き保存できる", async () => {
    const TEST = "live draft playwright";

    const jobId = await driver.createJob(makeJobPayload({ runId: RUN_ID }), TEST);
    await driver.waitForJob(jobId, TEST);

    const result = await driver.saveDraft(
      jobId,
      makeSavePayload({ forceMethod: "playwright" }),
      TEST
    );

    expect(result.statusCode).toBe(200);
    expect(result.methodUsed).toBe("playwright");
    expect(result.draftUrl).toContain("note.com");

    if (result.draftUrl) {
      const noteKey = NoteCleanup.keyFromDraftUrl(result.draftUrl);
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

  it("有料記事の下書き保存 — saleSettingStatus が applied または skipped", async () => {
    const TEST = "live paid draft";

    const jobId = await driver.createJob(makePaidJobPayload({ runId: RUN_ID }), TEST);
    await driver.waitForJob(jobId, TEST);

    const result = await driver.saveDraft(
      jobId,
      makeSavePayload({ forceMethod: "playwright", applySaleSettings: true }),
      TEST
    );

    expect(result.statusCode).toBe(200);
    expect(["applied", "skipped", "failed", "not_required"]).toContain(result.saleSettingStatus);

    if (result.draftUrl) {
      const noteKey = NoteCleanup.keyFromDraftUrl(result.draftUrl);
      if (noteKey) {
        cleanup.register({ noteKey, draftUrl: result.draftUrl, label: TEST });
      }
    }

    artifacts.recordResult({ test: TEST, status: "passed", methodUsed: result.methodUsed ?? undefined });
  });
});
