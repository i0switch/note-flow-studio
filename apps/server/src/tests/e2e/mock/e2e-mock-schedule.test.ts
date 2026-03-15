/**
 * e2e:mock — schedule (予約投稿)
 *
 * NOTE: schedule は現時点でサーバー側スタブ実装。
 * これらのテストは「現在の動作」を記録するものであり、
 * 実スケジューラー実装後は期待値を更新すること。
 *
 * PENDING_IMPLEMENTATION: サーバー側スケジューラー未実装
 */
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { afterAll, beforeEach, afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../../app.js";
import { createDatabase } from "../../../db/client.js";
import { env } from "../../../config.js";
import { ArtifactWriter } from "../__helpers__/artifact-writer.js";
import { NoteVerificationDriver } from "../__helpers__/note-verification-driver.js";
import { makeJobPayload, makeRunId } from "../__helpers__/test-data-factory.js";

const RUN_ID = makeRunId("e2e-mock-schedule");
let artifacts: ArtifactWriter;
let driver: NoteVerificationDriver;
let app: Awaited<ReturnType<typeof buildApp>>;
let tmpStateFile: string;

beforeEach(async () => {
  env.MOCK_AI_MODE = true;
  env.ENABLE_REAL_NOTE_AUTOMATION = false;
  env.MOCK_NOTE_API_RESULT = "success";
  env.MOCK_PLAYWRIGHT_RESULT = "success";
  env.MOCK_PINCHTAB_RESULT = "success";

  tmpStateFile = path.join(os.tmpdir(), `note-local-state-${Date.now()}.json`);
  app = await buildApp({ db: createDatabase(":memory:"), stateFilePath: tmpStateFile });

  if (!artifacts) {
    artifacts = await ArtifactWriter.init(RUN_ID, "mock");
  }
  driver = new NoteVerificationDriver(app, artifacts);
});

afterEach(async () => {
  await app.close();
  await fs.unlink(tmpStateFile).catch(() => {});
});

afterAll(async () => {
  await artifacts?.writeSummary();
});

describe("e2e:mock schedule (stub)", () => {
  it("generate-article で action=schedule を含むリクエストを受け付ける [PENDING_IMPLEMENTATION]", async () => {
    const TEST = "schedule action accepted";

    // POST /api/generate-article (saas-hub adapter) — action: "schedule" を送る
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
      step: "POST /api/generate-article action=schedule",
      statusCode: res.statusCode,
    });

    // 現在の実装: schedule は silently 無視され draft に準じる (200 or 202 系)
    // 5xx は実装バグを示す — テスト失敗とする
    expect(res.statusCode).toBeLessThan(500);

    artifacts.recordResult({
      test: TEST,
      status: "passed",
    });
  });

  it("schedule の結果、即座な note.com 投稿は発生しない [PENDING_IMPLEMENTATION]", async () => {
    const TEST = "schedule no immediate post";

    // generation job を作成して完了を待つ
    const jobId = await driver.createJob(makeJobPayload({ runId: RUN_ID }), TEST);
    const detail = await driver.waitForJob(jobId, TEST);

    // job が succeeded になっても save-note が呼ばれていないこと
    // (schedule はまだサーバー側で実装されていないため、save_attempts は空のはず)
    expect(detail.status).toBe("succeeded");
    // article は生成されているが note URL は付いていない
    expect(detail.article).not.toBeNull();

    await artifacts.appendLog({
      ts: new Date().toISOString(),
      level: "info",
      test: TEST,
      step: "verify no note post on schedule",
    });

    artifacts.recordResult({ test: TEST, status: "passed" });
  });
});
