import type { buildApp } from "../../../app.js";
import type { ArtifactWriter } from "./artifact-writer.js";
import { SafetyGuard } from "./safety-guard.js";
import type { JobPayload, SaveNotePayload } from "./test-data-factory.js";

type App = Awaited<ReturnType<typeof buildApp>>;

export type SaveResult = {
  statusCode: number;
  methodUsed: string | null;
  draftUrl: string | null;
  saleSettingStatus: string | null;
  errorCode?: string;
};

export type JobDetail = {
  status: string;
  article: {
    title: string;
    transitionCtaText: string;
  } | null;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * NoteVerificationDriver — the single interface through which E2E tests
 * touch the API server.
 *
 * All requests are logged to the provided ArtifactWriter.
 * SafetyGuard.check() is called on every response that produces a URL.
 */
export class NoteVerificationDriver {
  private readonly guard: SafetyGuard;

  constructor(
    private readonly app: App,
    private readonly artifacts: ArtifactWriter
  ) {
    this.guard = new SafetyGuard(artifacts.mode);
  }

  /** Create a generation job and return its numeric ID. */
  async createJob(payload: JobPayload, test: string): Promise<number> {
    const start = Date.now();
    const res = await this.app.inject({
      method: "POST",
      url: "/api/generation-jobs",
      payload,
    });
    await this.artifacts.appendLog({
      ts: new Date().toISOString(),
      level: res.statusCode === 201 ? "info" : "error",
      test,
      step: "POST /api/generation-jobs",
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    });

    if (res.statusCode !== 201) {
      throw new Error(`createJob failed: HTTP ${res.statusCode} ${res.body}`);
    }
    return (res.json() as { id: number }).id;
  }

  /** Poll until status is succeeded or failed (max 30 attempts × 50ms). */
  async waitForJob(jobId: number, test: string): Promise<JobDetail> {
    let detail: JobDetail | null = null;
    for (let i = 0; i < 30; i++) {
      await sleep(50);
      const res = await this.app.inject({
        method: "GET",
        url: `/api/generation-jobs/${jobId}`,
      });
      if (res.statusCode !== 200) continue;
      detail = res.json() as JobDetail;
      if (detail.status === "succeeded" || detail.status === "failed") break;
    }
    if (!detail) throw new Error(`waitForJob(${jobId}) timed out`);
    await this.artifacts.appendLog({
      ts: new Date().toISOString(),
      level: "info",
      test,
      step: `job ${jobId} completed`,
    });
    return detail;
  }

  /** Save as draft and return the result. */
  async saveDraft(jobId: number, payload: SaveNotePayload, test: string): Promise<SaveResult> {
    return this._saveOrPublish(
      `/api/generation-jobs/${jobId}/save-note`,
      payload,
      test,
      "saveDraft"
    );
  }

  /** Publish and return the result. */
  async publish(jobId: number, payload: SaveNotePayload, test: string): Promise<SaveResult> {
    return this._saveOrPublish(
      `/api/generation-jobs/${jobId}/publish-note`,
      payload,
      test,
      "publish"
    );
  }

  private async _saveOrPublish(
    url: string,
    payload: SaveNotePayload,
    test: string,
    step: string
  ): Promise<SaveResult> {
    const start = Date.now();
    const res = await this.app.inject({ method: "POST", url, payload });
    const body = res.json() as Record<string, unknown>;

    const draftUrl = (body.draftUrl as string | undefined) ?? null;
    const methodUsed = (body.methodUsed as string | undefined) ?? null;
    const saleSettingStatus = (body.saleSettingStatus as string | undefined) ?? null;
    const errorCode =
      (body.error as { message?: string } | undefined)?.message ?? undefined;

    await this.artifacts.appendLog({
      ts: new Date().toISOString(),
      level: res.statusCode < 400 ? "info" : "error",
      test,
      step,
      statusCode: res.statusCode,
      draftUrl: draftUrl ?? undefined,
      method: methodUsed ?? undefined,
      durationMs: Date.now() - start,
      error: errorCode,
    });

    // Write HTML snapshot of response body
    await this.artifacts.saveHtml(
      `${step}-${test.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40)}`,
      JSON.stringify(body, null, 2)
    );

    // Safety check — aborts if mock URL leaked into live mode or vice versa
    this.guard.check(draftUrl);

    return { statusCode: res.statusCode, methodUsed, draftUrl, saleSettingStatus, errorCode };
  }

  /** Get current state articles list. */
  async getStateArticles(test: string): Promise<Array<{ id: unknown }>> {
    const res = await this.app.inject({ method: "GET", url: "/api/state" });
    await this.artifacts.appendLog({
      ts: new Date().toISOString(),
      level: "info",
      test,
      step: "GET /api/state",
      statusCode: res.statusCode,
    });
    return (res.json() as { state: { articles: Array<{ id: unknown }> } }).state.articles ?? [];
  }
}
