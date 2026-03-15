import fs from "node:fs";
import { resolveDataPath } from "../config.js";
import { createDatabase } from "./client.js";
import type { AppDatabase } from "./client.js";

const schemaSql = `
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY,
  localhost_port INTEGER NOT NULL,
  default_ai_provider TEXT NOT NULL,
  gemini_model TEXT NOT NULL,
  pinchtab_base_url TEXT NOT NULL,
  debug_mode INTEGER NOT NULL,
  log_retention_days INTEGER NOT NULL,
  enable_genre_auto_detection INTEGER NOT NULL,
  default_timeout_sec INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS prompt_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  target_media TEXT NOT NULL,
  genre_scope TEXT NOT NULL,
  article_system_prompt TEXT NOT NULL,
  article_user_prompt_template TEXT NOT NULL,
  reference_prompt_template TEXT NOT NULL,
  sales_transition_template TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sales_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_name TEXT NOT NULL,
  sales_mode TEXT NOT NULL,
  default_price_yen INTEGER,
  free_preview_ratio REAL,
  intro_cta_template TEXT NOT NULL,
  paid_transition_template TEXT NOT NULL,
  bonus_text_template TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS note_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name TEXT NOT NULL,
  save_mode_priority TEXT NOT NULL,
  browser_adapter_priority TEXT NOT NULL,
  fallback_enabled INTEGER NOT NULL,
  is_active INTEGER NOT NULL,
  default_sales_profile_id INTEGER,
  default_prompt_template_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reference_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_path_or_url TEXT NOT NULL,
  extracted_text TEXT NOT NULL,
  summary_text TEXT NOT NULL,
  genre_label TEXT,
  tags_json TEXT NOT NULL,
  is_active INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS generation_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  note_account_id INTEGER NOT NULL,
  prompt_template_id INTEGER NOT NULL,
  target_genre TEXT,
  monetization_enabled INTEGER NOT NULL,
  sales_mode TEXT NOT NULL,
  desired_price_yen INTEGER,
  additional_instruction TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS job_reference_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  generation_job_id INTEGER NOT NULL,
  reference_material_id INTEGER NOT NULL,
  usage_role TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS generated_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  generation_job_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  genre_label TEXT NOT NULL,
  lead_text TEXT NOT NULL,
  free_preview_markdown TEXT NOT NULL,
  paid_content_markdown TEXT NOT NULL,
  transition_cta_text TEXT NOT NULL,
  sales_hook_text TEXT NOT NULL,
  recommended_price_yen INTEGER,
  body_markdown TEXT NOT NULL,
  note_rendered_body TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS save_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  generation_job_id INTEGER NOT NULL,
  method TEXT NOT NULL,
  attempt_no INTEGER NOT NULL,
  result TEXT NOT NULL,
  draft_url TEXT,
  sale_setting_status TEXT NOT NULL,
  sale_price_yen INTEGER,
  error_code TEXT,
  error_message TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE TABLE IF NOT EXISTS execution_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  generation_job_id INTEGER,
  log_level TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  detail_json TEXT,
  created_at TEXT NOT NULL
);`;

export const applyMigrations = (db: AppDatabase) => {
  const sqlite = db as unknown as { $client: { exec: (sql: string) => void } };
  sqlite.$client.exec(schemaSql);
};

export const runMigrations = () => {
  fs.mkdirSync(resolveDataPath(), { recursive: true });
  const db = createDatabase();
  applyMigrations(db);
};

runMigrations();
