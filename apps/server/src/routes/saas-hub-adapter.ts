/**
 * saas-hub-adapter.ts
 *
 * Thin compatibility layer that translates saas-hub frontend API calls
 * into the existing generation-service / note-save-service backend.
 */
import type { FastifyInstance } from "fastify";
import { desc, eq, notInArray } from "drizzle-orm";
import type { AppDatabase } from "../db/client.js";
import {
  appSettings,
  generatedArticles,
  generationJobs,
  noteAccounts,
  promptTemplates,
  saveAttempts,
} from "../db/schema.js";
import type { AiProvider } from "../providers/ai-provider.js";
import { GitHubCopilotProvider } from "../providers/github-copilot-provider.js";
import type { GenerationService } from "../services/generation-service.js";
import type { NoteSaveService } from "../services/note-save-service.js";
import type { SaasHubStateService } from "../services/saas-hub-state-service.js";
import type { ProviderRegistry, ProviderId, ProviderSummary } from "../services/provider-registry.js";
import fs from "node:fs/promises";
import { captureSession, getDependencyChecks, installPlaywrightBrowser } from "../setup/setup-service.js";
import { resolveDataPath } from "../config.js";

// ---- local type aliases mirroring saas-hub/src/lib/app-data.ts ----
type AppStatusType = "generating" | "completed" | "error" | "saved" | "published" | "pending" | "running";
type SaleMode = "free" | "paid";
type NoteMethod = "unofficial_api" | "playwright" | "pinchtab";

type AccountRecord = { id: string; name: string; priority: number };
type PromptRecord = { id: string; title: string; description: string; content: string };
type TimelineItem = { label: string; time: string; status?: "success" | "error" | "info" };
type ArticleRecord = {
  id: string;
  title: string;
  keyword: string;
  genre: string;
  status: AppStatusType;
  noteStatus: AppStatusType;
  createdAt: string;
  scheduledAt: string | null;
  noteUrl: string | null;
  freeContent: string;
  paidGuidance: string;
  paidContent: string;
  body: string;
  references: { title: string; summary: string; link: string }[];
  timeline: TimelineItem[];
  saleMode: SaleMode;
  price: number | null;
  accountId: string;
  promptId?: string;
  instruction?: string;
  providerId?: ProviderId;
  lastNoteMethod?: NoteMethod | null;
  saleSettingStatus?: string | null;
  lastError?: string | null;
};
type DiagnosticsRecord = {
  name: string;
  status: AppStatusType;
  detail: string;
  category?: "runtime" | "ai" | "note";
};
type AppSettings = {
  localhostPort: number;
  playwrightHeadless: boolean;
  pinchTabUrl: string;
  pinchTabPort: number;
  pinchTabToken: string;
  pinchTabProfileName: string;
  noteLoginId: string;
  noteLoginPassword: string;
  noteUnofficialApiUrl: string;
  noteUnofficialApiToken: string;
  preferPinchTab: boolean;
  chromiumInstalled: boolean;
  defaultProvider: ProviderId;
  fallbackProviders: ProviderId[];
  strictProviderMode: boolean;
  generationTimeoutMs: number;
  providerSummaries: Record<ProviderId, ProviderSummary>;
};
type AppDataState = {
  articles: ArticleRecord[];
  prompts: PromptRecord[];
  accounts: AccountRecord[];
  settings: AppSettings;
  diagnostics: DiagnosticsRecord[];
  lastDiagnosticsRunAt: string;
};

// ---- helpers ----

function jobStatusToAppStatus(status: string): AppStatusType {
  switch (status) {
    case "queued":
    case "running":
      return "generating";
    case "succeeded":
      return "completed";
    case "failed":
      return "error";
    default:
      return "pending";
  }
}

function diagnosticStatusToAppStatus(status: string): AppStatusType {
  if (status === "ok") return "completed";
  if (status === "warn") return "pending";
  return "error";
}

// ---- services container ----
type AdapterDeps = {
  db: AppDatabase;
  aiProvider: AiProvider;
  generationService: GenerationService;
  noteSaveService: NoteSaveService;
  stateService: SaasHubStateService;
  providerRegistry: ProviderRegistry;
};

// ---- build ArticleRecord from job + joined data ----
async function buildArticleRecord(
  db: AppDatabase,
  jobId: number
): Promise<ArticleRecord | null> {
  const [job] = await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.id, jobId))
    .limit(1);
  if (!job) return null;

  const [article] = await db
    .select()
    .from(generatedArticles)
    .where(eq(generatedArticles.generationJobId, jobId))
    .limit(1);

  const attempts = await db
    .select()
    .from(saveAttempts)
    .where(eq(saveAttempts.generationJobId, jobId))
    .orderBy(desc(saveAttempts.id));

  const lastAttempt = attempts[0] ?? null;
  let noteStatus: AppStatusType = "pending";
  if (lastAttempt?.result === "success") {
    noteStatus = "saved";
  }

  const lastNoteUrl = lastAttempt?.draftUrl ?? null;
  const lastMethod = (lastAttempt?.method ?? null) as NoteMethod | null;

  const timeline: TimelineItem[] = [
    { label: "記事生成受付", time: job.createdAt.slice(11, 19), status: "info" },
  ];
  if (job.status === "succeeded" && article) {
    timeline.push({ label: "本文生成完了", time: job.updatedAt.slice(11, 19), status: "success" });
  }
  if (job.status === "failed") {
    timeline.push({ label: "生成失敗", time: job.updatedAt.slice(11, 19), status: "error" });
  }
  for (const attempt of attempts.slice().reverse()) {
    timeline.push({
      label: attempt.result === "success" ? "note 保存完了" : "note 保存失敗",
      time: (attempt.finishedAt ?? attempt.startedAt).slice(11, 19),
      status: attempt.result === "success" ? "success" : "error",
    });
  }

  const saleMode: SaleMode = job.salesMode === "free_paid" ? "paid" : "free";

  return {
    id: String(job.id),
    title: article?.title ?? job.keyword,
    keyword: job.keyword,
    genre: article?.genreLabel ?? job.targetGenre ?? "",
    status: jobStatusToAppStatus(job.status),
    noteStatus,
    createdAt: job.createdAt.slice(0, 10),
    scheduledAt: null,
    noteUrl: lastNoteUrl,
    freeContent: article?.freePreviewMarkdown ?? "",
    paidGuidance: article?.transitionCtaText ?? "",
    paidContent: article?.paidContentMarkdown ?? "",
    body: article?.bodyMarkdown ?? "",
    references: [],
    timeline,
    saleMode,
    price: article?.recommendedPriceYen ?? job.desiredPriceYen ?? null,
    accountId: String(job.noteAccountId),
    promptId: String(job.promptTemplateId),
    instruction: job.additionalInstruction || undefined,
    providerId: "gemini",
    lastNoteMethod: lastMethod,
    saleSettingStatus: lastAttempt?.saleSettingStatus ?? null,
    lastError: lastAttempt?.errorMessage ?? null,
  };
}

// ---- build merged AppDataState ----
async function buildState(
  db: AppDatabase,
  stateService: SaasHubStateService,
  providerRegistry: ProviderRegistry
): Promise<AppDataState> {
  // Load sidecar
  const sidecar = (await stateService.load()) as Partial<AppDataState> | null;

  // accounts
  const dbAccounts = await db.select().from(noteAccounts);
  const accounts: AccountRecord[] = dbAccounts.map((a, i) => ({
    id: String(a.id),
    name: a.displayName,
    priority: i + 1,
  }));

  // prompts
  const dbPrompts = await db.select().from(promptTemplates);
  const prompts: PromptRecord[] = dbPrompts.map((p) => ({
    id: String(p.id),
    title: p.name,
    description: p.purpose,
    content: p.articleUserPromptTemplate || p.articleSystemPrompt,
  }));

  // articles (latest 50 jobs, excluding deleted)
  const deletedJobIds: number[] = ((sidecar as Record<string, unknown>)?.deletedJobIds as number[]) ?? [];

  const jobs = await db
    .select()
    .from(generationJobs)
    .orderBy(desc(generationJobs.id))
    .limit(50);

  const filteredJobs = deletedJobIds.length > 0
    ? jobs.filter((job) => !deletedJobIds.includes(job.id))
    : jobs;

  const articlesPromises = filteredJobs.map((job) => buildArticleRecord(db, job.id));
  const articlesRaw = await Promise.all(articlesPromises);
  const articles: ArticleRecord[] = articlesRaw.filter((a): a is ArticleRecord => a !== null);

  // settings: merge sidecar with DB row
  const [dbSettings] = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);

  const defaultSettings: AppSettings = {
    localhostPort: 3001,
    playwrightHeadless: true,
    pinchTabUrl: "http://localhost",
    pinchTabPort: 9222,
    pinchTabToken: "",
    pinchTabProfileName: "",
    noteLoginId: "",
    noteLoginPassword: "",
    noteUnofficialApiUrl: "",
    noteUnofficialApiToken: "",
    preferPinchTab: false,
    chromiumInstalled: false,
    defaultProvider: "gemini",
    fallbackProviders: ["openai", "claude"],
    strictProviderMode: false,
    generationTimeoutMs: 90000,
    providerSummaries: providerRegistry.getAll(),
  };

  const sidecarSettings = (sidecar?.settings ?? {}) as Partial<AppSettings>;
  const mergedSettings: AppSettings = {
    ...defaultSettings,
    ...sidecarSettings,
    providerSummaries: providerRegistry.getAll(),
  };

  if (dbSettings) {
    mergedSettings.localhostPort = dbSettings.localhostPort;
  }

  return {
    articles,
    prompts,
    accounts,
    settings: mergedSettings,
    diagnostics: (sidecar?.diagnostics ?? []) as DiagnosticsRecord[],
    lastDiagnosticsRunAt: (sidecar?.lastDiagnosticsRunAt as string) ?? new Date().toISOString(),
  };
}

// ---- main registration function ----
export async function registerSaasHubAdapterRoutes(
  app: FastifyInstance,
  deps: AdapterDeps
): Promise<void> {
  const { db, aiProvider, generationService, noteSaveService, stateService, providerRegistry } = deps;

  await providerRegistry.hydrate();

  // ---- GET /api/state ----
  app.get("/api/state", async () => {
    const state = await buildState(db, stateService, providerRegistry);
    return { state, providers: providerRegistry.getAll() };
  });

  // ---- PUT /api/state ----
  app.put("/api/state", async (request, reply) => {
    const body = request.body as { state: AppDataState };
    const { state } = body;
    const now = () => new Date().toISOString();

    // Upsert accounts by displayName
    const incomingAccountNames = (state.accounts ?? []).map((a) => a.name);
    for (const account of state.accounts ?? []) {
      const existing = await db
        .select()
        .from(noteAccounts)
        .where(eq(noteAccounts.displayName, account.name))
        .limit(1);
      if (existing.length > 0) {
        await db
          .update(noteAccounts)
          .set({ updatedAt: now() })
          .where(eq(noteAccounts.id, existing[0].id));
      } else {
        await db.insert(noteAccounts).values({
          displayName: account.name,
          saveModePriority: "unofficial_api",
          browserAdapterPriority: "playwright",
          fallbackEnabled: 1,
          isActive: 1,
          defaultSalesProfileId: null,
          defaultPromptTemplateId: null,
          createdAt: now(),
          updatedAt: now(),
        });
      }
    }
    // Delete DB accounts that are no longer in the state
    if (incomingAccountNames.length > 0) {
      await db.delete(noteAccounts).where(notInArray(noteAccounts.displayName, incomingAccountNames));
    } else {
      await db.delete(noteAccounts);
    }

    // Upsert prompts by name
    for (const prompt of state.prompts ?? []) {
      const existing = await db
        .select()
        .from(promptTemplates)
        .where(eq(promptTemplates.name, prompt.title))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(promptTemplates).values({
          name: prompt.title,
          purpose: prompt.description,
          targetMedia: "note",
          genreScope: "all",
          articleSystemPrompt: prompt.content,
          articleUserPromptTemplate: prompt.content,
          referencePromptTemplate: "",
          salesTransitionTemplate: "",
          createdAt: now(),
          updatedAt: now(),
        });
      }
    }

    // Update DB appSettings
    if (state.settings) {
      await db
        .update(appSettings)
        .set({
          localhostPort: state.settings.localhostPort ?? 3001,
          updatedAt: now(),
        })
        .where(eq(appSettings.id, 1));
    }

    // Save full state to sidecar, preserving server-side-only keys
    const existing = (await stateService.load()) ?? {};
    await stateService.save({
      ...state as unknown as Record<string, unknown>,
      providerConfigs: existing.providerConfigs,
      providerSummaries: existing.providerSummaries,
      githubCopilotAuth: existing.githubCopilotAuth,
    });

    reply.send({ result: "success", providers: providerRegistry.getAll() });
  });

  // ---- POST /api/generate-article ----
  app.post("/api/generate-article", async (request, reply) => {
    const body = request.body as {
      input: {
        keyword: string;
        genre?: string;
        accountId: string;
        promptId?: string;
        saleMode: "free" | "paid";
        price: number | null;
        instruction?: string;
        action: "publish" | "draft" | "schedule";
        providerId?: ProviderId;
        scheduledAt?: string | null;
      };
      settings: AppSettings;
    };

    const { input } = body;

    // Resolve noteAccountId
    let noteAccountId = Number(input.accountId);
    if (!Number.isFinite(noteAccountId) || noteAccountId <= 0) {
      // Fallback: pick the first account in DB
      const [firstAccount] = await db.select().from(noteAccounts).limit(1);
      if (!firstAccount) {
        reply.code(400).send({ error: { code: "NO_ACCOUNT", message: "noteアカウントが存在しません" } });
        return;
      }
      noteAccountId = firstAccount.id;
    }

    // Resolve promptTemplateId
    let promptTemplateId = Number(input.promptId);
    if (!Number.isFinite(promptTemplateId) || promptTemplateId <= 0) {
      const [firstTemplate] = await db.select().from(promptTemplates).limit(1);
      if (!firstTemplate) {
        reply.code(400).send({ error: { code: "NO_TEMPLATE", message: "プロンプトテンプレートが存在しません" } });
        return;
      }
      promptTemplateId = firstTemplate.id;
    }

    // Create the job
    const job = await generationService.createJob({
      keyword: input.keyword,
      noteAccountId,
      promptTemplateId,
      targetGenre: input.genre || undefined,
      monetizationEnabled: input.saleMode === "paid",
      salesMode: input.saleMode === "paid" ? "free_paid" : "normal",
      desiredPriceYen: input.price ?? null,
      additionalInstruction: input.instruction ?? "",
      referenceMaterialIds: [],
    });

    // Poll until done
    const TIMEOUT_MS = 90_000;
    const INTERVAL_MS = 500;
    const startedAt = Date.now();

    let jobDetail = await generationService.getJobDetail(job.id);
    while (
      jobDetail?.status !== "succeeded" &&
      jobDetail?.status !== "failed" &&
      Date.now() - startedAt < TIMEOUT_MS
    ) {
      await new Promise<void>((resolve) => setTimeout(resolve, INTERVAL_MS));
      jobDetail = await generationService.getJobDetail(job.id);
    }

    // Perform note action after generation
    if (jobDetail?.status === "succeeded") {
      try {
        if (input.action === "draft") {
          await noteSaveService.saveJob(job.id, {
            noteAccountId,
            forceMethod: null,
            applySaleSettings: input.saleMode === "paid",
          });
        } else if (input.action === "publish") {
          await noteSaveService.publishJob(job.id, {
            noteAccountId,
            forceMethod: null,
            applySaleSettings: input.saleMode === "paid",
          });
        }
      } catch {
        // Non-fatal: article was generated, note save failed
      }
    }

    const article = await buildArticleRecord(db, job.id);

    if (!article) {
      // Should not happen, but provide a fallback
      reply.code(500).send({ error: { code: "BUILD_FAILED", message: "記事レコードの構築に失敗" } });
      return;
    }

    reply.send({ article, generationMode: input.providerId ?? "gemini" });
  });

  // ---- POST /api/note/draft ----
  app.post("/api/note/draft", async (request, reply) => {
    const body = request.body as { article: ArticleRecord; settings: AppSettings };
    const jobId = Number(body.article?.id);

    if (!Number.isFinite(jobId) || jobId <= 0) {
      reply.code(400).send({ error: { code: "INVALID_ID", message: "記事IDが無効です" } });
      return;
    }

    const noteAccountId = Number(body.article.accountId);

    try {
      const result = await noteSaveService.saveJob(jobId, {
        noteAccountId: Number.isFinite(noteAccountId) ? noteAccountId : 1,
        forceMethod: null,
        applySaleSettings: body.article.saleMode === "paid",
      });
      reply.send({
        method: result.methodUsed,
        draftUrl: result.draftUrl,
        saleSettingStatus: result.saleSettingStatus,
      });
    } catch (error) {
      reply.code(400).send({
        error: {
          code: "SAVE_FAILED",
          message: error instanceof Error ? error.message : "下書き保存に失敗",
        },
      });
    }
  });

  // ---- POST /api/note/publish ----
  app.post("/api/note/publish", async (request, reply) => {
    const body = request.body as { article: ArticleRecord; settings: AppSettings };
    const jobId = Number(body.article?.id);

    if (!Number.isFinite(jobId) || jobId <= 0) {
      reply.code(400).send({ error: { code: "INVALID_ID", message: "記事IDが無効です" } });
      return;
    }

    const noteAccountId = Number(body.article.accountId);

    try {
      const result = await noteSaveService.publishJob(jobId, {
        noteAccountId: Number.isFinite(noteAccountId) ? noteAccountId : 1,
        forceMethod: null,
        applySaleSettings: body.article.saleMode === "paid",
      });
      reply.send({
        method: result.methodUsed,
        draftUrl: result.draftUrl,
        saleSettingStatus: result.saleSettingStatus,
      });
    } catch (error) {
      reply.code(400).send({
        error: {
          code: "PUBLISH_FAILED",
          message: error instanceof Error ? error.message : "公開に失敗",
        },
      });
    }
  });

  // ---- GET /api/ai/providers ----
  app.get("/api/ai/providers", async () => ({
    providers: providerRegistry.getAll(),
  }));

  // ---- PUT /api/ai/providers/:id ----
  app.put("/api/ai/providers/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id as ProviderId;
    const patch = request.body as {
      apiKey?: string;
      model?: string;
      baseUrl?: string;
      enabled?: boolean;
      configuredClientId?: string | null;
    };

    const current = providerRegistry.getOne(id);
    if (!current) {
      reply.code(404).send({ error: { code: "PROVIDER_NOT_FOUND", message: "プロバイダが見つかりません" } });
      return;
    }

    const updated = await providerRegistry.updateOne(
      id,
      {
        configured: !!patch.apiKey || current.configured,
        usable: !!patch.apiKey || current.usable,
        reachable: !!patch.apiKey || current.reachable,
        enabled: patch.enabled ?? current.enabled,
        model: patch.model ?? current.model,
        baseUrl: patch.baseUrl ?? current.baseUrl,
        configuredClientId: patch.configuredClientId ?? current.configuredClientId,
      },
      patch.apiKey,
    );

    reply.send({ provider: updated });
  });

  // ---- POST /api/ai/providers/:id/test ----
  app.post("/api/ai/providers/:id/test", async (request, reply) => {
    const id = (request.params as { id: string }).id as ProviderId;
    const result = await providerRegistry.testOne(id);
    reply.send({ provider: result });
  });

  // ---- POST /api/diagnostics/run (saas-hub compatible format) ----
  // This replaces the simpler route previously in app.ts.
  app.post("/api/diagnostics/run", async () => {
    const [aiHealth, depChecks, adapterChecks] = await Promise.all([
      aiProvider.healthCheck(),
      getDependencyChecks(),
      noteSaveService.verifyAdapters(),
    ]);

    const diagnostics: DiagnosticsRecord[] = [
      ...depChecks.map((c) => ({
        name: c.name,
        status: diagnosticStatusToAppStatus(c.status),
        detail: c.detail,
        category: "runtime" as const,
      })),
      {
        name: "AI Provider (Gemini)",
        status: diagnosticStatusToAppStatus(aiHealth.status),
        detail: aiHealth.detail,
        category: "ai" as const,
      },
      ...adapterChecks.map((c) => ({
        name: c.name,
        status: diagnosticStatusToAppStatus(c.status),
        detail: c.detail,
        category: "note" as const,
      })),
    ];

    const providers = providerRegistry.getAll();

    const codexStatus = {
      configured: false,
      reachable: false,
      usable: false,
      model: "gpt-5-codex",
      authPath: "",
      tokenKind: null as null,
      lastTestStatus: "error" as const,
      lastTestError: "Codex CLI は非対応",
    };

    const copilotSummary = providerRegistry.getOne("github_copilot") ?? {
      id: "github_copilot" as ProviderId,
      label: "GitHub Copilot",
      authMode: "oauth" as const,
      configured: false,
      reachable: false,
      usable: false,
      enabled: true,
      model: "github-copilot/gpt-5.4",
      baseUrl: null,
      lastTestStatus: "pending" as const,
      lastTestError: null,
      lastTestAt: null,
    };

    const copilotStatus = {
      ...copilotSummary,
      githubTokenPresent: false,
      copilotTokenReady: false,
      oauthClientIdSource: "none" as const,
      configuredOauthClientId: null,
      lastExchangeStatus: null,
      lastExchangeError: null,
    };

    return { diagnostics, providers, codexStatus, copilotStatus };
  });

  // ---- POST /api/playwright/install ----
  app.post("/api/playwright/install", async (request, reply) => {
    try {
      const result = await installPlaywrightBrowser();
      reply.send({ result: "success", output: result.output });
    } catch (error) {
      reply.code(400).send({
        error: {
          code: "PLAYWRIGHT_INSTALL_FAILED",
          message: error instanceof Error ? error.message : "Playwright 導入に失敗",
        },
      });
    }
  });

  // ---- GitHub Copilot device flow routes ----
  const makeCopilotProvider = () => {
    const summary = providerRegistry.getOne("github_copilot");
    return new GitHubCopilotProvider({
      stateService,
      model: summary?.model ?? "github-copilot/gpt-5.4",
      configuredClientId: summary?.configuredClientId ?? null,
    });
  };

  app.post("/api/ai/providers/github-copilot/device/start", async (_request, reply) => {
    try {
      const result = await makeCopilotProvider().startDeviceFlow();
      reply.send(result);
    } catch (error) {
      reply.code(400).send({ error: { code: "COPILOT_DEVICE_START_FAILED", message: error instanceof Error ? error.message : "Device flow開始失敗" } });
    }
  });

  app.post("/api/ai/providers/github-copilot/device/poll", async (request, reply) => {
    const { deviceCode } = request.body as { deviceCode: string };
    try {
      const result = await makeCopilotProvider().pollDeviceFlow(deviceCode);
      if (result.status === "completed") {
        await providerRegistry.updateOne("github_copilot", { configured: true, usable: true, reachable: true });
      }
      reply.send(result);
    } catch (error) {
      reply.code(400).send({ error: { code: "COPILOT_DEVICE_POLL_FAILED", message: error instanceof Error ? error.message : "Device flow確認失敗" } });
    }
  });

  app.get("/api/ai/providers/github-copilot/status", async (_request, reply) => {
    const sidecar = (await stateService.load()) as Record<string, unknown> | null;
    const auth = (sidecar?.githubCopilotAuth as Record<string, unknown>) ?? {};
    const summary = providerRegistry.getOne("github_copilot") ?? {
      id: "github_copilot" as ProviderId,
      label: "GitHub Copilot",
      authMode: "oauth" as const,
      configured: false,
      reachable: false,
      usable: false,
      enabled: true,
      model: "github-copilot/gpt-5.4",
      baseUrl: null,
      lastTestStatus: "pending" as const,
      lastTestError: null,
      lastTestAt: null,
    };
    reply.send({
      status: {
        ...summary,
        githubTokenPresent: !!auth.githubToken,
        copilotTokenReady: !!auth.copilotToken,
        oauthClientIdSource: auth.oauthClientIdSource ?? "none",
        configuredOauthClientId: auth.configuredOauthClientId ?? null,
        lastExchangeStatus: auth.lastExchangeStatus ?? null,
        lastExchangeError: auth.lastExchangeError ?? null,
      },
    });
  });

  app.post("/api/ai/providers/github-copilot/disconnect", async (_request, reply) => {
    await makeCopilotProvider().disconnect();
    await providerRegistry.updateOne("github_copilot", { configured: false, usable: false, reachable: false });
    const summary = providerRegistry.getOne("github_copilot")!;
    reply.send({
      status: {
        ...summary,
        githubTokenPresent: false,
        copilotTokenReady: false,
        oauthClientIdSource: "none",
        configuredOauthClientId: null,
        lastExchangeStatus: null,
        lastExchangeError: null,
      },
    });
  });

  // ---- Codex CLI status ----
  app.get("/api/ai/providers/codex-cli/status", async (_request, reply) => {
    const summary = providerRegistry.getOne("codex_cli");
    reply.send({ status: summary });
  });

  // ---- DELETE /api/articles/:id ----
  app.delete("/api/articles/:id", async (request, reply) => {
    const rawId = (request.params as { id: string }).id;
    const id = Number(rawId);
    // Non-numeric IDs are manually created articles (frontend-only, not in DB)
    if (!Number.isFinite(id) || id <= 0) {
      reply.send({ result: "success" });
      return;
    }
    const sidecar = ((await stateService.load()) ?? {}) as Record<string, unknown>;
    const deletedJobIds: number[] = (sidecar.deletedJobIds as number[]) ?? [];
    if (!deletedJobIds.includes(id)) {
      deletedJobIds.push(id);
    }
    await stateService.save({ ...sidecar, deletedJobIds });
    reply.send({ result: "success" });
  });

  // ---- POST /api/note-accounts/:id/capture-session ----
  app.post("/api/note-accounts/:id/capture-session", async (request, reply) => {
    const accountId = (request.params as { id: string }).id;
    // Fire and forget — browser opens, user logs in, window close saves session
    void captureSession(accountId === "default" ? undefined : accountId).catch(() => {
      // session capture errors are non-fatal
    });
    reply.send({
      success: true,
      message: "ブラウザを起動しました。ログイン後ウィンドウを閉じてください。",
    });
  });

  // ---- GET /api/note-accounts/:id/session-status ----
  app.get("/api/note-accounts/:id/session-status", async (request, reply) => {
    const accountId = (request.params as { id: string }).id;
    const filename = accountId === "default"
      ? "note-storage-state.json"
      : `note-session-${accountId}.json`;
    const sessionPath = resolveDataPath(filename);
    let hasSession = false;
    try {
      await fs.access(sessionPath);
      hasSession = true;
    } catch {
      // file not found
    }
    reply.send({ hasSession, sessionPath });
  });
}
