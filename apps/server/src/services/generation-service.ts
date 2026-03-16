import type { GenerationJobCreateInput } from "@note-local/shared";
import { desc, eq, inArray } from "drizzle-orm";
import type { AiProvider } from "../providers/ai-provider.js";
import type { AppDatabase } from "../db/client.js";
import {
  executionLogs,
  generatedArticles,
  generationJobs,
  jobReferenceMaterials,
  noteAccounts,
  promptTemplates,
  referenceMaterials,
  saveAttempts
} from "../db/schema.js";

const now = () => new Date().toISOString();

export class GenerationService {
  private readonly queue: number[] = [];
  private processing = false;
  private readonly providerOverrides = new Map<number, AiProvider>();

  constructor(
    private readonly db: AppDatabase,
    private readonly aiProvider: AiProvider
  ) {}

  async createJob(input: GenerationJobCreateInput & { aiProviderOverride?: AiProvider }) {
    const [inserted] = await this.db
      .insert(generationJobs)
      .values({
        keyword: input.keyword,
        noteAccountId: input.noteAccountId,
        promptTemplateId: input.promptTemplateId,
        targetGenre: input.targetGenre ?? null,
        monetizationEnabled: input.monetizationEnabled ? 1 : 0,
        salesMode: input.salesMode,
        desiredPriceYen: input.desiredPriceYen,
        additionalInstruction: input.additionalInstruction,
        status: "queued",
        createdAt: now(),
        updatedAt: now()
      })
      .returning();

    for (const referenceMaterialId of input.referenceMaterialIds) {
      await this.db.insert(jobReferenceMaterials).values({
        generationJobId: inserted.id,
        referenceMaterialId,
        usageRole: "context",
        createdAt: now()
      });
    }

    if (input.aiProviderOverride) {
      this.providerOverrides.set(inserted.id, input.aiProviderOverride);
    }
    await this.log(inserted.id, "info", "article", "記事生成ジョブを受付");
    this.enqueue(inserted.id);
    return inserted;
  }

  enqueue(jobId: number) {
    this.queue.push(jobId);
    if (!this.processing) {
      void this.processQueue();
    }
  }

  private async processQueue() {
    this.processing = true;
    while (this.queue.length > 0) {
      const jobId = this.queue.shift();
      if (!jobId) continue;
      try {
        await this.processJob(jobId);
      } catch (error) {
        await this.db
          .update(generationJobs)
          .set({ status: "failed", updatedAt: now() })
          .where(eq(generationJobs.id, jobId));
        await this.log(jobId, "error", "article", error instanceof Error ? error.message : "記事生成失敗");
      }
    }
    this.processing = false;
  }

  async processJob(jobId: number) {
    const [job] = await this.db.select().from(generationJobs).where(eq(generationJobs.id, jobId)).limit(1);
    if (!job) throw new Error("JOB_NOT_FOUND");

    await this.db
      .update(generationJobs)
      .set({ status: "running", updatedAt: now() })
      .where(eq(generationJobs.id, jobId));

    const [promptTemplate] = await this.db
      .select()
      .from(promptTemplates)
      .where(eq(promptTemplates.id, job.promptTemplateId))
      .limit(1);
    if (!promptTemplate) throw new Error("PROMPT_TEMPLATE_NOT_FOUND");

    const links = await this.db
      .select()
      .from(jobReferenceMaterials)
      .where(eq(jobReferenceMaterials.generationJobId, jobId));
    const referenceIds = links.map((link) => link.referenceMaterialId);
    const references = referenceIds.length
      ? await this.db.select().from(referenceMaterials).where(inArray(referenceMaterials.id, referenceIds))
      : [];

    const activeProvider = this.providerOverrides.get(jobId) ?? this.aiProvider;
    this.providerOverrides.delete(jobId);
    const article = await activeProvider.generateArticle({
      keyword: job.keyword,
      targetGenre: job.targetGenre,
      additionalInstruction: job.additionalInstruction,
      referenceSummaries: references.map((item) => item.summaryText),
      monetizationEnabled: job.monetizationEnabled === 1,
      salesMode: job.salesMode as "normal" | "free_paid",
      desiredPriceYen: job.desiredPriceYen ?? null,
      systemPrompt: promptTemplate.articleSystemPrompt,
      userPromptTemplate: promptTemplate.articleUserPromptTemplate
    });

    await this.db.insert(generatedArticles).values({
      generationJobId: jobId,
      title: article.title,
      genreLabel: article.genreLabel,
      leadText: article.leadText,
      freePreviewMarkdown: article.freePreviewMarkdown,
      paidContentMarkdown: article.paidContentMarkdown,
      transitionCtaText: article.transitionCtaText,
      salesHookText: article.salesHookText,
      recommendedPriceYen: article.recommendedPriceYen,
      bodyMarkdown: article.bodyMarkdown,
      noteRenderedBody: article.noteRenderedBody,
      status: "generated",
      createdAt: now(),
      updatedAt: now()
    });

    await this.db
      .update(generationJobs)
      .set({ status: "succeeded", providerName: activeProvider.providerName, updatedAt: now() })
      .where(eq(generationJobs.id, jobId));

    await this.log(jobId, "info", "article", `記事生成が完了 (${activeProvider.providerName})`);
    if (job.monetizationEnabled === 1) {
      await this.log(jobId, "info", "sales", "無料→有料導線を生成");
    }
  }

  async listJobs() {
    return this.db
      .select({
        id: generationJobs.id,
        keyword: generationJobs.keyword,
        targetGenre: generationJobs.targetGenre,
        salesMode: generationJobs.salesMode,
        status: generationJobs.status,
        noteAccountName: noteAccounts.displayName,
        createdAt: generationJobs.createdAt,
        updatedAt: generationJobs.updatedAt
      })
      .from(generationJobs)
      .innerJoin(noteAccounts, eq(generationJobs.noteAccountId, noteAccounts.id))
      .orderBy(desc(generationJobs.id));
  }

  async getJobDetail(jobId: number) {
    const [job] = await this.db
      .select({
        id: generationJobs.id,
        keyword: generationJobs.keyword,
        targetGenre: generationJobs.targetGenre,
        salesMode: generationJobs.salesMode,
        status: generationJobs.status,
        noteAccountName: noteAccounts.displayName,
        createdAt: generationJobs.createdAt,
        updatedAt: generationJobs.updatedAt,
        additionalInstruction: generationJobs.additionalInstruction,
        monetizationEnabled: generationJobs.monetizationEnabled,
        desiredPriceYen: generationJobs.desiredPriceYen
      })
      .from(generationJobs)
      .innerJoin(noteAccounts, eq(generationJobs.noteAccountId, noteAccounts.id))
      .where(eq(generationJobs.id, jobId))
      .limit(1);
    if (!job) return null;

    const [article] = await this.db
      .select()
      .from(generatedArticles)
      .where(eq(generatedArticles.generationJobId, jobId))
      .limit(1);
    const attempts = await this.db
      .select()
      .from(saveAttempts)
      .where(eq(saveAttempts.generationJobId, jobId))
      .orderBy(desc(saveAttempts.id));
    const logs = await this.db
      .select({
        id: executionLogs.id,
        level: executionLogs.logLevel,
        category: executionLogs.category,
        message: executionLogs.message,
        createdAt: executionLogs.createdAt
      })
      .from(executionLogs)
      .where(eq(executionLogs.generationJobId, jobId))
      .orderBy(desc(executionLogs.id));
    const references = await this.db
      .select({
        id: referenceMaterials.id,
        title: referenceMaterials.title,
        sourceType: referenceMaterials.sourceType,
        summaryText: referenceMaterials.summaryText
      })
      .from(jobReferenceMaterials)
      .innerJoin(referenceMaterials, eq(jobReferenceMaterials.referenceMaterialId, referenceMaterials.id))
      .where(eq(jobReferenceMaterials.generationJobId, jobId));

    return {
      id: job.id,
      keyword: job.keyword,
      targetGenre: job.targetGenre ?? null,
      salesMode: job.salesMode,
      status: job.status,
      noteAccountName: job.noteAccountName,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      additionalInstruction: job.additionalInstruction,
      monetizationEnabled: job.monetizationEnabled === 1,
      desiredPriceYen: job.desiredPriceYen ?? null,
      references,
      article: article
        ? {
            id: article.id,
            generationJobId: article.generationJobId,
            title: article.title,
            genreLabel: article.genreLabel,
            leadText: article.leadText,
            freePreviewMarkdown: article.freePreviewMarkdown,
            paidContentMarkdown: article.paidContentMarkdown,
            transitionCtaText: article.transitionCtaText,
            salesHookText: article.salesHookText,
            recommendedPriceYen: article.recommendedPriceYen ?? null,
            bodyMarkdown: article.bodyMarkdown,
            noteRenderedBody: article.noteRenderedBody,
            status: article.status,
            saveAttempts: attempts.map((attempt) => ({
              method: attempt.method as "unofficial_api" | "playwright" | "pinchtab",
              result: attempt.result as "success" | "failed",
              draftUrl: attempt.draftUrl ?? null,
              saleSettingStatus: attempt.saleSettingStatus as "not_required" | "applied" | "failed",
              errorCode: attempt.errorCode ?? null,
              errorMessage: attempt.errorMessage ?? null
            }))
          }
        : null,
      logs
    };
  }

  async log(jobId: number | null, level: "info" | "warn" | "error", category: string, message: string) {
    await this.db.insert(executionLogs).values({
      generationJobId: jobId,
      logLevel: level,
      category,
      message,
      detailJson: null,
      createdAt: now()
    });
  }
}
