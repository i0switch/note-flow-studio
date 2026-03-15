import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  chromium,
  request as playwrightRequest,
  type APIRequestContext,
  type BrowserContextOptions,
  type Page,
} from "playwright";

export type RuntimeSettings = {
  playwrightHeadless: boolean;
  pinchTabUrl: string;
  pinchTabPort: number;
  pinchTabToken: string;
  pinchTabProfileName: string;
  geminiApiKey: string;
  geminiModel: string;
  noteLoginId: string;
  noteLoginPassword: string;
  noteUnofficialApiUrl: string;
  noteUnofficialApiToken: string;
  preferPinchTab: boolean;
};

export type NoteArticlePayload = {
  id: string;
  title: string;
  freeContent: string;
  paidGuidance: string;
  paidContent: string;
  body: string;
  saleMode: "free" | "paid";
  price: number | null;
};

export type SaveTargetState = "draft" | "published";

export type SaveResponse = {
  method: "unofficial_api" | "playwright" | "pinchtab";
  draftUrl: string;
  saleSettingStatus: "not_required" | "applied" | "failed";
};

type SaveContext = {
  article: NoteArticlePayload;
  settings: RuntimeSettings;
  targetState: SaveTargetState;
};

type NoteIdentity = {
  id: number;
  key: string;
  slug: string;
};

type NoteAccount = {
  urlname: string;
};

type StructuredNoteContent = {
  fullHtml: string;
  freeHtml: string;
  paidHtml: string;
  separator: string | null;
  bodyLength: number;
};

type PublishPayload = {
  author_ids: number[];
  body_length: number;
  disable_comment: boolean;
  exclude_from_creator_top: boolean;
  exclude_ai_learning_reward: boolean;
  free_body: string;
  hashtags: string[];
  image_keys: string[];
  index: boolean;
  is_refund: boolean;
  limited: boolean;
  magazine_ids: number[];
  magazine_keys: string[];
  name: string;
  pay_body: string;
  price: number;
  send_notifications_flag: boolean;
  separator: string | null;
  slug: string;
  status: "published";
  circle_permissions: string[];
  discount_campaigns: string[];
  lead_form: {
    is_active: boolean;
    consent_url: string;
  };
  line_add_friend: {
    is_active: boolean;
    keyword: string;
    add_friend_url: string;
  };
  line_add_friend_access_token: string;
};

type PinchTabProfile = {
  id: string;
  name: string;
};

type PinchTabInstance = {
  id: string;
  profileId: string;
  profileName: string;
  port: string;
  status: string;
};

const dataDir = path.join(process.cwd(), ".local-data");
const noteStorageStatePath = path.join(dataDir, "note-storage-state.json");

const NOTE_REQUEST_HEADERS = {
  "x-requested-with": "XMLHttpRequest",
  referer: "https://editor.note.com/",
  "content-type": "application/json",
} as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const stripNewlines = (value: string) => value.replace(/\r?\n/g, "");

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeBlocks = (value: string) =>
  value
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

const buildParagraphHtml = (block: string, seed: string) => {
  const id = `${seed}-${crypto.randomUUID().slice(0, 8)}`;
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return {
    id,
    html: `<p name="${id}" id="${id}">${lines.map(escapeHtml).join("<br>")}</p>`,
  };
};

const buildParagraphs = (value: string, seed: string) =>
  normalizeBlocks(value).map((block) => buildParagraphHtml(block, seed));

const ensureDataDir = async () => {
  await fs.mkdir(dataDir, { recursive: true });
};

const buildStructuredNoteContent = ({ article, targetState }: SaveContext): StructuredNoteContent => {
  const saleSettingRequested =
    targetState === "published" &&
    article.saleMode === "paid" &&
    article.paidContent.trim().length > 0;

  if (!saleSettingRequested) {
    const paragraphs = buildParagraphs(article.body, `${article.id}-body`);
    const fullHtml = paragraphs.map((item) => item.html).join("");
    return {
      fullHtml,
      freeHtml: fullHtml,
      paidHtml: "",
      separator: null,
      bodyLength: stripNewlines(article.body).length,
    };
  }

  const freePreview = [article.freeContent, article.paidGuidance].filter(Boolean).join("\n\n");
  const freeParagraphs = buildParagraphs(freePreview || article.body, `${article.id}-free`);
  const paidParagraphs = buildParagraphs(article.paidContent, `${article.id}-paid`);

  if (freeParagraphs.length === 0 || paidParagraphs.length === 0) {
    const paragraphs = buildParagraphs(article.body, `${article.id}-body`);
    const fullHtml = paragraphs.map((item) => item.html).join("");
    return {
      fullHtml,
      freeHtml: fullHtml,
      paidHtml: "",
      separator: null,
      bodyLength: stripNewlines(article.body).length,
    };
  }

  const freeHtml = freeParagraphs.map((item) => item.html).join("");
  const paidHtml = paidParagraphs.map((item) => item.html).join("");

  return {
    fullHtml: `${freeHtml}${paidHtml}`,
    freeHtml,
    paidHtml,
    separator: freeParagraphs.at(-1)?.id ?? null,
    bodyLength: stripNewlines(`${freePreview}${article.paidContent}`).length,
  };
};

const buildPublishPayload = (
  note: NoteIdentity,
  context: SaveContext,
  structured: StructuredNoteContent,
): PublishPayload => {
  const saleSettingRequested =
    context.article.saleMode === "paid" &&
    Boolean(structured.separator) &&
    structured.paidHtml.length > 0;

  return {
    author_ids: [],
    body_length: structured.bodyLength,
    disable_comment: false,
    exclude_from_creator_top: false,
    exclude_ai_learning_reward: false,
    free_body: structured.freeHtml,
    hashtags: [],
    image_keys: [],
    index: false,
    is_refund: false,
    limited: saleSettingRequested,
    magazine_ids: [],
    magazine_keys: [],
    name: context.article.title,
    pay_body: saleSettingRequested ? structured.paidHtml : "",
    price: saleSettingRequested ? context.article.price ?? 300 : 0,
    send_notifications_flag: true,
    separator: saleSettingRequested ? structured.separator : null,
    slug: note.slug,
    status: "published",
    circle_permissions: [],
    discount_campaigns: [],
    lead_form: {
      is_active: false,
      consent_url: "",
    },
    line_add_friend: {
      is_active: false,
      keyword: "",
      add_friend_url: "",
    },
    line_add_friend_access_token: "",
  };
};

class NoteApiClient {
  constructor(private readonly api: APIRequestContext) {}

  async dispose() {
    await this.api.dispose();
  }

  async getCurrentUser(): Promise<NoteAccount> {
    const response = await this.api.get("https://note.com/api/v2/current_user");
    if (!response.ok()) {
      throw new Error(`NOTE_CURRENT_USER_FAILED_${response.status()}`);
    }

    const data = (await response.json()) as {
      data?: {
        urlname?: string;
      };
    };

    const urlname = data.data?.urlname;
    if (!urlname) throw new Error("NOTE_URLNAME_NOT_FOUND");
    return { urlname };
  }

  async createTextNote(): Promise<NoteIdentity> {
    const response = await this.api.post("https://note.com/api/v1/text_notes", {
      data: { template_key: null },
    });
    if (!response.ok()) {
      throw new Error(`NOTE_CREATE_FAILED_${response.status()}`);
    }

    const data = (await response.json()) as {
      data?: {
        id?: number;
        key?: string;
        slug?: string;
      };
    };

    if (!data.data?.id || !data.data.key || !data.data.slug) {
      throw new Error("NOTE_CREATE_RESPONSE_INVALID");
    }

    return {
      id: data.data.id,
      key: data.data.key,
      slug: data.data.slug,
    };
  }

  async saveDraft(note: NoteIdentity, context: SaveContext, structured: StructuredNoteContent) {
    const response = await this.api.post(
      `https://note.com/api/v1/text_notes/draft_save?id=${note.id}&is_temp_saved=true`,
      {
        data: {
          body: structured.fullHtml,
          body_length: structured.bodyLength,
          name: context.article.title,
          index: false,
          is_lead_form: false,
        },
      },
    );

    if (!response.ok()) {
      throw new Error(`NOTE_DRAFT_SAVE_FAILED_${response.status()}`);
    }
  }

  async publishNote(note: NoteIdentity, payload: PublishPayload) {
    const response = await this.api.put(`https://note.com/api/v1/text_notes/${note.id}`, {
      data: payload,
    });

    if (!response.ok()) {
      const body = await response.text();
      throw new Error(`NOTE_PUBLISH_FAILED_${response.status()}_${body}`);
    }

    const data = (await response.json()) as {
      data?: {
        note_url?: string;
      };
    };

    return {
      noteUrl: data.data?.note_url ?? null,
    };
  }
}

class NoteBrowserAutomation {
  constructor(
    private readonly settings: RuntimeSettings,
    private readonly persistStorageStatePath?: string,
  ) {}

  async login(page: Page) {
    if (!this.settings.noteLoginId || !this.settings.noteLoginPassword) {
      throw new Error("NOTE_LOGIN_CREDENTIALS_MISSING");
    }

    await page.goto("https://note.com/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    if (await page.locator('a[href="/notes/new"]').count()) {
      return;
    }

    await page.goto("https://note.com/login", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const emailField = page.locator("#email");
    if (await emailField.count()) {
      await emailField.fill(this.settings.noteLoginId);
      await page.locator("#password").fill(this.settings.noteLoginPassword);
      await page.locator(".o-login__button button").click();
      await page.waitForTimeout(8000);
    }

    if (page.url().includes("/login")) {
      throw new Error("NOTE_LOGIN_FAILED");
    }
  }

  async createApiClient(page: Page) {
    const storageState = await page.context().storageState(
      this.persistStorageStatePath ? { path: this.persistStorageStatePath } : undefined,
    );

    return new NoteApiClient(
      await playwrightRequest.newContext({
        storageState,
        extraHTTPHeaders: NOTE_REQUEST_HEADERS,
      }),
    );
  }

  async save(page: Page, context: SaveContext, method: SaveResponse["method"]): Promise<SaveResponse> {
    await this.login(page);
    const api = await this.createApiClient(page);

    try {
      const user = await api.getCurrentUser();
      const note = await api.createTextNote();
      const structured = buildStructuredNoteContent(context);

      await api.saveDraft(note, context, structured);

      if (context.targetState === "draft") {
        return {
          method,
          draftUrl: `https://editor.note.com/notes/${note.key}/edit/`,
          saleSettingStatus: "not_required",
        };
      }

      const publishPayload = buildPublishPayload(note, context, structured);
      const published = await api.publishNote(note, publishPayload);
      const saleSettingRequested =
        context.article.saleMode === "paid" &&
        structured.separator &&
        structured.paidHtml.length > 0;

      return {
        method,
        draftUrl: published.noteUrl ?? `https://note.com/${user.urlname}/n/${note.key}`,
        saleSettingStatus: saleSettingRequested ? "applied" : "not_required",
      };
    } finally {
      await api.dispose();
    }
  }
}

class NotePlaywrightClient {
  constructor(private readonly settings: RuntimeSettings) {}

  async run<T>(task: (page: Page) => Promise<T>) {
    await ensureDataDir();

    const contextOptions: BrowserContextOptions = {
      viewport: { width: 1440, height: 960 },
    };

    try {
      await fs.access(noteStorageStatePath);
      contextOptions.storageState = noteStorageStatePath;
    } catch {
      // noop
    }

    const browser = await chromium.launch({ headless: this.settings.playwrightHeadless });
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    try {
      return await task(page);
    } finally {
      await context.storageState({ path: noteStorageStatePath });
      await browser.close();
    }
  }
}

class PinchTabClient {
  constructor(private readonly settings: RuntimeSettings) {}

  private get baseUrl() {
    const raw = this.settings.pinchTabUrl.trim();
    return raw.endsWith("/")
      ? raw.slice(0, -1)
      : raw;
  }

  private get headers() {
    return this.settings.pinchTabToken
      ? { Authorization: `Bearer ${this.settings.pinchTabToken}` }
      : undefined;
  }

  private async requestJson<T>(pathName: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${pathName}`, {
      ...init,
      headers: {
        ...(this.headers ?? {}),
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(`PINCHTAB_REQUEST_FAILED_${response.status}_${pathName}`);
    }

    return (await response.json()) as T;
  }

  private async listProfiles() {
    return this.requestJson<PinchTabProfile[]>("/profiles");
  }

  private async listInstances() {
    return this.requestJson<PinchTabInstance[]>("/instances");
  }

  private selectProfile(profiles: PinchTabProfile[]) {
    const preferredName = this.settings.pinchTabProfileName.trim();
    return (
      (preferredName ? profiles.find((profile) => profile.name === preferredName) : undefined) ??
      profiles.find((profile) => profile.name === "note-live") ??
      profiles.find((profile) => profile.name === "default") ??
      profiles[0]
    );
  }

  private selectPort(instances: PinchTabInstance[]) {
    const usedPorts = new Set(
      instances
        .filter((instance) => instance.status === "running")
        .map((instance) => Number(instance.port))
        .filter((port) => Number.isFinite(port)),
    );

    const preferred = this.settings.pinchTabPort || 9222;
    for (let port = preferred; port < preferred + 20; port += 1) {
      if (!usedPorts.has(port)) {
        return port;
      }
    }

    throw new Error("PINCHTAB_NO_PORT_AVAILABLE");
  }

  private async waitForDebugger(port: number) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (response.ok) return;
      } catch {
        // noop
      }
      await sleep(1000);
    }

    throw new Error("PINCHTAB_DEBUGGER_NOT_READY");
  }

  async run<T>(task: (page: Page) => Promise<T>) {
    const profiles = await this.listProfiles();
    const profile = this.selectProfile(profiles);
    if (!profile) throw new Error("PINCHTAB_PROFILE_NOT_FOUND");

    const instances = await this.listInstances();
    const running = instances.find(
      (instance) => instance.profileName === profile.name && instance.status === "running",
    );

    let launchedInstance: PinchTabInstance | null = null;
    const instance =
      running ??
      (await this.requestJson<PinchTabInstance>("/instances/launch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: profile.name,
          port: String(this.selectPort(instances)),
          mode: this.settings.playwrightHeadless ? "headless" : "headed",
        }),
      }));

    if (!running) {
      launchedInstance = instance;
      await this.waitForDebugger(Number(instance.port));
    }

    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${instance.port}`);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = await context.newPage();

    try {
      return await task(page);
    } finally {
      await browser.close();
      if (launchedInstance) {
        try {
          await this.requestJson(`/instances/${launchedInstance.id}/stop`, {
            method: "POST",
          });
        } catch {
          // noop
        }
      }
    }
  }
}

const runUnofficialApi = async (context: SaveContext): Promise<SaveResponse> => {
  if (!context.settings.noteUnofficialApiUrl) {
    throw new Error("NOTE_UNOFFICIAL_API_NOT_CONFIGURED");
  }

  const response = await fetch(context.settings.noteUnofficialApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(context.settings.noteUnofficialApiToken
        ? { Authorization: `Bearer ${context.settings.noteUnofficialApiToken}` }
        : {}),
    },
    body: JSON.stringify({
      title: context.article.title,
      noteBody: context.article.body,
      freePreviewMarkdown: [context.article.freeContent, context.article.paidGuidance]
        .filter(Boolean)
        .join("\n\n"),
      paidContentMarkdown: context.article.paidContent,
      salesMode: context.article.saleMode === "paid" ? "free_paid" : "normal",
      targetState: context.targetState,
      priceYen: context.article.price,
    }),
  });

  if (!response.ok) {
    throw new Error(`NOTE_API_${response.status}`);
  }

  const data = (await response.json()) as { draftUrl?: string };
  return {
    method: "unofficial_api",
    draftUrl: data.draftUrl ?? "",
    saleSettingStatus: "not_required",
  };
};

const runPlaywrightSave = async (context: SaveContext): Promise<SaveResponse> => {
  const client = new NotePlaywrightClient(context.settings);
  return client.run(async (page) => {
    const automation = new NoteBrowserAutomation(context.settings, noteStorageStatePath);
    return automation.save(page, context, "playwright");
  });
};

const runPinchTabSave = async (context: SaveContext): Promise<SaveResponse> => {
  const client = new PinchTabClient(context.settings);
  const automation = new NoteBrowserAutomation(context.settings);
  return client.run(async (page) => automation.save(page, context, "pinchtab"));
};

export const saveArticleToNote = async (
  article: NoteArticlePayload,
  settings: RuntimeSettings,
  targetState: SaveTargetState,
) => {
  const context: SaveContext = {
    article,
    settings,
    targetState,
  };

  const methods = settings.preferPinchTab
    ? [runUnofficialApi, runPinchTabSave, runPlaywrightSave]
    : [runUnofficialApi, runPlaywrightSave, runPinchTabSave];

  const failures: string[] = [];
  for (const method of methods) {
    try {
      return await method(context);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "UNKNOWN_SAVE_ERROR");
    }
  }

  throw new Error(failures.join(" | ") || "ALL_SAVE_METHODS_FAILED");
};

export const runDiagnostics = async (settings: RuntimeSettings) => {
  const diagnostics: Array<{
    name: string;
    status: "completed" | "pending" | "error";
    detail: string;
  }> = [];

  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    diagnostics.push({
      name: "Playwright",
      status: "completed",
      detail: "Chromium 起動可能",
    });
  } catch (error) {
    diagnostics.push({
      name: "Playwright",
      status: "error",
      detail: error instanceof Error ? error.message : "Chromium 起動失敗",
    });
  }

  if (settings.pinchTabUrl) {
    try {
      const response = await fetch(`${settings.pinchTabUrl.replace(/\/$/, "")}/health`, {
        headers: settings.pinchTabToken
          ? { Authorization: `Bearer ${settings.pinchTabToken}` }
          : undefined,
      });
      diagnostics.push({
        name: "PinchTab",
        status: response.ok ? "completed" : "error",
        detail: response.ok ? "PinchTab 接続成功" : `PinchTab 応答 ${response.status}`,
      });
    } catch (error) {
      diagnostics.push({
        name: "PinchTab",
        status: "error",
        detail: error instanceof Error ? error.message : "PinchTab 接続失敗",
      });
    }
  } else {
    diagnostics.push({
      name: "PinchTab",
      status: "pending",
      detail: "PinchTab URL 未設定",
    });
  }

  if (settings.geminiApiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${settings.geminiApiKey}`,
      );
      diagnostics.push({
        name: "Gemini API",
        status: response.ok ? "completed" : "error",
        detail: response.ok ? "API 応答を確認" : `API 応答 ${response.status}`,
      });
    } catch (error) {
      diagnostics.push({
        name: "Gemini API",
        status: "error",
        detail: error instanceof Error ? error.message : "Gemini API 接続失敗",
      });
    }
  } else {
    diagnostics.push({
      name: "Gemini API",
      status: "pending",
      detail: "API キー未登録",
    });
  }

  diagnostics.push({
    name: "note ログイン",
    status: settings.noteLoginId && settings.noteLoginPassword ? "completed" : "pending",
    detail:
      settings.noteLoginId && settings.noteLoginPassword
        ? "ログイン情報入力済み"
        : "ログイン情報未設定",
  });

  return diagnostics;
};
