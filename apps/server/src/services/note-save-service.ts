import type { SaveNoteRequest } from "@note-local/shared";
import { desc, eq } from "drizzle-orm";
import type { SaveAdapter } from "../adapters/note-save-adapters.js";
import type { AppDatabase } from "../db/client.js";
import { generatedArticles, generationJobs, noteAccounts, saveAttempts } from "../db/schema.js";

const now = () => new Date().toISOString();

export class NoteSaveService {
  constructor(
    private readonly db: AppDatabase,
    private readonly adapters: SaveAdapter[]
  ) {}

  async saveJob(jobId: number, request: SaveNoteRequest) {
    return this.submitJob(jobId, request, "draft");
  }

  async publishJob(jobId: number, request: SaveNoteRequest) {
    return this.submitJob(jobId, request, "published");
  }

  private async submitJob(
    jobId: number,
    request: SaveNoteRequest,
    targetState: "draft" | "published"
  ) {
    const [job] = await this.db.select().from(generationJobs).where(eq(generationJobs.id, jobId)).limit(1);
    if (!job) throw new Error("JOB_NOT_FOUND");
    const [article] = await this.db
      .select()
      .from(generatedArticles)
      .where(eq(generatedArticles.generationJobId, jobId))
      .limit(1);
    if (!article) throw new Error("ARTICLE_NOT_READY");
    const [account] = await this.db
      .select()
      .from(noteAccounts)
      .where(eq(noteAccounts.id, request.noteAccountId))
      .limit(1);
    if (!account) throw new Error("ACCOUNT_NOT_FOUND");

    const methods = request.forceMethod
      ? [request.forceMethod]
      : (["unofficial_api", "playwright", "pinchtab"] as const);

    let attemptNo =
      (
        await this.db
          .select()
          .from(saveAttempts)
          .where(eq(saveAttempts.generationJobId, jobId))
          .orderBy(desc(saveAttempts.id))
          .limit(1)
      )[0]?.attemptNo ?? 0;

    for (const method of methods) {
      const adapter = this.adapters.find((item) => item.method === method);
      if (!adapter) continue;
      attemptNo += 1;
      const startedAt = now();
      try {
        const result = await adapter.save({
          jobId,
          title: article.title,
          noteBody: article.noteRenderedBody,
          freePreviewMarkdown: article.freePreviewMarkdown,
          paidContentMarkdown: article.paidContentMarkdown,
          salesMode: job.salesMode as "normal" | "free_paid",
          targetState,
          applySaleSettings: request.applySaleSettings,
          priceYen: article.recommendedPriceYen ?? null,
          transitionCtaText: article.transitionCtaText
        });
        await this.db.insert(saveAttempts).values({
          generationJobId: jobId,
          method: result.method,
          attemptNo,
          result: "success",
          draftUrl: result.draftUrl,
          saleSettingStatus: result.saleSettingStatus,
          salePriceYen: article.recommendedPriceYen,
          errorCode: null,
          errorMessage: null,
          startedAt,
          finishedAt: now()
        });
        await this.db
          .update(generatedArticles)
          .set({ status: "saved", updatedAt: now() })
          .where(eq(generatedArticles.generationJobId, jobId));
        return {
          result: "success" as const,
          methodUsed: result.method,
          draftUrl: result.draftUrl,
          saleSettingStatus: result.saleSettingStatus
        };
      } catch (error) {
        await this.db.insert(saveAttempts).values({
          generationJobId: jobId,
          method,
          attemptNo,
          result: "failed",
          draftUrl: null,
          saleSettingStatus: "failed",
          salePriceYen: article.recommendedPriceYen,
          errorCode: "SAVE_FAILED",
          errorMessage: error instanceof Error ? error.message : "unknown",
          startedAt,
          finishedAt: now()
        });
      }
    }

    throw new Error("ALL_SAVE_METHODS_FAILED");
  }

  async verifyAdapters() {
    return Promise.all(
      this.adapters.map(async (adapter) => ({
        name: adapter.method,
        ...(await adapter.verify())
      }))
    );
  }
}
