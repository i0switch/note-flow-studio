import {
  integer,
  real,
  sqliteTable,
  text
} from "drizzle-orm/sqlite-core";

export const appSettings = sqliteTable("app_settings", {
  id: integer("id").primaryKey(),
  localhostPort: integer("localhost_port").notNull(),
  defaultAiProvider: text("default_ai_provider").notNull(),
  geminiModel: text("gemini_model").notNull(),
  pinchtabBaseUrl: text("pinchtab_base_url").notNull(),
  debugMode: integer("debug_mode").notNull(),
  logRetentionDays: integer("log_retention_days").notNull(),
  enableGenreAutoDetection: integer("enable_genre_auto_detection").notNull(),
  defaultTimeoutSec: integer("default_timeout_sec").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const promptTemplates = sqliteTable("prompt_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  purpose: text("purpose").notNull(),
  targetMedia: text("target_media").notNull(),
  genreScope: text("genre_scope").notNull(),
  articleSystemPrompt: text("article_system_prompt").notNull(),
  articleUserPromptTemplate: text("article_user_prompt_template").notNull(),
  referencePromptTemplate: text("reference_prompt_template").notNull(),
  salesTransitionTemplate: text("sales_transition_template").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const salesProfiles = sqliteTable("sales_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileName: text("profile_name").notNull(),
  salesMode: text("sales_mode").notNull(),
  defaultPriceYen: integer("default_price_yen"),
  freePreviewRatio: real("free_preview_ratio"),
  introCtaTemplate: text("intro_cta_template").notNull(),
  paidTransitionTemplate: text("paid_transition_template").notNull(),
  bonusTextTemplate: text("bonus_text_template").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const noteAccounts = sqliteTable("note_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  displayName: text("display_name").notNull(),
  saveModePriority: text("save_mode_priority").notNull(),
  browserAdapterPriority: text("browser_adapter_priority").notNull(),
  fallbackEnabled: integer("fallback_enabled").notNull(),
  isActive: integer("is_active").notNull(),
  defaultSalesProfileId: integer("default_sales_profile_id"),
  defaultPromptTemplateId: integer("default_prompt_template_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const referenceMaterials = sqliteTable("reference_materials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  sourceType: text("source_type").notNull(),
  sourcePathOrUrl: text("source_path_or_url").notNull(),
  extractedText: text("extracted_text").notNull(),
  summaryText: text("summary_text").notNull(),
  genreLabel: text("genre_label"),
  tagsJson: text("tags_json").notNull(),
  isActive: integer("is_active").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const generationJobs = sqliteTable("generation_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  keyword: text("keyword").notNull(),
  noteAccountId: integer("note_account_id").notNull(),
  promptTemplateId: integer("prompt_template_id").notNull(),
  targetGenre: text("target_genre"),
  monetizationEnabled: integer("monetization_enabled").notNull(),
  salesMode: text("sales_mode").notNull(),
  desiredPriceYen: integer("desired_price_yen"),
  additionalInstruction: text("additional_instruction").notNull(),
  providerName: text("provider_name").notNull().default(""),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const jobReferenceMaterials = sqliteTable("job_reference_materials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  generationJobId: integer("generation_job_id").notNull(),
  referenceMaterialId: integer("reference_material_id").notNull(),
  usageRole: text("usage_role").notNull(),
  createdAt: text("created_at").notNull()
});

export const generatedArticles = sqliteTable("generated_articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  generationJobId: integer("generation_job_id").notNull(),
  title: text("title").notNull(),
  genreLabel: text("genre_label").notNull(),
  leadText: text("lead_text").notNull(),
  freePreviewMarkdown: text("free_preview_markdown").notNull(),
  paidContentMarkdown: text("paid_content_markdown").notNull(),
  transitionCtaText: text("transition_cta_text").notNull(),
  salesHookText: text("sales_hook_text").notNull(),
  recommendedPriceYen: integer("recommended_price_yen"),
  bodyMarkdown: text("body_markdown").notNull(),
  noteRenderedBody: text("note_rendered_body").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const saveAttempts = sqliteTable("save_attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  generationJobId: integer("generation_job_id").notNull(),
  method: text("method").notNull(),
  attemptNo: integer("attempt_no").notNull(),
  result: text("result").notNull(),
  draftUrl: text("draft_url"),
  saleSettingStatus: text("sale_setting_status").notNull(),
  salePriceYen: integer("sale_price_yen"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at")
});

export const executionLogs = sqliteTable("execution_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  generationJobId: integer("generation_job_id"),
  logLevel: text("log_level").notNull(),
  category: text("category").notNull(),
  message: text("message").notNull(),
  detailJson: text("detail_json"),
  createdAt: text("created_at").notNull()
});
