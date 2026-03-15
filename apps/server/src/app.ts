import fs from "node:fs/promises";
import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import type {
  ApplySaleSettingsInput,
  GenerationJobCreateInput,
  SetupSaveInput,
  NoteAccountInput,
  PromptTemplateInput,
  ReferenceMaterialImportInput,
  SaveNoteRequest,
  SetupStatus,
  SettingsInput
} from "@note-local/shared";
import {
  applySaleSettingsSchema,
  generationJobCreateSchema,
  installPlaywrightSchema,
  noteAccountSchema,
  promptTemplateSchema,
  referenceMaterialImportSchema,
  saveNoteRequestSchema,
  setupSaveSchema,
  settingsSchema
} from "@note-local/shared";
import { eq } from "drizzle-orm";
import { env, resolveWebDistPath } from "./config.js";
import { PinchTabAdapter, PlaywrightAdapter, UnofficialApiAdapter } from "./adapters/note-save-adapters.js";
import { registerSaasHubAdapterRoutes } from "./routes/saas-hub-adapter.js";
import { SaasHubStateService } from "./services/saas-hub-state-service.js";
import { ProviderRegistry } from "./services/provider-registry.js";
import { createDatabase, type AppDatabase } from "./db/client.js";
import "./db/migrate.js";
import { applyMigrations } from "./db/migrate.js";
import { seedDatabase } from "./db/seed.js";
import {
  appSettings,
  noteAccounts,
  promptTemplates,
  referenceMaterials,
  salesProfiles
} from "./db/schema.js";
import { GeminiProvider, type AiProvider } from "./providers/ai-provider.js";
import { GenerationService } from "./services/generation-service.js";
import { NoteSaveService } from "./services/note-save-service.js";
import {
  getDependencyChecks,
  getSetupStatus,
  installPlaywrightBrowser,
  saveSetupConfig
} from "./setup/setup-service.js";

const now = () => new Date().toISOString();

type AppOptions = {
  db?: AppDatabase;
  aiProvider?: AiProvider;
  stateFilePath?: string;
};

const summarize = (text: string) =>
  text.replace(/\s+/g, " ").trim().slice(0, 220) || "要約なし";

const htmlToText = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

const extractReferenceText = async (input: ReferenceMaterialImportInput) => {
  if (input.sourceType === "text") return input.sourceValue;
  if (input.sourceType === "file") {
    return fs.readFile(input.sourceValue, "utf8");
  }

  const response = await fetch(input.sourceValue);
  if (!response.ok) {
    throw new Error("REFERENCE_FETCH_FAILED");
  }
  const text = await response.text();
  return htmlToText(text);
};

export const buildApp = async (options: AppOptions = {}) => {
  const db = options.db ?? createDatabase();
  if (options.db) {
    applyMigrations(db);
  }
  await seedDatabase(db);

  const aiProvider =
    options.aiProvider ??
    new GeminiProvider({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL,
      mockMode: env.MOCK_AI_MODE
    });

  const noteSaveService = new NoteSaveService(db, [
    new UnofficialApiAdapter(),
    new PlaywrightAdapter(),
    new PinchTabAdapter()
  ]);
  const generationService = new GenerationService(db, aiProvider);

  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });

  if (env.SERVE_WEB_FROM_SERVER) {
    const webDistPath = resolveWebDistPath();
    try {
      await fs.access(webDistPath);
      await app.register(fastifyStatic, {
        root: webDistPath,
        prefix: "/"
      });
    } catch {
      // noop
    }
  }

  app.get("/api/health", async () => ({ status: "ok" }));

  app.get("/api/setup/status", async () => getSetupStatus() as Promise<SetupStatus>);

  app.get("/api/setup/dependencies", async () => getDependencyChecks());

  app.post("/api/setup/save", async (request, reply) => {
    const body = setupSaveSchema.parse(request.body) as SetupSaveInput;
    const status = await saveSetupConfig(db, body);
    reply.send(status);
  });

  app.post("/api/setup/repair", async (request, reply) => {
    console.log("POST /api/setup/repair called");
    try {
      const { repairEnvironment } = await import("./setup/setup-service.js");
      const result = await repairEnvironment();
      console.log("repairEnvironment result:", result);
      reply.send(result);
    } catch (error) {
      console.error("repairEnvironment error:", error);
      reply.code(400).send({
        error: {
          code: "REPAIR_FAILED",
          message: error instanceof Error ? error.message : "環境修復に失敗"
        }
      });
    }
  });

  app.post("/api/setup/capture-session", async (request, reply) => {
    console.log("POST /api/setup/capture-session called");
    try {
      const { captureSession } = await import("./setup/setup-service.js");
      const result = await captureSession();
      console.log("captureSession result:", result);
      reply.send(result);
    } catch (error) {
      console.error("captureSession error:", error);
      reply.code(500).send({
        error: {
          code: "SESSION_CAPTURE_FAILED",
          message: error instanceof Error ? error.message : "セッションキャプチャに失敗"
        }
      });
    }
  });

  app.post("/api/setup/install-playwright", async (request, reply) => {
    installPlaywrightSchema.parse(request.body ?? {});
    try {
      const result = await installPlaywrightBrowser();
      reply.send({
        result: "success",
        output: result.output
      });
    } catch (error) {
      reply.code(400).send({
        error: {
          code: "PLAYWRIGHT_INSTALL_FAILED",
          message: error instanceof Error ? error.message : "Playwright 導入に失敗"
        }
      });
    }
  });

  app.get("/api/settings", async () => {
    const [settings] = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
    return {
      localhostPort: settings.localhostPort,
      defaultAiProvider: settings.defaultAiProvider,
      geminiApiKey: env.GEMINI_API_KEY,
      geminiModel: settings.geminiModel,
      pinchtabBaseUrl: settings.pinchtabBaseUrl,
      debugMode: settings.debugMode === 1,
      logRetentionDays: settings.logRetentionDays,
      enableGenreAutoDetection: settings.enableGenreAutoDetection === 1,
      defaultTimeoutSec: settings.defaultTimeoutSec
    };
  });

  app.put("/api/settings", async (request, reply) => {
    const body = settingsSchema.parse(request.body) as SettingsInput;
    
    // DB側の設定を更新
    await db
      .update(appSettings)
      .set({
        localhostPort: body.localhostPort,
        defaultAiProvider: body.defaultAiProvider,
        geminiModel: body.geminiModel,
        pinchtabBaseUrl: body.pinchtabBaseUrl,
        debugMode: body.debugMode ? 1 : 0,
        logRetentionDays: body.logRetentionDays,
        enableGenreAutoDetection: body.enableGenreAutoDetection ? 1 : 0,
        defaultTimeoutSec: body.defaultTimeoutSec,
        updatedAt: now()
      })
      .where(eq(appSettings.id, 1));

    // .env 側の API キーも更新 (もし入力があれば)
    if (body.geminiApiKey !== undefined) {
      await saveSetupConfig(db, {
        geminiApiKey: body.geminiApiKey,
        geminiModel: body.geminiModel,
        localhostPort: body.localhostPort,
        playwrightHeadless: env.PLAYWRIGHT_HEADLESS
      });
    }

    reply.send(body);
  });

  app.get("/api/note-accounts", async () => db.select().from(noteAccounts));

  app.post("/api/note-accounts", async (request, reply) => {
    const body = noteAccountSchema.parse(request.body) as NoteAccountInput;
    const [account] = await db
      .insert(noteAccounts)
      .values({
        displayName: body.displayName,
        saveModePriority: body.saveModePriority,
        browserAdapterPriority: body.browserAdapterPriority,
        fallbackEnabled: body.fallbackEnabled ? 1 : 0,
        isActive: body.isActive ? 1 : 0,
        defaultSalesProfileId: body.defaultSalesProfileId ?? null,
        defaultPromptTemplateId: body.defaultPromptTemplateId ?? null,
        createdAt: now(),
        updatedAt: now()
      })
      .returning();
    reply.code(201).send(account);
  });

  app.put("/api/note-accounts/:id", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const body = noteAccountSchema.parse(request.body) as NoteAccountInput;
    await db
      .update(noteAccounts)
      .set({
        displayName: body.displayName,
        saveModePriority: body.saveModePriority,
        browserAdapterPriority: body.browserAdapterPriority,
        fallbackEnabled: body.fallbackEnabled ? 1 : 0,
        isActive: body.isActive ? 1 : 0,
        defaultSalesProfileId: body.defaultSalesProfileId ?? null,
        defaultPromptTemplateId: body.defaultPromptTemplateId ?? null,
        updatedAt: now()
      })
      .where(eq(noteAccounts.id, id));
    reply.send({ id, ...body });
  });

  app.get("/api/prompt-templates", async () => db.select().from(promptTemplates));

  app.post("/api/prompt-templates", async (request, reply) => {
    const body = promptTemplateSchema.parse(request.body) as PromptTemplateInput;
    const [template] = await db
      .insert(promptTemplates)
      .values({
        name: body.name,
        purpose: body.purpose,
        targetMedia: body.targetMedia,
        genreScope: body.genreScope,
        articleSystemPrompt: body.articleSystemPrompt,
        articleUserPromptTemplate: body.articleUserPromptTemplate,
        referencePromptTemplate: body.referencePromptTemplate,
        salesTransitionTemplate: body.salesTransitionTemplate,
        createdAt: now(),
        updatedAt: now()
      })
      .returning();
    reply.code(201).send(template);
  });

  app.get("/api/sales-profiles", async () => db.select().from(salesProfiles));

  app.post("/api/reference-materials/import", async (request, reply) => {
    const body = referenceMaterialImportSchema.parse(request.body) as ReferenceMaterialImportInput;
    const extractedText = await extractReferenceText(body);
    const [material] = await db
      .insert(referenceMaterials)
      .values({
        title: body.title,
        sourceType: body.sourceType,
        sourcePathOrUrl: body.sourceValue,
        extractedText,
        summaryText: summarize(extractedText),
        genreLabel: body.genreLabel ?? null,
        tagsJson: JSON.stringify(body.tags),
        isActive: 1,
        createdAt: now(),
        updatedAt: now()
      })
      .returning();
    reply.code(201).send(material);
  });

  app.get("/api/reference-materials", async () => db.select().from(referenceMaterials));

  app.post("/api/generation-jobs", async (request, reply) => {
    const body = generationJobCreateSchema.parse(request.body) as GenerationJobCreateInput;
    const job = await generationService.createJob(body);
    reply.code(201).send(job);
  });

  app.get("/api/generation-jobs", async () => generationService.listJobs());

  app.get("/api/generation-jobs/:id", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const detail = await generationService.getJobDetail(id);
    if (!detail) {
      reply.code(404).send({ error: { code: "JOB_NOT_FOUND", message: "ジョブが見つからない" } });
      return;
    }
    reply.send(detail);
  });

  app.post("/api/generation-jobs/:id/save-note", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const body = saveNoteRequestSchema.parse(request.body) as SaveNoteRequest;
    try {
      const result = await noteSaveService.saveJob(id, body);
      reply.send(result);
    } catch (error) {
      reply.code(400).send({
        error: {
          code: "SAVE_FAILED",
          message: error instanceof Error ? error.message : "保存に失敗"
        }
      });
    }
  });

  app.post("/api/generation-jobs/:id/publish-note", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const body = saveNoteRequestSchema.parse(request.body) as SaveNoteRequest;
    try {
      const result = await noteSaveService.publishJob(id, body);
      reply.send(result);
    } catch (error) {
      reply.code(400).send({
        error: {
          code: "PUBLISH_FAILED",
          message: error instanceof Error ? error.message : "公開に失敗"
        }
      });
    }
  });

  app.post("/api/generation-jobs/:id/apply-note-sale-settings", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const body = applySaleSettingsSchema.parse(request.body) as ApplySaleSettingsInput;
    const detail = await generationService.getJobDetail(id);
    if (!detail) {
      reply.code(404).send({ error: { code: "JOB_NOT_FOUND", message: "ジョブが見つからない" } });
      return;
    }
    const account = await db.select().from(noteAccounts).where(eq(noteAccounts.displayName, detail.noteAccountName)).limit(1);
    const result = await noteSaveService.saveJob(id, {
      forceMethod: null,
      noteAccountId: account[0].id,
      applySaleSettings: true
    });
    reply.send({ ...result, requested: body });
  });

  app.post("/api/browser-automation/pinchtab/verify", async () => {
    const diagnostics = await noteSaveService.verifyAdapters();
    return diagnostics.find((item) => item.name === "pinchtab");
  });

  // saas-hub adapter routes (includes /api/diagnostics/run with compatible response shape)
  const stateService = new SaasHubStateService(options.stateFilePath);
  const providerRegistry = new ProviderRegistry(aiProvider, stateService);
  await registerSaasHubAdapterRoutes(app, {
    db,
    aiProvider,
    generationService,
    noteSaveService,
    stateService,
    providerRegistry,
  });

  if (env.SERVE_WEB_FROM_SERVER) {
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith("/api")) {
        reply.code(404).send({ error: { code: "NOT_FOUND", message: "API not found" } });
        return;
      }

      const indexPath = path.join(resolveWebDistPath(), "index.html");
      try {
        const indexHtml = await fs.readFile(indexPath, "utf8");
        reply.type("text/html").send(indexHtml);
      } catch {
        reply.code(404).send("Web UI not found");
      }
    });
  }

  return app;
};
