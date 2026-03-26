import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { loadAppState, saveAppState } from "./appStateStore";
import {
  disconnectCopilot,
  generateArticleWithProviders,
  getCodexCliStatus,
  getCopilotStatus,
  listProviderSummaries,
  pollCopilotDeviceFlow,
  regenerateAssetsWithProviders,
  saveProviderConfig,
  startCopilotDeviceFlow,
  testProvider,
  type AiRuntimeSettings,
} from "./aiProviders";
import { loadProviderSecrets, type ProviderId } from "./providerSecretsStore";
import { runDiagnostics, saveArticleToNote, type RuntimeSettings } from "./noteAutomation";
import { getImageGenerator, type ImageGenerationError } from "./imageGenerator";

const app = Fastify({ logger: false });

const providerIds = [
  "gemini",
  "claude",
  "openai",
  "codex_cli",
  "github_copilot",
  "alibaba_model_studio",
  "openrouter",
  "groq",
  "deepseek",
  "xai",
  "custom_openai_compatible",
] as const satisfies ProviderId[];

const providerIdSchema = z.enum(providerIds);

const providerSummarySchema = z.object({
  id: providerIdSchema,
  label: z.string(),
  authMode: z.enum(["api_key", "oauth", "local_auth"]),
  configured: z.boolean(),
  reachable: z.boolean(),
  usable: z.boolean(),
  enabled: z.boolean(),
  model: z.string(),
  baseUrl: z.string().nullable(),
  lastTestStatus: z.enum(["completed", "pending", "error"]),
  lastTestError: z.string().nullable(),
  lastTestAt: z.string().nullable(),
  oauthClientSource: z.enum(["builtin", "config", "none"]).optional(),
  configuredClientId: z.string().nullable().optional(),
});

const providerSummariesSchema = z.record(providerIdSchema, providerSummarySchema).optional();

const settingsSchema = z.object({
  localhostPort: z.number().int().min(1).max(65535).default(3000),
  playwrightHeadless: z.boolean().default(true),
  pinchTabUrl: z.string().default(""),
  pinchTabPort: z.number().int().min(1).max(65535).default(9222),
  pinchTabToken: z.string().default(""),
  pinchTabProfileName: z.string().default(""),
  noteLoginId: z.string().default(""),
  noteLoginPassword: z.string().default(""),
  noteUnofficialApiUrl: z.string().default(""),
  noteUnofficialApiToken: z.string().default(""),
  preferPinchTab: z.boolean().default(false),
  chromiumInstalled: z.boolean().default(false),
  defaultProvider: providerIdSchema.default("gemini"),
  fallbackProviders: z.array(providerIdSchema).default(["openai", "claude"]),
  strictProviderMode: z.boolean().default(false),
  generationTimeoutMs: z.number().int().min(1000).max(300000).default(90000),
  providerSummaries: providerSummariesSchema.default({} as Record<ProviderId, z.infer<typeof providerSummarySchema>>),
});

const articleSchema = z.object({
  id: z.string(),
  title: z.string(),
  keyword: z.string().optional().default(""),
  genre: z.string().optional().default(""),
  freeContent: z.string(),
  paidGuidance: z.string(),
  paidContent: z.string(),
  body: z.string(),
  saleMode: z.enum(["free", "paid"]),
  price: z.number().nullable(),
  includeImages: z.boolean().optional().default(false),
  includeGraphs: z.boolean().optional().default(false),
  heroImagePrompt: z.string().nullable().optional(),
  heroImageCaption: z.string().nullable().optional(),
  graphTitle: z.string().nullable().optional(),
  graphUnit: z.string().nullable().optional(),
  graphData: z
    .array(
      z.object({
        label: z.string(),
        value: z.number(),
      }),
    )
    .optional()
    .default([]),
  providerId: providerIdSchema.optional(),
});

const noteRequestSchema = z.object({
  article: articleSchema,
  settings: settingsSchema,
});

const diagnosticsRequestSchema = z.object({
  settings: settingsSchema,
});

const generationInputSchema = z.object({
  keyword: z.string(),
  genre: z.string(),
  accountId: z.string(),
  promptId: z.string().optional(),
  promptTitle: z.string().optional(),
  promptContent: z.string().optional(),
  includeImages: z.boolean(),
  includeGraphs: z.boolean(),
  saleMode: z.enum(["free", "paid"]),
  price: z.number().nullable(),
  instruction: z.string().optional(),
  scheduledAt: z.string().nullable().optional(),
  action: z.enum(["publish", "draft", "schedule"]),
  providerId: providerIdSchema.optional(),
});

const generateRequestSchema = z.object({
  input: generationInputSchema,
  settings: settingsSchema,
});

const regenerateAssetsRequestSchema = z.object({
  article: articleSchema.extend({
    keyword: z.string(),
    genre: z.string(),
    includeImages: z.boolean(),
    includeGraphs: z.boolean(),
  }),
  settings: settingsSchema,
  providerId: providerIdSchema.optional(),
});

const providerPatchSchema = z.object({
  apiKey: z.string().optional(),
  model: z.string().optional(),
  baseUrl: z.string().optional(),
  authPath: z.string().optional(),
  enabled: z.boolean().optional(),
  configuredClientId: z.string().nullable().optional(),
  workspace: z.string().nullable().optional(),
}).strict();

const stateSchema = z.object({
  articles: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      keyword: z.string().default(""),
      genre: z.string().default(""),
      status: z.string(),
      noteStatus: z.string(),
      createdAt: z.string(),
      scheduledAt: z.string().nullable(),
      noteUrl: z.string().nullable(),
      freeContent: z.string(),
      paidGuidance: z.string(),
      paidContent: z.string(),
      body: z.string(),
      references: z.array(
        z.object({
          title: z.string(),
          summary: z.string(),
          link: z.string(),
        }),
      ),
      timeline: z.array(
        z.object({
          label: z.string(),
          time: z.string(),
          status: z.string().optional(),
          detail: z.string().optional(),
        }),
      ),
      includeImages: z.boolean(),
      includeGraphs: z.boolean(),
      saleMode: z.enum(["free", "paid"]),
      price: z.number().nullable(),
      accountId: z.string(),
      promptId: z.string().optional(),
      instruction: z.string().optional(),
      providerId: providerIdSchema.optional(),
      lastNoteMethod: z.enum(["unofficial_api", "playwright", "pinchtab"]).nullable().optional(),
      saleSettingStatus: z.enum(["not_required", "applied", "failed"]).nullable().optional(),
      lastError: z.string().nullable().optional(),
      heroImagePrompt: z.string().nullable().optional(),
      heroImageCaption: z.string().nullable().optional(),
      headerImage: z.object({
        imageId: z.string(),
        path: z.string(),
        prompt: z.string().optional(),
        source: z.enum(["ai", "upload"]),
      }).nullable().optional(),
      inlineImages: z.array(z.object({
        imageId: z.string(),
        path: z.string(),
        insertAfter: z.enum(["freeContent", "paidGuidance", "paidContent"]),
        source: z.enum(["ai", "upload"]),
      })).optional().default([]),
      graphTitle: z.string().nullable().optional(),
      graphUnit: z.string().nullable().optional(),
      graphData: z.array(
        z.object({
          label: z.string(),
          value: z.number(),
        }),
      ).optional().default([]),
    }),
  ).default([]),
  prompts: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      content: z.string(),
    }),
  ).default([]),
  accounts: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      priority: z.number(),
    }),
  ).default([]),
  settings: settingsSchema,
  diagnostics: z.array(
    z.object({
      name: z.string(),
      status: z.string(),
      detail: z.string(),
      category: z.enum(["runtime", "ai", "note"]).optional(),
    }),
  ).default([]),
  lastDiagnosticsRunAt: z.string().default(() => new Date().toISOString()),
});

type StoredState = z.infer<typeof stateSchema>;
type AppSettings = z.infer<typeof settingsSchema>;

const nowTime = () =>
  new Date().toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

const parseScheduledAt = (value: string | null) => {
  if (!value) return null;
  const matched = value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (!matched) return null;

  const [, year, month, day, hour, minute] = matched;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0,
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toRuntimeSettings = async (settings: AppSettings): Promise<RuntimeSettings> => {
  const secrets = await loadProviderSecrets();
  return {
    playwrightHeadless: settings.playwrightHeadless,
    pinchTabUrl: settings.pinchTabUrl,
    pinchTabPort: settings.pinchTabPort,
    pinchTabToken: settings.pinchTabToken,
    pinchTabProfileName: settings.pinchTabProfileName,
    geminiApiKey: secrets.gemini.apiKey ?? "",
    geminiModel: secrets.gemini.model ?? "gemini-2.0-flash",
    noteLoginId: settings.noteLoginId,
    noteLoginPassword: settings.noteLoginPassword,
    noteUnofficialApiUrl: settings.noteUnofficialApiUrl,
    noteUnofficialApiToken: settings.noteUnofficialApiToken,
    preferPinchTab: settings.preferPinchTab,
  };
};

const toAiRuntimeSettings = (settings: AppSettings): AiRuntimeSettings => ({
  defaultProvider: settings.defaultProvider,
  fallbackProviders: settings.fallbackProviders,
  strictProviderMode: settings.strictProviderMode,
  generationTimeoutMs: settings.generationTimeoutMs,
});

const normalizeSettings = async (input?: Partial<AppSettings> | null): Promise<AppSettings> => {
  const providerSummaries = await listProviderSummaries();
  const parsed = settingsSchema.parse({
    localhostPort: input?.localhostPort,
    playwrightHeadless: input?.playwrightHeadless,
    pinchTabUrl: input?.pinchTabUrl,
    pinchTabPort: input?.pinchTabPort,
    pinchTabToken: input?.pinchTabToken,
    pinchTabProfileName: input?.pinchTabProfileName,
    noteLoginId: input?.noteLoginId,
    noteLoginPassword: input?.noteLoginPassword,
    noteUnofficialApiUrl: input?.noteUnofficialApiUrl,
    noteUnofficialApiToken: input?.noteUnofficialApiToken,
    preferPinchTab: input?.preferPinchTab,
    chromiumInstalled: input?.chromiumInstalled,
    defaultProvider: input?.defaultProvider,
    fallbackProviders: input?.fallbackProviders,
    strictProviderMode: input?.strictProviderMode,
    generationTimeoutMs: input?.generationTimeoutMs,
    providerSummaries,
  });

  return {
    ...parsed,
    fallbackProviders: parsed.fallbackProviders.filter((id, index, array) => array.indexOf(id) === index && id !== parsed.defaultProvider),
    providerSummaries,
  };
};

const normalizeState = async (input?: Partial<StoredState> | null): Promise<StoredState> => {
  const settings = await normalizeSettings(input?.settings);
  return stateSchema.parse({
    articles: input?.articles ?? [],
    prompts: input?.prompts ?? [],
    accounts: input?.accounts ?? [],
    settings,
    diagnostics: input?.diagnostics ?? [],
    lastDiagnosticsRunAt: input?.lastDiagnosticsRunAt ?? new Date().toISOString(),
  });
};

const buildProviderDiagnostics = async () => {
  const providerSummaries = await listProviderSummaries();
  return providerIds.map((providerId) => {
    const provider = providerSummaries[providerId];
    const parts = [
      `設定: ${provider.configured ? "済み" : "未設定"}`,
      `接続: ${provider.reachable ? "可" : "未確認"}`,
      `利用: ${provider.usable ? "可" : "未準備"}`,
      `モデル: ${provider.model || "未指定"}`,
    ];
    if (provider.lastTestError) {
      parts.push(`直近エラー: ${provider.lastTestError}`);
    }
    return {
      name: provider.label,
      status: provider.usable ? "completed" : provider.configured ? "pending" : "pending",
      detail: parts.join(" / "),
      category: "ai" as const,
    };
  });
};

let processingScheduledArticles = false;

const processScheduledArticles = async () => {
  if (processingScheduledArticles) return;
  processingScheduledArticles = true;

  try {
    const raw = await loadAppState();
    if (!raw) return;

    const state = await normalizeState(raw as Partial<StoredState>);
    const dueArticles = state.articles.filter((article) => {
      const scheduledAt = parseScheduledAt(article.scheduledAt);
      return (
        article.noteStatus === "pending" &&
        article.status === "completed" &&
        scheduledAt !== null &&
        scheduledAt.getTime() <= Date.now()
      );
    });

    if (dueArticles.length === 0) return;

    for (const dueArticle of dueArticles) {
      const workingState = await normalizeState(((await loadAppState()) as Partial<StoredState> | null) ?? state);
      const target = workingState.articles.find((article) => article.id === dueArticle.id);
      if (!target) continue;

      target.noteStatus = "running";
      target.lastError = null;
      target.timeline.push({
        label: "予約投稿を開始",
        time: nowTime(),
        status: "info",
        detail: target.scheduledAt ?? "即時実行",
      });
      await saveAppState(workingState);

      try {
        const result = await saveArticleToNote(
          {
            id: target.id,
            title: target.title,
            freeContent: target.freeContent,
            paidGuidance: target.paidGuidance,
            paidContent: target.paidContent,
            body: target.body,
            saleMode: target.saleMode,
            price: target.price,
          },
          await toRuntimeSettings(workingState.settings),
          "published",
        );

        target.noteStatus = "published";
        target.noteUrl = result.draftUrl;
        target.lastNoteMethod = result.method;
        target.saleSettingStatus = result.saleSettingStatus;
        target.lastError = null;
        target.timeline.push({
          label: "予約投稿が完了",
          time: nowTime(),
          status: "success",
          detail: "予約投稿で公開完了",
        });
      } catch (error) {
        target.noteStatus = "error";
        target.lastError = error instanceof Error ? error.message : "予約投稿に失敗";
        target.timeline.push({
          label: "予約投稿に失敗",
          time: nowTime(),
          status: "error",
          detail: target.lastError,
        });
      }

      workingState.settings = await normalizeSettings(workingState.settings);
      await saveAppState(workingState);
    }
  } finally {
    processingScheduledArticles = false;
  }
};

await app.register(cors, { origin: true });

app.get("/api/health", async () => ({
  status: "ok",
}));

app.get("/api/ai/providers", async () => ({
  providers: await listProviderSummaries(),
}));

app.put("/api/ai/providers/:providerId", async (request, reply) => {
  const params = z.object({ providerId: providerIdSchema }).parse(request.params);
  const body = providerPatchSchema.parse(request.body);
  try {
    const provider = await saveProviderConfig(params.providerId, {
      ...body,
      configuredClientId: body.configuredClientId === "" ? null : body.configuredClientId,
    });
    reply.send({ provider });
  } catch (error) {
    reply.code(400).send({
      error: {
        code: "AI_PROVIDER_SAVE_FAILED",
        message: error instanceof Error ? error.message : "AI provider 設定保存に失敗",
      },
    });
  }
});

app.post("/api/ai/providers/:providerId/test", async (request, reply) => {
  const params = z.object({ providerId: providerIdSchema }).parse(request.params);
  try {
    reply.send({ provider: await testProvider(params.providerId) });
  } catch (error) {
    reply.code(400).send({
      error: {
        code: "AI_PROVIDER_TEST_FAILED",
        message: error instanceof Error ? error.message : "AI provider テストに失敗",
      },
    });
  }
});

app.get("/api/ai/providers/github-copilot/status", async () => ({
  status: await getCopilotStatus(),
}));

app.post("/api/ai/providers/github-copilot/device/start", async (_request, reply) => {
  try {
    reply.send(await startCopilotDeviceFlow());
  } catch (error) {
    reply.code(400).send({
      error: {
        code: "COPILOT_DEVICE_START_FAILED",
        message: error instanceof Error ? error.message : "GitHub Copilot 認証開始に失敗",
      },
    });
  }
});

app.post("/api/ai/providers/github-copilot/device/poll", async (request, reply) => {
  const body = z.object({ deviceCode: z.string() }).parse(request.body);
  try {
    reply.send(await pollCopilotDeviceFlow(body.deviceCode));
  } catch (error) {
    reply.code(400).send({
      error: {
        code: "COPILOT_DEVICE_POLL_FAILED",
        message: error instanceof Error ? error.message : "GitHub Copilot 認証確認に失敗",
      },
    });
  }
});

app.post("/api/ai/providers/github-copilot/disconnect", async (_request, reply) => {
  try {
    reply.send({ status: await disconnectCopilot() });
  } catch (error) {
    reply.code(400).send({
      error: {
        code: "COPILOT_DISCONNECT_FAILED",
        message: error instanceof Error ? error.message : "GitHub Copilot 切断に失敗",
      },
    });
  }
});

app.get("/api/ai/providers/codex-cli/status", async () => ({
  status: await getCodexCliStatus(),
}));

app.post("/api/generate-article", async (request, reply) => {
  const body = generateRequestSchema.parse(request.body);
  try {
    const generated = await generateArticleWithProviders(
      body.input,
      toAiRuntimeSettings(body.settings),
      body.input.providerId,
    );
    reply.send({ article: generated });
  } catch (error) {
    reply.code(400).send({
      error: {
        code: "GENERATE_ARTICLE_FAILED",
        message: error instanceof Error ? error.message : "記事生成に失敗",
      },
    });
  }
});

app.post("/api/articles/regenerate-assets", async (request, reply) => {
  const body = regenerateAssetsRequestSchema.parse(request.body);
  try {
    const generated = await regenerateAssetsWithProviders(
      {
        title: body.article.title,
        keyword: body.article.keyword,
        genre: body.article.genre,
        freeContent: body.article.freeContent,
        paidGuidance: body.article.paidGuidance,
        paidContent: body.article.paidContent,
        includeImages: body.article.includeImages,
        includeGraphs: body.article.includeGraphs,
      },
      toAiRuntimeSettings(body.settings),
      body.providerId ?? body.article.providerId,
    );
    reply.send({
      article: generated,
    });
  } catch (error) {
    reply.code(400).send({
      error: {
        code: "REGENERATE_ASSETS_FAILED",
        message: error instanceof Error ? error.message : "素材再生成に失敗",
      },
    });
  }
});

app.get("/api/state", async () => {
  const saved = await loadAppState();
  if (!saved) {
    return { state: null, providers: await listProviderSummaries() };
  }

  const normalized = await normalizeState(saved as Partial<StoredState>);
  await saveAppState(normalized);
  return {
    state: normalized,
    providers: normalized.settings.providerSummaries,
  };
});

app.put("/api/state", async (request) => {
  const body = z.object({ state: stateSchema }).parse(request.body);
  const normalized = await normalizeState(body.state);
  await saveAppState(normalized);
  return { result: "success" as const, providers: normalized.settings.providerSummaries };
});

const patchArticleNoteState = async (
  articleId: string,
  noteStatus: string,
  result: { draftUrl: string; method: "unofficial_api" | "playwright" | "pinchtab"; saleSettingStatus: "not_required" | "applied" | "failed" },
) => {
  const saved = await loadAppState();
  if (!saved) return;
  const state = await normalizeState(saved as Partial<StoredState>);
  const article = state.articles.find((a) => a.id === articleId);
  if (!article) return;
  article.noteStatus = noteStatus;
  article.noteUrl = result.draftUrl;
  article.lastNoteMethod = result.method;
  article.saleSettingStatus = result.saleSettingStatus;
  await saveAppState(state);
};

app.post("/api/note/draft", async (request, reply) => {
  const body = noteRequestSchema.parse(request.body);
  try {
    const result = await saveArticleToNote(body.article, await toRuntimeSettings(body.settings), "draft");
    await patchArticleNoteState(body.article.id, "saved", result);
    reply.send(result);
  } catch (error) {
    reply.code(400).send({
      error: {
        code: "NOTE_DRAFT_FAILED",
        message: error instanceof Error ? error.message : "下書き保存に失敗",
      },
    });
  }
});

app.post("/api/note/publish", async (request, reply) => {
  const body = noteRequestSchema.parse(request.body);
  try {
    const result = await saveArticleToNote(body.article, await toRuntimeSettings(body.settings), "published");
    await patchArticleNoteState(body.article.id, "published", result);
    reply.send(result);
  } catch (error) {
    reply.code(400).send({
      error: {
        code: "NOTE_PUBLISH_FAILED",
        message: error instanceof Error ? error.message : "公開に失敗",
      },
    });
  }
});

app.post("/api/diagnostics/run", async (request) => {
  const body = diagnosticsRequestSchema.parse(request.body);
  const diagnostics = await runDiagnostics(await toRuntimeSettings(body.settings));
  const providerDiagnostics = await buildProviderDiagnostics();
  const providers = await listProviderSummaries();
  const codexStatus = await getCodexCliStatus();
  const copilotStatus = await getCopilotStatus();
  return {
    diagnostics: [...diagnostics, ...providerDiagnostics],
    providers,
    codexStatus,
    copilotStatus,
  };
});

app.post("/api/playwright/install", async (_request, reply) => {
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn("npx", ["playwright", "install", "chromium"], {
      shell: true,
      cwd: process.cwd(),
      env: process.env,
    });

    let logs = "";
    child.stdout.on("data", (chunk) => {
      logs += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      logs += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(logs.trim());
        return;
      }
      reject(new Error(logs.trim() || `playwright install failed: ${code}`));
    });
  }).catch((error) => {
    reply.code(400).send({
      error: {
        code: "PLAYWRIGHT_INSTALL_FAILED",
        message: error instanceof Error ? error.message : "Playwright 導入失敗",
      },
    });
    return null;
  });

  if (output === null) return;

  reply.send({
    result: "success",
    output,
  });
});

// ---- 画像ストレージ & AI画像生成 ----

const DATA_DIR = process.env.DATA_DIR ?? path.resolve("data");
const IMAGES_DIR = path.join(DATA_DIR, "images");

// GET /api/images/:imageId — 画像配信
app.get<{ Params: { imageId: string } }>("/api/images/:imageId", async (request, reply) => {
  const { imageId } = request.params;
  // imageId = "{articleId}_{uuid}" format; file at data/images/{articleId}/{uuid}.png
  const parts = imageId.split("_");
  if (parts.length < 2) { reply.code(400).send({ error: "Invalid imageId" }); return; }
  const articleId = parts.slice(0, -1).join("_");
  const filePath = path.join(IMAGES_DIR, articleId, `${parts.at(-1)}.png`);
  try {
    const buf = await fs.readFile(filePath);
    reply.type("image/png").send(buf);
  } catch {
    reply.code(404).send({ error: "Image not found" });
  }
});

// POST /api/images/upload — 画像アップロード（Base64 or raw）
app.post("/api/images/upload", async (request, reply) => {
  const body = request.body as { articleId?: string; base64?: string; filename?: string };
  const articleId = body?.articleId ?? "unknown";
  const base64 = body?.base64;
  if (!base64) { reply.code(400).send({ error: "base64 is required" }); return; }

  const uuid = randomUUID().slice(0, 8);
  const imageId = `${articleId}_${uuid}`;
  const dir = path.join(IMAGES_DIR, articleId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${uuid}.png`);
  await fs.writeFile(filePath, Buffer.from(base64, "base64"));
  reply.send({ imageId, path: `/api/images/${imageId}` });
});

// DELETE /api/images/:imageId — 画像削除
app.delete<{ Params: { imageId: string } }>("/api/images/:imageId", async (request, reply) => {
  const { imageId } = request.params;
  const parts = imageId.split("_");
  if (parts.length < 2) { reply.code(400).send({ error: "Invalid imageId" }); return; }
  const articleId = parts.slice(0, -1).join("_");
  const filePath = path.join(IMAGES_DIR, articleId, `${parts.at(-1)}.png`);
  try {
    await fs.unlink(filePath);
    reply.send({ result: "deleted" });
  } catch {
    reply.code(404).send({ error: "Image not found" });
  }
});

// POST /api/images/generate-header — ImageGenerator 経由でヘッダー画像を生成
app.post("/api/images/generate-header", async (request, reply) => {
  const body = request.body as { articleId: string; prompt?: string; keyword?: string; title?: string };
  const articleId = body?.articleId;
  if (!articleId) { reply.code(400).send({ error: "articleId is required" }); return; }

  const prompt = body.prompt
    ?? `${body.keyword ?? "記事"}を象徴する要素を1つ置き、読者に信頼感が伝わるアイキャッチ画像を生成してください。タイトル: ${body.title ?? ""}`;

  // ImageGenerator を取得（Mock / Real を自動切り替え）
  let generator;
  try {
    const secrets = await loadProviderSecrets();
    const geminiKey = secrets.gemini?.apiKey || process.env.GEMINI_API_KEY;
    generator = getImageGenerator(geminiKey ?? undefined);
  } catch (err) {
    reply.code(400).send({ error: err instanceof Error ? err.message : "画像生成の初期化に失敗しました" });
    return;
  }

  try {
    // Step 1: count_tokens でプリチェック（トークン数が多すぎないか確認）
    const tokenCheck = await generator.countTokens(prompt);
    if (tokenCheck.totalTokens > 10_000) {
      reply.code(400).send({
        error: `プロンプトが長すぎます（${tokenCheck.totalTokens} tokens）。10,000 tokens 以下にしてください。`,
        tokenCount: tokenCheck.totalTokens,
      });
      return;
    }

    // Step 2: 画像生成
    const result = await generator.generate(prompt, { aspectRatio: "16:9", imageSize: "1K" });

    // Step 3: ファイルに保存
    const uuid = randomUUID().slice(0, 8);
    const imageId = `${articleId}_${uuid}`;
    const dir = path.join(IMAGES_DIR, articleId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${uuid}.png`), Buffer.from(result.base64, "base64"));

    reply.send({
      imageId,
      path: `/api/images/${imageId}`,
      prompt,
      source: "ai" as const,
      tokenInfo: result.tokenInfo,
    });
  } catch (err) {
    const imgErr = err as Partial<ImageGenerationError>;
    const status = imgErr.code === "RATE_LIMIT" ? 429
      : imgErr.code === "SAFETY_BLOCK" ? 400
      : imgErr.code === "SERVER_ERROR" ? 502
      : imgErr.code === "TIMEOUT" ? 408
      : 500;
    reply.code(status).send({
      error: err instanceof Error ? err.message : "画像生成に失敗しました",
      errorCode: imgErr.code ?? "UNKNOWN",
    });
  }
});

// POST /api/images/count-tokens — 画像生成前のトークン数チェック
app.post("/api/images/count-tokens", async (request, reply) => {
  const body = request.body as { prompt: string };
  if (!body?.prompt) { reply.code(400).send({ error: "prompt is required" }); return; }

  try {
    const secrets = await loadProviderSecrets();
    const geminiKey = secrets.gemini?.apiKey || process.env.GEMINI_API_KEY;
    const generator = getImageGenerator(geminiKey ?? undefined);
    const result = await generator.countTokens(body.prompt);
    reply.send(result);
  } catch (err) {
    reply.code(500).send({ error: err instanceof Error ? err.message : "トークン数の確認に失敗しました" });
  }
});

const port = Number(process.env.SAAS_HUB_API_PORT ?? 3001);
const scheduleInterval = setInterval(() => {
  void processScheduledArticles();
}, Number(process.env.SAAS_HUB_SCHEDULE_INTERVAL_MS ?? 15_000));
scheduleInterval.unref();
void processScheduledArticles();
await app.listen({ host: "127.0.0.1", port });
console.log(`saas-hub api listening on http://127.0.0.1:${port}`);
