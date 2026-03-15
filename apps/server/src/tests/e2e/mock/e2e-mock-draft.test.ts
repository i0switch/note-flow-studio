/**
 * e2e:mock — draft save
 *
 * ENABLE_REAL_NOTE_AUTOMATION=false (enforced in beforeEach)
 * Uses in-memory SQLite — no persistence between tests.
 * SafetyGuard asserts all URLs contain "/mock/".
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
import { makeJobPayload, makePaidJobPayload, makeSavePayload, makeRunId } from "../__helpers__/test-data-factory.js";

const RUN_ID = makeRunId("e2e-mock-draft");
let artifacts: ArtifactWriter;
let driver: NoteVerificationDriver;
let app: Awaited<ReturnType<typeof buildApp>>;
let tmpStateFile: string;

beforeEach(async () => {
  // Enforce mock mode — never real note.com
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

describe("e2e:mock draft save", () => {
  it("unofficial_api mock が /mock/draft/ URL を返す", async () => {
    const TEST = "unofficial_api mock draft";
    const jobId = await driver.createJob(
      makeJobPayload({ runId: RUN_ID }),
      TEST
    );
    await driver.waitForJob(jobId, TEST);

    const result = await driver.saveDraft(
      jobId,
      makeSavePayload({ forceMethod: "unofficial_api" }),
      TEST
    );

    expect(result.statusCode).toBe(200);
    expect(result.draftUrl).toContain("/mock/draft/");
    expect(result.methodUsed).toBe("unofficial_api");

    artifacts.recordResult({
      test: TEST,
      status: "passed",
      draftUrl: result.draftUrl ?? undefined,
      methodUsed: result.methodUsed ?? undefined,
    });
  });

  it("playwright mock が /mock/playwright/ URL を返す", async () => {
    const TEST = "playwright mock draft";
    const jobId = await driver.createJob(
      makeJobPayload({ runId: RUN_ID }),
      TEST
    );
    await driver.waitForJob(jobId, TEST);

    const result = await driver.saveDraft(
      jobId,
      makeSavePayload({ forceMethod: "playwright" }),
      TEST
    );

    expect(result.statusCode).toBe(200);
    expect(result.draftUrl).toContain("/mock/playwright/");
    expect(result.methodUsed).toBe("playwright");

    artifacts.recordResult({
      test: TEST,
      status: "passed",
      draftUrl: result.draftUrl ?? undefined,
      methodUsed: result.methodUsed ?? undefined,
    });
  });

  it("pinchtab mock が /mock/pinchtab/ URL を返す", async () => {
    const TEST = "pinchtab mock draft";
    const jobId = await driver.createJob(
      makeJobPayload({ runId: RUN_ID }),
      TEST
    );
    await driver.waitForJob(jobId, TEST);

    const result = await driver.saveDraft(
      jobId,
      makeSavePayload({ forceMethod: "pinchtab" }),
      TEST
    );

    expect(result.statusCode).toBe(200);
    expect(result.draftUrl).toContain("/mock/pinchtab/");
    expect(result.methodUsed).toBe("pinchtab");

    artifacts.recordResult({
      test: TEST,
      status: "passed",
      draftUrl: result.draftUrl ?? undefined,
      methodUsed: result.methodUsed ?? undefined,
    });
  });

  it("API 失敗 → Playwright へフォールバック", async () => {
    env.MOCK_NOTE_API_RESULT = "fail";
    const TEST = "api-fail fallback to playwright";
    const jobId = await driver.createJob(
      makeJobPayload({ runId: RUN_ID }),
      TEST
    );
    await driver.waitForJob(jobId, TEST);

    const result = await driver.saveDraft(
      jobId,
      makeSavePayload({ forceMethod: null }),
      TEST
    );

    expect(result.statusCode).toBe(200);
    expect(result.methodUsed).toBe("playwright");
    expect(result.draftUrl).toContain("/mock/playwright/");

    artifacts.recordResult({ test: TEST, status: "passed", methodUsed: result.methodUsed ?? undefined });
  });

  it("全経路失敗 → 400 を返す", async () => {
    env.MOCK_NOTE_API_RESULT = "fail";
    env.MOCK_PLAYWRIGHT_RESULT = "fail";
    env.MOCK_PINCHTAB_RESULT = "fail";
    const TEST = "all methods fail";
    const jobId = await driver.createJob(
      makeJobPayload({ runId: RUN_ID }),
      TEST
    );
    await driver.waitForJob(jobId, TEST);

    const result = await driver.saveDraft(
      jobId,
      makeSavePayload({ forceMethod: null }),
      TEST
    );

    expect(result.statusCode).toBe(400);
    expect(result.errorCode).toBe("ALL_SAVE_METHODS_FAILED");

    artifacts.recordResult({ test: TEST, status: "passed" });
  });

  it("有料記事 draft — free_paid mode で saleSettingStatus=failed (mock は未適用)", async () => {
    const TEST = "paid draft mock";
    const jobId = await driver.createJob(
      makePaidJobPayload({ runId: RUN_ID }),
      TEST
    );
    await driver.waitForJob(jobId, TEST);

    const result = await driver.saveDraft(
      jobId,
      makeSavePayload({ applySaleSettings: true }),
      TEST
    );

    expect(result.statusCode).toBe(200);
    expect(result.draftUrl).toContain("/mock/");

    artifacts.recordResult({ test: TEST, status: "passed" });
  });
});
