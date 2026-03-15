import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import type { SetupSaveInput } from "@note-local/shared";
import type { DiagnosticResult } from "@note-local/shared";
import type { AppDatabase } from "../db/client.js";
import { appSettings } from "../db/schema.js";
import { env, resolveDataPath, resolveEnvFilePath } from "../config.js";
import { eq } from "drizzle-orm";

const quoteEnvValue = (value: string | number | boolean) => JSON.stringify(String(value));

const parseEnvFile = async (filePath: string) => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return raw.split(/\r?\n/).reduce<Record<string, string>>((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return acc;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) return acc;
      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      acc[key] = value;
      return acc;
    }, {});
  } catch {
    return {};
  }
};

export const getSetupStatus = async () => ({
  isConfigured: Boolean(env.APP_PORT),
  distributionMode: env.SERVE_WEB_FROM_SERVER ? ("portable" as const) : ("development" as const),
  envFilePath: resolveEnvFilePath(),
  appDataDir: path.resolve(process.cwd(), env.APP_DATA_DIR),
  fields: {
    hasGeminiApiKey: Boolean(env.GEMINI_API_KEY),
    hasNoteLoginId: Boolean(env.NOTE_LOGIN_ID),
    hasNoteLoginPassword: Boolean(env.NOTE_LOGIN_PASSWORD),
    playwrightHeadless: env.PLAYWRIGHT_HEADLESS
  }
});

export const getDependencyChecks = async (): Promise<DiagnosticResult[]> => {
  const results: DiagnosticResult[] = [];

  results.push({
    name: "node",
    status: "ok",
    detail: `Node ${process.version}`
  });

  try {
    const playwrightCli = await findPlaywrightCli();
    results.push({
      name: "playwright-package",
      status: "ok",
      detail: playwrightCli ? "Playwright パッケージ導入済み" : "Playwright パッケージが見つからない"
    });
    if (!playwrightCli) {
      results[results.length - 1].status = "error";
    }
  } catch {
    results.push({
      name: "playwright-package",
      status: "error",
      detail: "Playwright パッケージの検証中にエラー"
    });
  }

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    results.push({
      name: "playwright-browser",
      status: "ok",
      detail: "Chromium 起動可能"
    });
  } catch {
    results.push({
      name: "playwright-browser",
      status: "warn",
      detail: "Chromium 未導入。セットアップ画面から導入できる"
    });
  }

  try {
    await fs.access(resolveDataPath("note-storage-state.json"));
    results.push({
      name: "note-session",
      status: "ok",
      detail: "note セッションファイルあり"
    });
  } catch {
    results.push({
      name: "note-session",
      status: "warn",
      detail: "note セッション未保存。初回ログイン後に自動保存される"
    });
  }

  try {
    const response = await fetch(`${env.PINCHTAB_BASE_URL}/health`, {
      headers: env.PINCHTAB_TOKEN
        ? { Authorization: `Bearer ${env.PINCHTAB_TOKEN}` }
        : undefined
    });
    results.push({
      name: "pinchtab",
      status: response.ok ? "ok" : "warn",
      detail: response.ok ? "PinchTab 接続成功" : "PinchTab 未起動または未接続"
    });
  } catch {
    results.push({
      name: "pinchtab",
      status: "warn",
      detail: "PinchTab は未接続。Playwright 単体でも保存できる"
    });
  }

  return results;
};

export const saveSetupConfig = async (db: AppDatabase, input: SetupSaveInput) => {
  const envFilePath = resolveEnvFilePath();
  const current = await parseEnvFile(envFilePath);
  const next = {
    ...current,
    APP_PORT: String(input.localhostPort),
    APP_DATA_DIR: current.APP_DATA_DIR ?? env.APP_DATA_DIR,
    DEFAULT_AI_PROVIDER: current.DEFAULT_AI_PROVIDER ?? env.DEFAULT_AI_PROVIDER,
    GEMINI_API_KEY: input.geminiApiKey ?? "",
    GEMINI_MODEL: input.geminiModel,
    ENABLE_REAL_NOTE_AUTOMATION: "true",
    GEMINI_MODEL: input.geminiModel,
    ENABLE_REAL_NOTE_AUTOMATION: "true",
    NOTE_UNOFFICIAL_API_URL: current.NOTE_UNOFFICIAL_API_URL ?? "",
    NOTE_UNOFFICIAL_API_TOKEN: current.NOTE_UNOFFICIAL_API_TOKEN ?? "",
    PINCHTAB_BASE_URL: current.PINCHTAB_BASE_URL ?? env.PINCHTAB_BASE_URL,
    PINCHTAB_TOKEN: current.PINCHTAB_TOKEN ?? "",
    PINCHTAB_PROFILE_NAME: current.PINCHTAB_PROFILE_NAME ?? env.PINCHTAB_PROFILE_NAME,
    PINCHTAB_LAUNCH_PORT: current.PINCHTAB_LAUNCH_PORT ?? String(env.PINCHTAB_LAUNCH_PORT),
    PLAYWRIGHT_HEADLESS: input.playwrightHeadless ? "true" : "false",
    MOCK_AI_MODE: "false",
    MOCK_NOTE_API_RESULT: current.MOCK_NOTE_API_RESULT ?? "success",
    MOCK_PLAYWRIGHT_RESULT: current.MOCK_PLAYWRIGHT_RESULT ?? "success",
    MOCK_PINCHTAB_RESULT: current.MOCK_PINCHTAB_RESULT ?? "success"
  };

  const lines = Object.entries(next).map(([key, value]) => `${key}=${quoteEnvValue(value)}`);
  await fs.mkdir(path.dirname(envFilePath), { recursive: true });
  await fs.writeFile(envFilePath, `${lines.join("\n")}\n`, "utf8");

  env.APP_PORT = input.localhostPort;
  env.GEMINI_API_KEY = input.geminiApiKey;
  env.GEMINI_MODEL = input.geminiModel;
  env.ENABLE_REAL_NOTE_AUTOMATION = true;
  env.NOTE_LOGIN_ID = input.noteLoginId;
  env.NOTE_LOGIN_PASSWORD = input.noteLoginPassword;
  env.PLAYWRIGHT_HEADLESS = input.playwrightHeadless;
  env.MOCK_AI_MODE = false;

  await db
    .update(appSettings)
    .set({
      localhostPort: input.localhostPort,
      geminiModel: input.geminiModel
    })
    .where(eq(appSettings.id, 1));

  return getSetupStatus();
};

export const findPlaywrightCli = async () => {
  // 1. Check relative to current working directory (dev mode / root)
  const paths = [
    path.resolve(process.cwd(), "node_modules/playwright/cli.js"),
    path.resolve(process.cwd(), "../../node_modules/playwright/cli.js"), // workspace parent
    path.resolve(process.cwd(), "apps/server/node_modules/playwright/cli.js"),
    // 2. Check relative to the current file's location (bundled / portable)
    path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../node_modules/playwright/cli.js")
  ];

  for (const p of paths) {
    try {
      const normalizedPath = p.replace(/^\/([a-z]:)/i, "$1"); // Handle Windows path from URL
      await fs.access(normalizedPath);
      return normalizedPath;
    } catch {
      // ignore and try next
    }
  }

  // 3. Fallback: try to resolve via node's internal mechanism
  try {
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    return require.resolve("playwright/cli.js");
  } catch {
    return null;
  }
};

export const installPlaywrightBrowser = async () => {
  const cliPath = await findPlaywrightCli();

  if (!cliPath) {
    throw new Error("Playwright CLI が見つかりません。パッケージをインストールしてください。");
  }

  return new Promise<{ exitCode: number; output: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, "install", "chromium"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH:
          process.env.PLAYWRIGHT_BROWSERS_PATH ??
          path.resolve(process.cwd(), "ms-playwright")
      }
    });

    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolve({ exitCode: 0, output });
        return;
      }
      reject(new Error(output || `PLAYWRIGHT_INSTALL_FAILED_${exitCode}`));
    });
  });
};
export const repairEnvironment = async () => {
  const output: string[] = [];
  
  // 1. Check/Fix Playwright Package
  output.push("Playwright パッケージの確認中...");
  const cliPath = await findPlaywrightCli();
  if (!cliPath) {
    output.push("Playwright パッケージが見つかりません。配布環境を確認してください。");
  } else {
    output.push("Playwright パッケージは導入済みです。");
  }

  // 2. Install/Fix Chromium
  output.push("Chromium の導入/修復を開始します...");
  try {
    const installResult = await installPlaywrightBrowser();
    output.push("Chromium の導入に成功しました。");
    output.push(installResult.output);
  } catch (error) {
    output.push(`Chromium の導入に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(output.join("\n"));
  }

  return {
    success: true,
    output: output.join("\n")
  };
};

export const captureSession = async (accountId?: string) => {
  const browser = await chromium.launch({ headless: false });
  const filename = accountId
    ? `note-session-${accountId}.json`
    : "note-storage-state.json";
  const storageStatePath = resolveDataPath(filename);

  // Load existing session if available (so user sees logged-in state instead of login page)
  const contextOptions: Record<string, unknown> = {};
  try {
    await fs.access(storageStatePath);
    contextOptions.storageState = storageStatePath;
  } catch {
    // No existing session — start fresh at login page
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  // If existing session, go to note home; otherwise go to login
  const startUrl = contextOptions.storageState ? "https://note.com/" : "https://note.com/login";
  await page.goto(startUrl);

  return new Promise<{ success: boolean; message: string }>((resolve) => {
    browser.on("disconnected", async () => {
      resolve({ success: true, message: "Session capture completed" });
    });

    page.on("close", async () => {
      try {
        await context.storageState({ path: storageStatePath });
        await browser.close();
      } catch {
        // browser might already be closed
      }
    });
  });
};
