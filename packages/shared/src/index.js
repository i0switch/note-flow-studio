import { z } from "zod";
export const sourceTypeSchema = z.enum(["url", "text", "file"]);
export const salesModeSchema = z.enum(["normal", "free_paid"]);
export const saveMethodSchema = z.enum(["unofficial_api", "playwright", "pinchtab"]);
export const adapterPrioritySchema = z.enum([
    "playwright_first",
    "pinchtab_first",
    "auto"
]);
export const saveModePrioritySchema = z.enum(["api_first", "browser_first"]);
export const jobStatusSchema = z.enum([
    "queued",
    "running",
    "succeeded",
    "failed",
    "partial"
]);
export const articleStatusSchema = z.enum(["generated", "edited", "saved"]);
export const saveResultSchema = z.enum(["success", "failed"]);
export const referenceMaterialImportSchema = z.object({
    sourceType: sourceTypeSchema,
    sourceValue: z.string().min(1),
    title: z.string().min(1),
    genreLabel: z.string().optional(),
    tags: z.array(z.string()).default([])
});
export const noteAccountSchema = z.object({
    id: z.number().int().optional(),
    displayName: z.string().min(1),
    saveModePriority: saveModePrioritySchema.default("api_first"),
    browserAdapterPriority: adapterPrioritySchema.default("auto"),
    fallbackEnabled: z.boolean().default(true),
    isActive: z.boolean().default(true),
    defaultSalesProfileId: z.number().int().nullable().optional(),
    defaultPromptTemplateId: z.number().int().nullable().optional()
});
export const settingsSchema = z.object({
    localhostPort: z.number().int().positive(),
    defaultAiProvider: z.string().default("gemini"),
    geminiModel: z.string().default("gemini-2.0-flash"),
    pinchtabBaseUrl: z.string().default("http://localhost:9867"),
    debugMode: z.boolean().default(false),
    logRetentionDays: z.number().int().positive().default(14),
    enableGenreAutoDetection: z.boolean().default(true),
    defaultTimeoutSec: z.number().int().positive().default(60)
});
export const promptTemplateSchema = z.object({
    id: z.number().int().optional(),
    name: z.string().min(1),
    purpose: z.string().min(1),
    targetMedia: z.string().default("note"),
    genreScope: z.string().default("all"),
    articleSystemPrompt: z.string().min(1),
    articleUserPromptTemplate: z.string().min(1),
    referencePromptTemplate: z.string().default("参考資料を要約し、本文の根拠として使用する"),
    salesTransitionTemplate: z
        .string()
        .default("ここから先で、実際に使える具体策と実装ポイントを深掘りする"),
    graphPromptTemplate: z
        .string()
        .default("記事の論点から1つのグラフ仕様JSONを作成する"),
    imagePromptTemplate: z
        .string()
        .default("記事内容に沿ったアイキャッチ画像の説明を作成する")
});
export const generationJobCreateSchema = z.object({
    keyword: z.string().min(1),
    noteAccountId: z.number().int(),
    promptTemplateId: z.number().int(),
    targetGenre: z.string().optional(),
    referenceMaterialIds: z.array(z.number().int()).default([]),
    imageEnabled: z.boolean().default(true),
    graphEnabled: z.boolean().default(false),
    monetizationEnabled: z.boolean().default(false),
    salesMode: salesModeSchema.default("normal"),
    desiredPriceYen: z.number().int().nullable().default(null),
    additionalInstruction: z.string().default("")
});
export const saveNoteRequestSchema = z.object({
    forceMethod: saveMethodSchema.nullable().default(null),
    noteAccountId: z.number().int(),
    applySaleSettings: z.boolean().default(false)
});
export const graphGenerateRequestSchema = z.object({
    generationJobId: z.number().int()
});
export const applySaleSettingsSchema = z.object({
    priceYen: z.number().int().positive(),
    freePreviewRatio: z.number().min(0.1).max(0.9),
    transitionCtaText: z.string().min(1)
});
export const saveAttemptSchema = z.object({
    method: saveMethodSchema,
    result: saveResultSchema,
    draftUrl: z.string().nullable(),
    saleSettingStatus: z.enum(["not_required", "applied", "failed"]).default("not_required"),
    errorCode: z.string().nullable(),
    errorMessage: z.string().nullable()
});
export const generatedImageSchema = z.object({
    imageRole: z.enum(["cover", "inline"]),
    promptText: z.string(),
    status: z.enum(["generated", "failed"]),
    filePath: z.string().nullable().default(null)
});
export const generatedGraphSchema = z.object({
    graphTitle: z.string(),
    graphType: z.enum(["bar", "line", "pie", "table"]),
    graphSpecJson: z.record(z.any()),
    status: z.enum(["generated", "failed"])
});
export const generatedArticleSchema = z.object({
    id: z.number().int(),
    generationJobId: z.number().int(),
    title: z.string(),
    genreLabel: z.string(),
    leadText: z.string(),
    freePreviewMarkdown: z.string(),
    paidContentMarkdown: z.string(),
    transitionCtaText: z.string(),
    salesHookText: z.string(),
    recommendedPriceYen: z.number().int().nullable(),
    bodyMarkdown: z.string(),
    noteRenderedBody: z.string(),
    status: articleStatusSchema,
    generatedImages: z.array(generatedImageSchema).default([]),
    generatedGraphs: z.array(generatedGraphSchema).default([]),
    saveAttempts: z.array(saveAttemptSchema).default([])
});
export const generationJobSummarySchema = z.object({
    id: z.number().int(),
    keyword: z.string(),
    targetGenre: z.string().nullable(),
    salesMode: salesModeSchema,
    status: jobStatusSchema,
    noteAccountName: z.string(),
    createdAt: z.string(),
    updatedAt: z.string()
});
export const generationJobDetailSchema = generationJobSummarySchema.extend({
    additionalInstruction: z.string(),
    imageEnabled: z.boolean(),
    graphEnabled: z.boolean(),
    monetizationEnabled: z.boolean(),
    desiredPriceYen: z.number().int().nullable(),
    references: z.array(z.object({
        id: z.number().int(),
        title: z.string(),
        sourceType: sourceTypeSchema,
        summaryText: z.string()
    })),
    article: generatedArticleSchema.nullable(),
    logs: z.array(z.object({
        id: z.number().int(),
        level: z.enum(["info", "warn", "error"]),
        category: z.string(),
        message: z.string(),
        createdAt: z.string()
    }))
});
export const diagnosticResultSchema = z.object({
    name: z.string(),
    status: z.enum(["ok", "warn", "error"]),
    detail: z.string()
});
