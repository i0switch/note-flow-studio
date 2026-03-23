import crypto from "node:crypto";
import fs from "node:fs/promises";
import {
  chromium,
  request as playwrightRequest,
  type APIRequestContext,
  type BrowserContextOptions,
  type Page
} from "playwright";
import { env, resolveDataPath } from "../config.js";

export type SaveContext = {
  jobId: number;
  title: string;
  noteBody: string;
  freePreviewMarkdown: string;
  paidContentMarkdown: string;
  salesMode: "normal" | "free_paid";
  targetState: "draft" | "published";
  applySaleSettings: boolean;
  priceYen: number | null;
  transitionCtaText: string;
};

export type SaveResponse = {
  method: "unofficial_api" | "playwright" | "pinchtab";
  draftUrl: string;
  saleSettingStatus: "not_required" | "applied" | "failed";
};

export interface SaveAdapter {
  readonly method: SaveResponse["method"];
  save(context: SaveContext): Promise<SaveResponse>;
  verify(): Promise<{ status: "ok" | "warn" | "error"; detail: string }>;
}

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const NOTE_REQUEST_HEADERS = {
  "x-requested-with": "XMLHttpRequest",
  referer: "https://editor.note.com/",
  "content-type": "application/json"
} as const;

const stripNewlines = (value: string) => value.replace(/\r?\n/g, "");

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeBlocks = (value: string): string[] => {
  const lines = value.replace(/\r/g, "").split("\n");
  const blocks: string[] = [];
  let cur: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      cur.push(line);
    } else if (!inFence && /^-{3,}$/.test(line.trim())) {
      // --- はセパレーター記法。ブロックを区切るだけでコンテンツには含めない
      if (cur.length > 0) {
        blocks.push(cur.join("\n").trim());
        cur = [];
      }
    } else if (!inFence && line.trim() === "") {
      if (cur.length > 0) {
        blocks.push(cur.join("\n").trim());
        cur = [];
      }
    } else {
      cur.push(line);
    }
  }
  if (cur.length > 0) blocks.push(cur.join("\n").trim());
  return blocks.filter(Boolean);
};

const parseInlineMarkdown = (text: string): string =>
  text
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_, a: string, b: string) => `<b>${a ?? b}</b>`)
    .replace(/\*(.+?)\*|_(.+?)_/g, (_, a: string, b: string) => `<i>${a ?? b}</i>`)
    .replace(/`(.+?)`/g, (_, code: string) => `<code>${code}</code>`);

const buildBlockHtml = (block: string, seed: string) => {
  const id = `${seed}-${crypto.randomUUID().slice(0, 8)}`;
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { id, html: "" };

  const firstLine = lines[0];

  if (firstLine.startsWith("```")) {
    const lang = escapeHtml(firstLine.slice(3).trim());
    const lastLine = lines[lines.length - 1];
    const codeLines = lastLine === "```" ? lines.slice(1, -1) : lines.slice(1);
    const code = escapeHtml(codeLines.join("\n"));
    const langAttr = lang ? ` class="language-${lang}"` : "";
    return { id, html: `<pre name="${id}" id="${id}"><code${langAttr}>${code}</code></pre>` };
  }

  const h3 = firstLine.match(/^### (.+)$/);
  if (h3) return { id, html: `<h4 name="${id}" id="${id}">${parseInlineMarkdown(escapeHtml(h3[1]))}</h4>` };

  const h2 = firstLine.match(/^## (.+)$/);
  if (h2) return { id, html: `<h3 name="${id}" id="${id}">${parseInlineMarkdown(escapeHtml(h2[1]))}</h3>` };

  const h1 = firstLine.match(/^# (.+)$/);
  if (h1) return { id, html: `<h2 name="${id}" id="${id}">${parseInlineMarkdown(escapeHtml(h1[1]))}</h2>` };

  type Run = { type: "ul" | "ol" | "p"; lines: string[] };
  const runs: Run[] = [];
  for (const line of lines) {
    const last = runs[runs.length - 1];
    const type: Run["type"] = /^[-*] /.test(line) ? "ul" : /^\d+\. /.test(line) ? "ol" : "p";
    if (last && last.type === type) {
      last.lines.push(line);
    } else {
      runs.push({ type, lines: [line] });
    }
  }
  const parts = runs.map((run, idx) => {
    const attrs = idx === 0 ? ` name="${id}" id="${id}"` : "";
    if (run.type === "ul") {
      const items = run.lines
        .map((l) => `<li>${parseInlineMarkdown(escapeHtml(l.replace(/^[-*] /, "")))}</li>`)
        .join("");
      return `<ul${attrs}>${items}</ul>`;
    }
    if (run.type === "ol") {
      const items = run.lines
        .map((l) => `<li>${parseInlineMarkdown(escapeHtml(l.replace(/^\d+\. /, "")))}</li>`)
        .join("");
      return `<ol${attrs}>${items}</ol>`;
    }
    return `<p${attrs}>${run.lines.map((l) => parseInlineMarkdown(escapeHtml(l))).join("<br>")}</p>`;
  });
  return { id, html: parts.join("") };
};

const buildParagraphs = (value: string, seed: string) =>
  normalizeBlocks(value).map((block) => buildBlockHtml(block, seed));

export const buildStructuredNoteContent = (context: SaveContext): StructuredNoteContent => {
  const saleSettingRequested =
    context.applySaleSettings &&
    context.salesMode === "free_paid" &&
    context.paidContentMarkdown.trim().length > 0;

  if (!saleSettingRequested) {
    const paragraphs = buildParagraphs(context.noteBody, `job-${context.jobId}-body`);
    const fullHtml = paragraphs.map((item) => item.html).join("");
    return {
      fullHtml,
      freeHtml: fullHtml,
      paidHtml: "",
      separator: null,
      bodyLength: stripNewlines(context.noteBody).length
    };
  }

  // 無料パート末尾に CTA テキストを追加（セパレーター前に置くため）
  const freeMarkdown = [
    context.freePreviewMarkdown || context.noteBody,
    context.transitionCtaText?.trim() || null
  ]
    .filter(Boolean)
    .join("\n\n");

  const freeParagraphs = buildParagraphs(freeMarkdown, `job-${context.jobId}-free`);
  const paidParagraphs = buildParagraphs(context.paidContentMarkdown, `job-${context.jobId}-paid`);

  if (freeParagraphs.length === 0 || paidParagraphs.length === 0) {
    const paragraphs = buildParagraphs(context.noteBody, `job-${context.jobId}-body`);
    const fullHtml = paragraphs.map((item) => item.html).join("");
    return {
      fullHtml,
      freeHtml: fullHtml,
      paidHtml: "",
      separator: null,
      bodyLength: stripNewlines(context.noteBody).length
    };
  }

  const freeHtml = freeParagraphs.map((item) => item.html).join("");
  const paidHtml = paidParagraphs.map((item) => item.html).join("");

  return {
    fullHtml: `${freeHtml}${paidHtml}`,
    freeHtml,
    paidHtml,
    separator: freeParagraphs.at(-1)?.id ?? null,
    bodyLength: stripNewlines(`${context.freePreviewMarkdown}${context.paidContentMarkdown}`).length
  };
};

export const buildPublishPayload = (
  note: NoteIdentity,
  context: SaveContext,
  structured: StructuredNoteContent
): PublishPayload => {
  const saleSettingRequested =
    context.applySaleSettings &&
    context.salesMode === "free_paid" &&
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
    name: context.title,
    pay_body: saleSettingRequested ? structured.paidHtml : "",
    price: saleSettingRequested ? context.priceYen ?? 300 : 0,
    send_notifications_flag: true,
    separator: saleSettingRequested ? structured.separator : null,
    slug: note.slug,
    status: "published",
    circle_permissions: [],
    discount_campaigns: [],
    lead_form: {
      is_active: false,
      consent_url: ""
    },
    line_add_friend: {
      is_active: false,
      keyword: "",
      add_friend_url: ""
    },
    line_add_friend_access_token: ""
  };
};

/** note-storage-state.json → fallback to note-session-*.json の順で最初に見つかったパスを返す */
const findNoteSessionPath = async (): Promise<string | null> => {
  const primary = resolveDataPath("note-storage-state.json");
  try {
    await fs.access(primary);
    return primary;
  } catch {
    // fallback: note-session-{id}.json を検索
  }
  const dataDir = resolveDataPath();
  try {
    const files = await fs.readdir(dataDir);
    const fallback = files.find((f) => /^note-session-\d+\.json$/.test(f));
    if (fallback) {
      return resolveDataPath(fallback);
    }
  } catch {
    // noop
  }
  return null;
};

const requireNoteSession = async (): Promise<string> => {
  const sessionPath = await findNoteSessionPath();
  if (!sessionPath) {
    throw new Error("NOTE_SESSION_NOT_FOUND");
  }
  return sessionPath;
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
    if (!urlname) {
      throw new Error("NOTE_URLNAME_NOT_FOUND");
    }
    return { urlname };
  }

  async createTextNote(): Promise<NoteIdentity> {
    const response = await this.api.post("https://note.com/api/v1/text_notes", {
      data: { template_key: null }
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
      slug: data.data.slug
    };
  }

  async saveDraft(note: NoteIdentity, context: SaveContext, structured: StructuredNoteContent) {
    const saleSettingRequested =
      context.applySaleSettings &&
      context.salesMode === "free_paid" &&
      Boolean(structured.separator) &&
      structured.paidHtml.length > 0;

    const payload: Record<string, unknown> = {
      body: structured.fullHtml,
      body_length: structured.bodyLength,
      name: context.title,
      index: false,
      is_lead_form: false
    };

    if (saleSettingRequested) {
      payload.free_body = structured.freeHtml;
      payload.pay_body = structured.paidHtml;
      payload.separator = structured.separator;
      payload.limited = true;
      payload.price = context.priceYen ?? 300;
    }

    const response = await this.api.post(
      `https://note.com/api/v1/text_notes/draft_save?id=${note.id}&is_temp_saved=true`,
      { data: payload }
    );
    if (!response.ok()) {
      throw new Error(`NOTE_DRAFT_SAVE_FAILED_${response.status()}`);
    }
  }

  async publishNote(note: NoteIdentity, payload: PublishPayload) {
    const response = await this.api.put(`https://note.com/api/v1/text_notes/${note.id}`, {
      data: payload
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
      noteUrl: data.data?.note_url ?? null
    };
  }
}

class NoteBrowserAutomation {
  constructor(private readonly persistStorageStatePath?: string) {}

  async login(page: Page) {
    if (!this.persistStorageStatePath) {
      // PinchTab mode or similar where we expect session is already there or managed externally
      return;
    }

    await page.goto("https://note.com/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const isLoggedOut = await page.locator('a[href="/login"]').isVisible();
    if (isLoggedOut) {
      throw new Error("NOTE_SESSION_EXPIRED");
    }
  }

  async createApiClient(page: Page) {
    const storageState = await page.context().storageState(
      this.persistStorageStatePath ? { path: this.persistStorageStatePath } : undefined
    );

    return new NoteApiClient(
      await playwrightRequest.newContext({
        storageState,
        extraHTTPHeaders: NOTE_REQUEST_HEADERS
      })
    );
  }

  /**
   * エディタを開いて「有料エリア指定」ボタンをクリックし有料境界線を設定する。
   * 成功時 true、失敗時 false を返す（例外は throw しない）。
   */
  async clickPaywallButton(page: Page, noteKey: string, separatorId: string): Promise<boolean> {
    try {
      await page.goto(`https://editor.note.com/notes/${noteKey}/edit/`, { waitUntil: "domcontentloaded" });
      // エディタの初期化を待つ
      await page.waitForTimeout(2000);

      // 無料パート末尾ブロックにカーソルを置く
      const separatorEl = page.locator(`[id="${separatorId}"]`).first();
      const visible = await separatorEl.isVisible({ timeout: 5000 }).catch(() => false);
      if (visible) {
        await separatorEl.click();
        await page.keyboard.press("End");
      }

      // 「有料エリア指定」ボタンをクリック
      const btn = page.getByText("有料エリア指定", { exact: true }).first();
      await btn.waitFor({ state: "visible", timeout: 10000 });
      await btn.click();
      await page.waitForTimeout(1000);
      return true;
    } catch {
      return false;
    }
  }

  async save(page: Page, context: SaveContext, method: SaveResponse["method"]): Promise<SaveResponse> {
    await this.login(page);
    const api = await this.createApiClient(page);

    try {
      const user = await api.getCurrentUser();
      const note = await api.createTextNote();
      const structured = buildStructuredNoteContent(context);

      await api.saveDraft(note, context, structured);

      const saleSettingRequested =
        context.applySaleSettings &&
        context.salesMode === "free_paid" &&
        Boolean(structured.separator) &&
        structured.paidHtml.length > 0;

      if (context.targetState === "draft") {
        // ドラフト保存APIはpaywall設定を無視するため、エディタUI操作で境界線を設定する
        let saleSettingStatus: SaveResponse["saleSettingStatus"] = "not_required";
        if (saleSettingRequested) {
          const clicked = await this.clickPaywallButton(page, note.key, structured.separator!);
          saleSettingStatus = clicked ? "applied" : "failed";
        }
        return {
          method,
          draftUrl: `https://editor.note.com/notes/${note.key}/edit/`,
          saleSettingStatus
        };
      }

      const publishPayload = buildPublishPayload(note, context, structured);
      const published = await api.publishNote(note, publishPayload);

      return {
        method,
        draftUrl: published.noteUrl ?? `https://note.com/${user.urlname}/n/${note.key}`,
        saleSettingStatus: saleSettingRequested ? ("applied" as const) : ("not_required" as const)
      };
    } finally {
      await api.dispose();
    }
  }
}

class NotePlaywrightClient {
  constructor(private readonly storageStatePath: string) {}

  async run<T>(task: (page: Page) => Promise<T>) {
    const browser = await chromium.launch({ headless: env.PLAYWRIGHT_HEADLESS });
    const contextOptions: BrowserContextOptions = {
      viewport: { width: 1440, height: 960 }
    };
    try {
      await fs.access(this.storageStatePath);
      contextOptions.storageState = this.storageStatePath;
    } catch {
      // noop
    }
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    try {
      return await task(page);
    } finally {
      await context.storageState({ path: this.storageStatePath });
      await browser.close();
    }
  }
}

class PinchTabClient {
  private get headers() {
    return env.PINCHTAB_TOKEN
      ? { Authorization: `Bearer ${env.PINCHTAB_TOKEN}` }
      : undefined;
  }

  private async requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${env.PINCHTAB_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(this.headers ?? {}),
        ...(init?.headers ?? {})
      }
    });
    if (!response.ok) {
      throw new Error(`PINCHTAB_REQUEST_FAILED_${response.status}_${path}`);
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
    const preferredName = env.PINCHTAB_PROFILE_NAME.trim();
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
        .filter((port) => Number.isFinite(port))
    );
    const preferred = env.PINCHTAB_LAUNCH_PORT;
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
        if (response.ok) {
          return;
        }
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
    if (!profile) {
      throw new Error("PINCHTAB_PROFILE_NOT_FOUND");
    }

    const instances = await this.listInstances();
    const running = instances.find(
      (instance) => instance.profileName === profile.name && instance.status === "running"
    );

    let launchedInstance: PinchTabInstance | null = null;
    const instance =
      running ??
      (await this.requestJson<PinchTabInstance>("/instances/launch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: profile.name,
          port: String(this.selectPort(instances)),
          mode: env.PLAYWRIGHT_HEADLESS ? "headless" : "headed"
        })
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
            method: "POST"
          });
        } catch {
          // noop
        }
      }
    }
  }
}

export class UnofficialApiAdapter implements SaveAdapter {
  readonly method = "unofficial_api" as const;

  async save(context: SaveContext) {
    if (!env.NOTE_UNOFFICIAL_API_URL) {
      if (env.ENABLE_REAL_NOTE_AUTOMATION) {
        throw new Error("NOTE_UNOFFICIAL_API_NOT_CONFIGURED");
      }
      if (env.MOCK_NOTE_API_RESULT === "fail") throw new Error("MOCK_NOTE_API_FAILED");
      return {
        method: this.method,
        draftUrl:
          context.targetState === "published"
            ? `https://note.com/mock/published/${context.jobId}`
            : `https://note.com/mock/draft/${context.jobId}`,
        saleSettingStatus:
          context.applySaleSettings && context.salesMode === "free_paid"
            ? ("failed" as const)
            : ("not_required" as const)
      };
    }

    const response = await fetch(env.NOTE_UNOFFICIAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.NOTE_UNOFFICIAL_API_TOKEN
          ? { Authorization: `Bearer ${env.NOTE_UNOFFICIAL_API_TOKEN}` }
          : {})
      },
      body: JSON.stringify(context)
    });
    if (!response.ok) throw new Error(`NOTE_API_${response.status}`);
    const data = (await response.json()) as { draftUrl?: string };
    return {
      method: this.method,
      draftUrl:
        data.draftUrl ??
        (context.targetState === "published"
          ? `https://note.com/mock/published/${context.jobId}`
          : `https://note.com/mock/draft/${context.jobId}`),
      saleSettingStatus:
        context.applySaleSettings && context.salesMode === "free_paid"
          ? ("failed" as const)
          : ("not_required" as const)
    };
  }

  async verify() {
    if (env.NOTE_UNOFFICIAL_API_URL) {
      return { status: "ok" as const, detail: "note 非公式API URL 設定済み" };
    }
    if (env.ENABLE_REAL_NOTE_AUTOMATION) {
      return {
        status: "warn" as const,
        detail: "note 非公式API URL 未設定のため Playwright / PinchTab API保存を使用"
      };
    }
    return { status: "warn" as const, detail: "note 非公式APIはモック動作" };
  }
}

export class PlaywrightAdapter implements SaveAdapter {
  readonly method = "playwright" as const;

  async save(context: SaveContext) {
    if (!env.ENABLE_REAL_NOTE_AUTOMATION) {
      if (env.MOCK_PLAYWRIGHT_RESULT === "fail") throw new Error("MOCK_PLAYWRIGHT_FAILED");
      return {
        method: this.method,
        draftUrl:
          context.targetState === "published"
            ? `https://note.com/mock/playwright/published/${context.jobId}`
            : `https://note.com/mock/playwright/${context.jobId}`,
        saleSettingStatus:
          context.applySaleSettings && context.targetState === "published" && context.salesMode === "free_paid"
            ? ("applied" as const)
            : ("not_required" as const)
      };
    }

    const sessionPath = await requireNoteSession();
    const client = new NotePlaywrightClient(sessionPath);
    return client.run(async (page) => {
      const automation = new NoteBrowserAutomation(sessionPath);
      return automation.save(page, context, this.method);
    });
  }

  async verify() {
    try {
      const browser = await chromium.launch({ headless: true });
      await browser.close();
      const sessionPath = await findNoteSessionPath();
      if (env.ENABLE_REAL_NOTE_AUTOMATION && sessionPath) {
        return { status: "ok" as const, detail: "Playwright 起動可能 / note セッション保存済み" };
      }
      return { status: "ok" as const, detail: "Playwright 起動可能 (セッション未保存)" };
    } catch {
      return { status: "error" as const, detail: "Playwright 起動失敗" };
    }
  }
}

export class PinchTabAdapter implements SaveAdapter {
  readonly method = "pinchtab" as const;

  async save(context: SaveContext) {
    if (!env.ENABLE_REAL_NOTE_AUTOMATION) {
      if (env.MOCK_PINCHTAB_RESULT === "fail") throw new Error("MOCK_PINCHTAB_FAILED");
      return {
        method: this.method,
        draftUrl:
          context.targetState === "published"
            ? `https://note.com/mock/pinchtab/published/${context.jobId}`
            : `https://note.com/mock/pinchtab/${context.jobId}`,
        saleSettingStatus:
          context.applySaleSettings && context.targetState === "published" && context.salesMode === "free_paid"
            ? ("applied" as const)
            : ("not_required" as const)
      };
    }

    const client = new PinchTabClient();
    const automation = new NoteBrowserAutomation();
    return client.run(async (page) => automation.save(page, context, this.method));
  }

  async verify() {
    try {
      const response = await fetch(`${env.PINCHTAB_BASE_URL}/health`, {
        headers: env.PINCHTAB_TOKEN
          ? { Authorization: `Bearer ${env.PINCHTAB_TOKEN}` }
          : undefined
      });
      if (!response.ok) {
        return { status: "warn" as const, detail: "PinchTab はモックまたは未接続" };
      }

      const profilesResponse = await fetch(`${env.PINCHTAB_BASE_URL}/profiles`, {
        headers: env.PINCHTAB_TOKEN
          ? { Authorization: `Bearer ${env.PINCHTAB_TOKEN}` }
          : undefined
      });
      if (profilesResponse.ok) {
        return { status: "ok" as const, detail: "PinchTab 接続成功 / 保存実行可能" };
      }
    } catch {
      // noop
    }
    return { status: "warn" as const, detail: "PinchTab はモックまたは未接続" };
  }
}
