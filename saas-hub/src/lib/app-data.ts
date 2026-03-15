export type AppStatusType = "generating" | "completed" | "error" | "saved" | "published" | "pending" | "running";
export type SaleMode = "free" | "paid";
export type NoteMethod = "unofficial_api" | "playwright" | "pinchtab";
export type SaleSettingStatus = "not_required" | "applied" | "failed";
export type ProviderId =
  | "gemini"
  | "claude"
  | "openai"
  | "codex_cli"
  | "github_copilot"
  | "alibaba_model_studio"
  | "openrouter"
  | "groq"
  | "deepseek"
  | "xai"
  | "custom_openai_compatible";
export type ProviderAuthMode = "api_key" | "oauth" | "local_auth";
export type ProviderTestStatus = "completed" | "pending" | "error";

export type AccountRecord = {
  id: string;
  name: string;
  priority: number;
};

export type PromptRecord = {
  id: string;
  title: string;
  description: string;
  content: string;
};

export type TimelineItem = {
  label: string;
  time: string;
  status?: "success" | "error" | "info";
  detail?: string;
};

export type ReferenceRecord = {
  title: string;
  summary: string;
  link: string;
};

export type ProviderSummary = {
  id: ProviderId;
  label: string;
  authMode: ProviderAuthMode;
  configured: boolean;
  reachable: boolean;
  usable: boolean;
  enabled: boolean;
  model: string;
  baseUrl: string | null;
  lastTestStatus: ProviderTestStatus;
  lastTestError: string | null;
  lastTestAt: string | null;
  oauthClientSource?: "builtin" | "config" | "none";
  configuredClientId?: string | null;
};

export type ArticleRecord = {
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
  references: ReferenceRecord[];
  timeline: TimelineItem[];
  saleMode: SaleMode;
  price: number | null;
  accountId: string;
  promptId?: string;
  instruction?: string;
  providerId?: ProviderId;
  lastNoteMethod?: NoteMethod | null;
  saleSettingStatus?: SaleSettingStatus | null;
  lastError?: string | null;
};

export type DiagnosticsRecord = {
  name: string;
  status: AppStatusType;
  detail: string;
  category?: "runtime" | "ai" | "note";
};

export type AppSettings = {
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

export type AppDataState = {
  articles: ArticleRecord[];
  prompts: PromptRecord[];
  accounts: AccountRecord[];
  settings: AppSettings;
  diagnostics: DiagnosticsRecord[];
  lastDiagnosticsRunAt: string;
};

export const providerLabels: Record<ProviderId, string> = {
  gemini: "Gemini",
  claude: "Claude",
  openai: "OpenAI",
  codex_cli: "Codex CLI",
  github_copilot: "GitHub Copilot",
  alibaba_model_studio: "Alibaba Model Studio",
  openrouter: "OpenRouter",
  groq: "Groq",
  deepseek: "DeepSeek",
  xai: "xAI",
  custom_openai_compatible: "Custom OpenAI互換",
};

const providerModels: Record<ProviderId, string> = {
  gemini: "gemini-2.0-flash",
  claude: "claude-3-7-sonnet-latest",
  openai: "gpt-4.1-mini",
  codex_cli: "gpt-5-codex",
  github_copilot: "github-copilot/gpt-5.4",
  alibaba_model_studio: "qwen-plus",
  openrouter: "openai/gpt-4.1-mini",
  groq: "llama-3.3-70b-versatile",
  deepseek: "deepseek-chat",
  xai: "grok-3-mini",
  custom_openai_compatible: "custom-model",
};

const providerBaseUrls: Partial<Record<ProviderId, string>> = {
  openai: "https://api.openai.com/v1",
  alibaba_model_studio: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
  deepseek: "https://api.deepseek.com/v1",
  xai: "https://api.x.ai/v1",
  custom_openai_compatible: "",
};

const now = () =>
  new Date().toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

export const formatDate = (value = new Date()) => value.toISOString().slice(0, 10);
export const buildNoteUrl = (id: string) => `https://note.com/local/n/${id}`;
export const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const createDefaultProviderSummary = (id: ProviderId): ProviderSummary => ({
  id,
  label: providerLabels[id],
  authMode: id === "github_copilot" ? "oauth" : id === "codex_cli" ? "local_auth" : "api_key",
  configured: false,
  reachable: false,
  usable: false,
  enabled: true,
  model: providerModels[id],
  baseUrl: providerBaseUrls[id] ?? null,
  lastTestStatus: "pending",
  lastTestError: null,
  lastTestAt: null,
  oauthClientSource: id === "github_copilot" ? "none" : undefined,
  configuredClientId: id === "github_copilot" ? null : undefined,
});

export const createDefaultProviderSummaries = (): Record<ProviderId, ProviderSummary> => ({
  gemini: createDefaultProviderSummary("gemini"),
  claude: createDefaultProviderSummary("claude"),
  openai: createDefaultProviderSummary("openai"),
  codex_cli: createDefaultProviderSummary("codex_cli"),
  github_copilot: createDefaultProviderSummary("github_copilot"),
  alibaba_model_studio: createDefaultProviderSummary("alibaba_model_studio"),
  openrouter: createDefaultProviderSummary("openrouter"),
  groq: createDefaultProviderSummary("groq"),
  deepseek: createDefaultProviderSummary("deepseek"),
  xai: createDefaultProviderSummary("xai"),
  custom_openai_compatible: createDefaultProviderSummary("custom_openai_compatible"),
});

export const defaultAccounts: AccountRecord[] = [
  { id: "1", name: "メインアカウント", priority: 1 },
  { id: "2", name: "サブアカウント", priority: 2 },
];

export const defaultPrompts: PromptRecord[] = [
  {
    id: "1",
    title: "標準テンプレート",
    description: "一般的なnote記事向けの標準プロンプト。SEOと読みやすさのバランスを重視。",
    content:
      "以下のキーワードに基づいて、note向けの有料記事を作成してください。読者が価値を感じる内容にし、無料部分で興味を引き、有料部分で具体的なノウハウを提供してください。",
  },
  {
    id: "2",
    title: "SEO特化",
    description: "検索エンジン最適化を重視したプロンプト。キーワードの自然な配置と構造化を意識。",
    content:
      "SEOを意識した記事を作成してください。H2/H3タグを適切に使い、キーワードを自然に配置し、メタディスクリプションも提案してください。",
  },
  {
    id: "3",
    title: "カジュアル調",
    description: "親しみやすい口語調のプロンプト。若い読者層をターゲットにした記事向け。",
    content:
      "フレンドリーでカジュアルなトーンで記事を書いてください。「〜だよね」「〜してみて！」のような親しみやすい表現を使ってください。",
  },
];

export const defaultArticles: ArticleRecord[] = [
  {
    id: "1",
    title: "【2026年最新】AI副業の始め方完全ガイド｜月5万円を目指すロードマップ",
    keyword: "AI副業の始め方",
    genre: "テクノロジー",
    status: "completed",
    noteStatus: "published",
    createdAt: "2026-03-12",
    scheduledAt: null,
    noteUrl: "https://note.com/example/n/n123",
    freeContent:
      "AI技術の進歩により、誰でも副業として活用できる時代が到来しました。本記事では、AI副業の具体的な始め方から、月5万円の収入を目指すためのステップを詳しく解説します。\n\nAIツールを使った副業は、プログラミングスキルがなくても始められるものが多くあります。",
    paidGuidance: "ここから先は有料コンテンツとなります。より具体的な戦略と実践的なノウハウをお届けします。",
    paidContent:
      "## 具体的な月5万円達成ロードマップ\n\n### Step 1: ツール選定（1週目）\n最初に取り組むべきは、自分に合ったAIツールの選定です。\n\n### Step 2: スキル構築（2-3週目）\n選んだツールの基本操作をマスターしましょう。",
    body: "本文全体がここに表示されます。無料部分と有料部分を含む完全な記事本文です。",
    references: [
      { title: "AIビジネス活用白書 2026", summary: "2026年のAIビジネス活用に関する包括的な調査レポート。", link: "#" },
      { title: "副業市場レポート", summary: "副業市場の最新動向レポート。", link: "#" },
    ],
    timeline: [
      { label: "記事生成開始", time: "14:30:01", status: "info" },
      { label: "Gemini API リクエスト送信", time: "14:30:02", status: "info" },
      { label: "本文生成完了 (3,200文字)", time: "14:31:15", status: "success" },
      { label: "処理完了", time: "14:32:00", status: "success" },
      { label: "note 下書き保存", time: "14:35:00", status: "success" },
      { label: "note 公開", time: "15:00:00", status: "success" },
    ],
    saleMode: "paid",
    price: 980,
    accountId: "1",
    promptId: "1",
    instruction: "",
    providerId: "gemini",
    lastNoteMethod: "playwright",
    saleSettingStatus: "applied",
    lastError: null,
  },
  {
    id: "2",
    title: "ChatGPT活用術まとめ",
    keyword: "ChatGPT活用術",
    genre: "ビジネス",
    status: "generating",
    noteStatus: "pending",
    createdAt: "2026-03-12",
    scheduledAt: "2026-03-15 09:00",
    noteUrl: null,
    freeContent: "ChatGPTを日々の業務に組み込むコツを整理する。",
    paidGuidance: "具体的な活用例はこの先で解説。",
    paidContent: "テンプレ化、議事録化、リサーチ短縮の具体例。",
    body: "ChatGPT活用術まとめの本文。",
    references: [],
    timeline: [{ label: "記事生成中", time: "10:15:00", status: "info" }],
    saleMode: "free",
    price: null,
    accountId: "1",
    providerId: "gemini",
    lastNoteMethod: null,
    saleSettingStatus: null,
    lastError: null,
  },
];

export const defaultSettings: AppSettings = {
  localhostPort: 3000,
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
  providerSummaries: createDefaultProviderSummaries(),
};

export const defaultState: AppDataState = {
  articles: defaultArticles,
  prompts: defaultPrompts,
  accounts: defaultAccounts,
  settings: defaultSettings,
  diagnostics: [],
  lastDiagnosticsRunAt: new Date().toISOString(),
};

export const createGeneratedArticle = ({
  keyword,
  genre,
  accountId,
  promptId,
  saleMode,
  price,
  instruction,
  providerId,
  scheduleAt,
  noteAction,
}: {
  keyword: string;
  genre: string;
  accountId: string;
  promptId?: string;
  saleMode: SaleMode;
  price: number | null;
  instruction?: string;
  providerId?: ProviderId;
  scheduleAt?: string | null;
  noteAction: "publish" | "draft" | "schedule";
}): ArticleRecord => {
  const id = createId();
  const title = `【自動生成】${keyword}をわかりやすく解説`;
  const freeContent = `${keyword}をこれから活用したい人向けに、まず押さえるべきポイントを整理する。`;
  const paidGuidance =
    saleMode === "paid"
      ? "ここから先では、実践ステップと失敗しにくい進め方を具体的にまとめる。"
      : "無料記事として最後まで読める構成。";
  const paidContent =
    saleMode === "paid"
      ? "### 実践ステップ\n1. 目的を明確にする\n2. 最初の行動を小さく切る\n3. テンプレ化して再利用する"
      : "無料公開モードのため有料部分はなし。";
  const body = [freeContent, paidGuidance, paidContent, instruction].filter(Boolean).join("\n\n");

  const timeline: TimelineItem[] = [
    { label: "記事生成開始", time: now(), status: "info" },
    { label: "本文生成完了", time: now(), status: "success" },
  ];

  let noteStatus: AppStatusType = "pending";
  const scheduledAt = scheduleAt ?? null;

  if (noteAction === "draft") {
    noteStatus = "running";
    timeline.push({ label: "note 下書き保存を開始", time: now(), status: "info" });
  } else if (noteAction === "publish") {
    noteStatus = "running";
    timeline.push({ label: "note 公開を開始", time: now(), status: "info" });
  } else if (noteAction === "schedule") {
    timeline.push({
      label: "予約投稿を設定",
      time: now(),
      status: scheduledAt ? "success" : "error",
      detail: scheduledAt ?? "予約日時未設定",
    });
  }

  return {
    id,
    title,
    keyword,
    genre,
    status: "completed",
    noteStatus,
    createdAt: formatDate(),
    scheduledAt,
    noteUrl: null,
    freeContent,
    paidGuidance,
    paidContent,
    body,
    references: [{ title: `${keyword} 参考資料`, summary: `${keyword} に関する下調べメモ。`, link: "#" }],
    timeline,
    saleMode,
    price,
    accountId,
    promptId,
    instruction,
    providerId: providerId ?? "gemini",
    lastNoteMethod: null,
    saleSettingStatus: null,
    lastError: null,
  };
};

export const buildDiagnostics = (settings: AppSettings, accounts: AccountRecord[]): DiagnosticsRecord[] => [
  {
    name: "Playwright",
    status: settings.chromiumInstalled ? "completed" : "pending",
    detail: settings.chromiumInstalled ? "Chromium インストール済み" : "Chromium 未導入",
    category: "runtime",
  },
  {
    name: "PinchTab",
    status: settings.pinchTabUrl && settings.pinchTabPort ? "completed" : "pending",
    detail: settings.pinchTabUrl && settings.pinchTabPort ? `接続先 ${settings.pinchTabUrl}:${settings.pinchTabPort}` : "接続先未設定",
    category: "runtime",
  },
  {
    name: "既定 AI Provider",
    status: settings.providerSummaries[settings.defaultProvider]?.usable ? "completed" : "pending",
    detail: `既定: ${providerLabels[settings.defaultProvider]} / fallback: ${settings.fallbackProviders.map((id) => providerLabels[id]).join(", ") || "なし"}`,
    category: "ai",
  },
  {
    name: "note ログイン",
    status: accounts.length > 0 ? "pending" : "error",
    detail: accounts.length > 0
      ? `${accounts.length} 件のアカウント登録済み / 設定>noteタブでセッションを取得してください`
      : "アカウント未登録 / 設定>アカウントタブでアカウントを追加してください",
    category: "note",
  },
];
