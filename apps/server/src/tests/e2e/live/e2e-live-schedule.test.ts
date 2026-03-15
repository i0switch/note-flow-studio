/**
 * e2e:live — schedule (予約投稿)
 *
 * REQUIRES:
 *   E2E_LIVE_DRAFT=true           — re-uses draft guard (schedule uses draft path)
 *   data/note-storage-state.json  — live Playwright session
 *
 * NOTE: server-side scheduler is not yet implemented.
 * These tests verify current behavior and will be updated when scheduler ships.
 *
 * PENDING_IMPLEMENTATION: サーバー側スケジューラー未実装
 *
 * Run: E2E_LIVE_DRAFT=true npx vitest run src/tests/e2e/live/e2e-live-schedule
 */
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../../app.js";
import { createDatabase } from "../../../db/client.js";
import { env } from "../../../config.js";
import { ArtifactWriter } from "../__helpers__/artifact-writer.js";
import { NoteVerificationDriver } from "../__helpers__/note-verification-driver.js";
import { makeJobPayload, makeRunId } from "../__helpers__/test-data-factory.js";

// ── Guard ────────────────────────────────────────────────────────────────────
if (process.env.E2E_LIVE_DRAFT !== "true") {
  describe("e2e:live schedule (skipped — E2E_LIVE_DRAFT not set)", () => {
    it.skip("skipped", () => {});
  });
  throw new Error("E2E_LIVE_DRAFT=true required to run live schedule tests");
}

const RUN_ID = makeRunId("e2e-live-schedule");
let artifacts: ArtifactWriter;
let driver: NoteVerificationDriver;
let app: Awaited<ReturnType<typeof buildApp>>;

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
  await artifacts.writeSummary();
});

describe("e2e:live schedule (stub)", () => {
  it("generate-article に action=schedule を送っても 5xx にならない [PENDING_IMPLEMENTATION]", async () => {
    const TEST = "live schedule no 5xx";

    const jobPayload = makeJobPayload({ runId: RUN_ID });
    const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const res = await app.inject({
      method: "POST",
      url: "/api/generate-article",
      payload: {
        input: {
          keyword: jobPayload.keyword,
          genre: "テクノロジー",
          accountId: "1",
          promptId: "1",
          saleMode: "normal",
          price: null,
          instruction: jobPayload.additionalInstruction,
          providerId: "gemini",
          action: "schedule",
          scheduledAt,
        },
        settings: {},
      },
    });

    await artifacts.appendLog({
      ts: new Date().toISOString(),
      level: res.statusCode < 500 ? "info" : "error",
      test: TEST,
      step: "POST /api/generate-article action=schedule (live)",
      statusCode: res.statusCode,
    });

    expect(res.statusCode).toBeLessThan(500);

    artifacts.recordResult({ test: TEST, status: "passed" });
  });

  it("schedule job を作成しても即座に note.com への投稿は発生しない [PENDING_IMPLEMENTATION]", async () => {
    const TEST = "live schedule no immediate post";

    const jobId = await driver.createJob(makeJobPayload({ runId: RUN_ID }), TEST);
    const detail = await driver.waitForJob(jobId, TEST);

    expect(detail.status).toBe("succeeded");
    expect(detail.article).not.toBeNull();

    await artifacts.appendLog({
      ts: new Date().toISOString(),
      level: "info",
      test: TEST,
      step: "verify no immediate publish on schedule (live)",
    });

    artifacts.recordResult({ test: TEST, status: "passed" });
  });
});
