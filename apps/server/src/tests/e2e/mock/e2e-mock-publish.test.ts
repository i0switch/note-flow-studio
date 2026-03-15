/**
 * e2e:mock — publish (公開)
 *
 * ENABLE_REAL_NOTE_AUTOMATION=false (enforced in beforeEach)
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

const RUN_ID = makeRunId("e2e-mock-publish");
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

describe("e2e:mock publish", () => {
  it("playwright mock が /mock/playwright/published/ URL を返す", async () => {
    const TEST = "playwright mock publish";
    const jobId = await driver.createJob(
      makeJobPayload({ runId: RUN_ID }),
      TEST
    );
    await driver.waitForJob(jobId, TEST);

    const result = await driver.publish(
      jobId,
      makeSavePayload({ forceMethod: "playwright" }),
      TEST
    );

    expect(result.statusCode).toBe(200);
    expect(result.draftUrl).toContain("/mock/playwright/published/");
    expect(result.methodUsed).toBe("playwright");

    artifacts.recordResult({
      test: TEST,
      status: "passed",
      draftUrl: result.draftUrl ?? undefined,
      methodUsed: result.methodUsed ?? undefined,
    });
  });

  it("pinchtab mock publish が /mock/pinchtab/published/ URL を返す", async () => {
    const TEST = "pinchtab mock publish";
    const jobId = await driver.createJob(
      makeJobPayload({ runId: RUN_ID }),
      TEST
    );
    await driver.waitForJob(jobId, TEST);

    const result = await driver.publish(
      jobId,
      makeSavePayload({ forceMethod: "pinchtab" }),
      TEST
    );

    expect(result.statusCode).toBe(200);
    expect(result.draftUrl).toContain("/mock/pinchtab/published/");
    expect(result.methodUsed).toBe("pinchtab");

    artifacts.recordResult({ test: TEST, status: "passed", methodUsed: result.methodUsed ?? undefined });
  });

  it("有料記事 publish — playwright mock saleSettingStatus=applied", async () => {
    const TEST = "paid publish playwright mock";
    const jobId = await driver.createJob(
      makePaidJobPayload({ runId: RUN_ID }),
      TEST
    );
    await driver.waitForJob(jobId, TEST);

    const result = await driver.publish(
      jobId,
      makeSavePayload({ forceMethod: "playwright", applySaleSettings: true }),
      TEST
    );

    expect(result.statusCode).toBe(200);
    expect(result.saleSettingStatus).toBe("applied");

    artifacts.recordResult({ test: TEST, status: "passed" });
  });

  it("API 失敗 → Playwright publish フォールバック", async () => {
    env.MOCK_NOTE_API_RESULT = "fail";
    const TEST = "publish fallback to playwright";
    const jobId = await driver.createJob(
      makeJobPayload({ runId: RUN_ID }),
      TEST
    );
    await driver.waitForJob(jobId, TEST);

    const result = await driver.publish(
      jobId,
      makeSavePayload({ forceMethod: null }),
      TEST
    );

    expect(result.statusCode).toBe(200);
    expect(result.methodUsed).toBe("playwright");

    artifacts.recordResult({ test: TEST, status: "passed", methodUsed: result.methodUsed ?? undefined });
  });
});
