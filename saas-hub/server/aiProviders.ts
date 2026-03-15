import fs from "node:fs/promises";
import path from "node:path";
import { loadProviderSecrets, saveProviderSecrets, type ProviderId, type ProviderSecretRecord } from "./providerSecretsStore";

type ReferenceRecord = {
  title: string;
  summary: string;
  link: string;
};

type GraphPoint = {
  label: string;
  value: number;
};

export type GenerationInput = {
  keyword: string;
  genre: string;
  accountId: string;
  promptId?: string;
  promptTitle?: string;
  promptContent?: string;
  includeImages: boolean;
  includeGraphs: boolean;
  saleMode: "free" | "paid";
  price: number | null;
  instruction?: string;
  scheduledAt?: string | null;
  action: "publish" | "draft" | "schedule";
};

export type GeneratedContent = {
  title: string;
  freeContent: string;
  paidGuidance: string;
  paidContent: string;
  body: string;
  references: ReferenceRecord[];
  heroImagePrompt: string | null;
  heroImageCaption: string | null;
  graphTitle: string | null;
  graphUnit: string | null;
  graphData: GraphPoint[];
  generationMode: ProviderId | "fallback";
};

export type ProviderSummary = {
  id: ProviderId;
  label: string;
  authMode: "api_key" | "oauth" | "local_auth";
  configured: boolean;
  reachable: boolean;
  usable: boolean;
  enabled: boolean;
  model: string;
  baseUrl: string | null;
  lastTestStatus: "completed" | "pending" | "error";
  lastTestError: string | null;
  lastTestAt: string | null;
  oauthClientSource?: "builtin" | "config" | "none";
  configuredClientId?: string | null;
};

export type AiRuntimeSettings = {
  defaultProvider: ProviderId;
  fallbackProviders: ProviderId[];
  strictProviderMode: boolean;
  generationTimeoutMs: number;
};

const providerLabels: Record<ProviderId, string> = {
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

const providerAuthModes: Record<ProviderId, ProviderSummary["authMode"]> = {
  gemini: "api_key",
  claude: "api_key",
  openai: "api_key",
  codex_cli: "local_auth",
  github_copilot: "oauth",
  alibaba_model_studio: "api_key",
  openrouter: "api_key",
  groq: "api_key",
  deepseek: "api_key",
  xai: "api_key",
  custom_openai_compatible: "api_key",
};

const stripFence = (value: string) =>
  value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

const toJson = <T>(value: string) => JSON.parse(stripFence(value)) as T;

const clampGraphPoints = (points: GraphPoint[] | undefined, includeGraphs: boolean) => {
  if (!includeGraphs) return [];
  const safe = (points ?? [])
    .map((point) => ({
      label: String(point.label ?? "").slice(0, 20),
      value: Number(point.value ?? 0),
    }))
    .filter((point) => point.label && Number.isFinite(point.value));

  if (safe.length >= 3) return safe.slice(0, 6);

  return [
    { label: "準備", value: 20 },
    { label: "初動", value: 45 },
    { label: "改善", value: 68 },
    { label: "定着", value: 82 },
  ];
};

const buildFallbackContent = (input: GenerationInput): GeneratedContent => {
  const intro = `${input.keyword}をテーマに、${input.genre}の読者がすぐ動ける形で整理した記事。`;
  const freeContent = [
    `${input.keyword}で成果を出したいなら、最初にやるべきことは「何を変えたいか」を言葉にすること。`,
    `この記事では、${input.genre}の文脈で使いやすい導入ポイントと、失敗しにくい進め方を先にまとめる。`,
  ].join("\n\n");
  const paidGuidance =
    input.saleMode === "paid"
      ? "ここから先で、実際に形にするための手順と、つまずきやすいポイントの避け方をまとめる。"
      : "このまま最後まで読める構成で、実践ポイントまで整理する。";
  const paidContent =
    input.saleMode === "paid"
      ? ["## 実践ステップ", `1. ${input.keyword}で狙う成果を1つに絞る`, "2. 1週間で回せる小さな検証にする", "3. 数字で振り返って改善する"].join("\n")
      : "無料公開モードのため、有料パートは使わずに最後まで読める構成にしている。";
  const body = [intro, freeContent, paidGuidance, paidContent, input.instruction].filter(Boolean).join("\n\n");

  return {
    title: `【${input.genre}向け】${input.keyword}を最短で形にする手順`,
    freeContent,
    paidGuidance,
    paidContent,
    body,
    references: [{ title: `${input.keyword}の要点メモ`, summary: `${input.genre}の読者に必要な論点を整理した内部メモ。`, link: "#" }],
    heroImagePrompt: input.includeImages ? `${input.keyword}を象徴する要素を1つ置き、${input.genre}の読者に信頼感が伝わるアイキャッチを作る。` : null,
    heroImageCaption: input.includeImages ? `${input.keyword}のアイキャッチ案` : null,
    graphTitle: input.includeGraphs ? `${input.keyword}の改善イメージ` : null,
    graphUnit: input.includeGraphs ? "スコア" : null,
    graphData: clampGraphPoints(undefined, input.includeGraphs),
    generationMode: "fallback",
  };
};

const buildPrompt = (input: GenerationInput) => `
あなたは note 記事の編集者。
次の条件から note 記事用の JSON を返すこと。

条件:
- キーワード: ${input.keyword}
- ジャンル: ${input.genre}
- 販売モード: ${input.saleMode}
- 価格: ${input.price ?? 0}
- 画像生成を使う: ${input.includeImages ? "はい" : "いいえ"}
- グラフを使う: ${input.includeGraphs ? "はい" : "いいえ"}
- 補足指示: ${input.instruction ?? "なし"}
- プロンプト名: ${input.promptTitle ?? "未指定"}
- プロンプト内容: ${input.promptContent ?? "未指定"}

JSON の形式:
{
  "title": "string",
  "freeContent": "string",
  "paidGuidance": "string",
  "paidContent": "string",
  "body": "string",
  "references": [{"title":"string","summary":"string","link":"string"}],
  "heroImagePrompt": "string or null",
  "heroImageCaption": "string or null",
  "graphTitle": "string or null",
  "graphUnit": "string or null",
  "graphData": [{"label":"string","value": 0}]
}

ルール:
- 日本語で書く
- 無料部分だけ読んでも価値がある構成にする
- 有料モードの時だけ paidContent をしっかり埋める
- graphData は includeGraphs が false の時は空配列
- heroImagePrompt は includeImages が false の時は null
- link は外部URLがなければ "#" を入れる
- body は記事全文としてそのまま表示できる文章にする
`.trim();

const normalizeGenerated = (input: GenerationInput, parsed: Omit<GeneratedContent, "generationMode">, generationMode: GeneratedContent["generationMode"]): GeneratedContent => ({
  title: parsed.title,
  freeContent: parsed.freeContent,
  paidGuidance: parsed.paidGuidance,
  paidContent: parsed.paidContent,
  body: parsed.body,
  references: (parsed.references ?? []).slice(0, 5),
  heroImagePrompt: input.includeImages ? parsed.heroImagePrompt ?? null : null,
  heroImageCaption: input.includeImages ? parsed.heroImageCaption ?? parsed.title : null,
  graphTitle: input.includeGraphs ? parsed.graphTitle ?? `${input.keyword}の推移` : null,
  graphUnit: input.includeGraphs ? parsed.graphUnit ?? "指標" : null,
  graphData: clampGraphPoints(parsed.graphData, input.includeGraphs),
  generationMode,
});

const requestJson = async (url: string, init: RequestInit) => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`PROVIDER_REQUEST_FAILED_${response.status}`);
  }
  return response.json();
};

const callGemini = async (secret: ProviderSecretRecord, prompt: string) => {
  const model = secret.model || "gemini-2.0-flash";
  const data = await requestJson(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${secret.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9,
        responseMimeType: "application/json",
      },
    }),
  }) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("GEMINI_EMPTY_RESPONSE");
  return text;
};

const callAnthropic = async (secret: ProviderSecretRecord, prompt: string) => {
  const data = await requestJson("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": secret.apiKey ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: secret.model || "claude-3-7-sonnet-latest",
      max_tokens: 4000,
      temperature: 0.9,
      messages: [{ role: "user", content: prompt }],
    }),
  }) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = data.content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error("CLAUDE_EMPTY_RESPONSE");
  return text;
};

const callOpenAIResponses = async (secret: ProviderSecretRecord, prompt: string, bearerToken?: string) => {
  const baseUrl = secret.baseUrl || "https://api.openai.com/v1";
  const data = await requestJson(`${baseUrl.replace(/\/$/, "")}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearerToken ?? secret.apiKey ?? ""}`,
    },
    body: JSON.stringify({
      model: secret.model || "gpt-4.1-mini",
      input: prompt,
      temperature: 0.9,
      text: {
        format: {
          type: "json_schema",
          name: "note_article",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              freeContent: { type: "string" },
              paidGuidance: { type: "string" },
              paidContent: { type: "string" },
              body: { type: "string" },
              references: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: { type: "string" },
                    summary: { type: "string" },
                    link: { type: "string" },
                  },
                  required: ["title", "summary", "link"],
                },
              },
              heroImagePrompt: { type: ["string", "null"] },
              heroImageCaption: { type: ["string", "null"] },
              graphTitle: { type: ["string", "null"] },
              graphUnit: { type: ["string", "null"] },
              graphData: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    label: { type: "string" },
                    value: { type: "number" },
                  },
                  required: ["label", "value"],
                },
              },
            },
            required: ["title", "freeContent", "paidGuidance", "paidContent", "body", "references", "heroImagePrompt", "heroImageCaption", "graphTitle", "graphUnit", "graphData"],
          },
        },
      },
    }),
  }) as {
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  const text = data.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (!text) throw new Error("OPENAI_EMPTY_RESPONSE");
  return text;
};

const callOpenAICompatible = async (secret: ProviderSecretRecord, prompt: string, bearerToken?: string) => {
  const baseUrl = secret.baseUrl;
  if (!baseUrl) throw new Error("OPENAI_COMPATIBLE_BASE_URL_MISSING");
  const data = await requestJson(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearerToken ?? secret.apiKey ?? ""}`,
    },
    body: JSON.stringify({
      model: secret.model,
      temperature: 0.9,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  }) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("OPENAI_COMPATIBLE_EMPTY_RESPONSE");
  return text;
};

const readCodexBearer = async (secret: ProviderSecretRecord) => {
  const authPath = secret.authPath || "C:\\Users\\i0swi\\.codex\\auth.json";
  const raw = await fs.readFile(authPath, "utf8");
  const parsed = JSON.parse(raw) as {
    OPENAI_API_KEY?: string | null;
    tokens?: {
      access_token?: string | null;
    };
  };
  const token = parsed.OPENAI_API_KEY || parsed.tokens?.access_token;
  if (!token) throw new Error("CODEX_AUTH_TOKEN_NOT_FOUND");
  return token;
};

const providerRequest = async (providerId: ProviderId, secret: ProviderSecretRecord, prompt: string) => {
  switch (providerId) {
    case "gemini":
      return callGemini(secret, prompt);
    case "claude":
      return callAnthropic(secret, prompt);
    case "openai":
      return callOpenAIResponses(secret, prompt);
    case "codex_cli":
      return callOpenAIResponses({ ...secret, baseUrl: "https://api.openai.com/v1" }, prompt, await readCodexBearer(secret));
    case "github_copilot":
      return callOpenAICompatible({ ...secret, baseUrl: secret.baseUrl || "https://api.githubcopilot.com" }, prompt, secret.copilotToken ?? undefined);
    case "alibaba_model_studio":
    case "openrouter":
    case "groq":
    case "deepseek":
    case "xai":
    case "custom_openai_compatible":
      return callOpenAICompatible(secret, prompt);
    default:
      throw new Error(`PROVIDER_NOT_SUPPORTED_${providerId}`);
  }
};

const hasCredential = (providerId: ProviderId, secret: ProviderSecretRecord) => {
  if (providerId === "codex_cli") return Boolean(secret.enabled !== false);
  if (providerId === "github_copilot") return Boolean(secret.copilotToken || secret.githubToken || secret.configuredClientId);
  return Boolean(secret.apiKey);
};

export const listProviderSummaries = async (): Promise<Record<ProviderId, ProviderSummary>> => {
  const store = await loadProviderSecrets();
  return Object.fromEntries(
    (Object.keys(store) as ProviderId[]).map((providerId) => {
      const secret = store[providerId];
      return [
        providerId,
        {
          id: providerId,
          label: providerLabels[providerId],
          authMode: providerAuthModes[providerId],
          configured: hasCredential(providerId, secret),
          reachable: secret.lastExchangeStatus === "completed" || secret.lastExchangeStatus === "configured",
          usable: secret.lastExchangeStatus === "completed" || providerId === "codex_cli",
          enabled: secret.enabled ?? true,
          model: secret.model ?? "",
          baseUrl: secret.baseUrl ?? null,
          lastTestStatus: (secret.lastExchangeStatus === "completed" ? "completed" : secret.lastExchangeStatus === "error" ? "error" : "pending"),
          lastTestError: secret.lastExchangeError ?? null,
          lastTestAt: secret.copilotTokenExpiresAt ?? null,
          oauthClientSource: secret.oauthClientSource,
          configuredClientId: secret.configuredClientId ?? null,
        },
      ];
    }),
  ) as Record<ProviderId, ProviderSummary>;
};

export const testProvider = async (providerId: ProviderId) => {
  const store = await loadProviderSecrets();
  const secret = store[providerId];
  if (!secret) throw new Error("PROVIDER_NOT_FOUND");

  let reachable = false;
  let usable = false;
  let errorMessage: string | null = null;

  try {
    if (providerId === "codex_cli") {
      await readCodexBearer(secret);
      reachable = true;
      usable = true;
    } else if (providerId === "github_copilot") {
      usable = Boolean(secret.copilotToken);
      reachable = Boolean(secret.githubToken || secret.configuredClientId || secret.copilotToken);
      if (!reachable) {
        throw new Error("COPILOT_AUTH_NOT_CONFIGURED");
      }
    } else if (!hasCredential(providerId, secret)) {
      throw new Error("PROVIDER_CREDENTIAL_MISSING");
    } else if (providerId === "gemini") {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${secret.apiKey}`);
      reachable = response.ok;
      usable = response.ok;
      if (!response.ok) throw new Error(`GEMINI_STATUS_${response.status}`);
    } else if (providerId === "claude") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": secret.apiKey ?? "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: secret.model || "claude-3-7-sonnet-latest",
          max_tokens: 16,
          messages: [{ role: "user", content: "ping" }],
        }),
      });
      reachable = response.ok;
      usable = response.ok;
      if (!response.ok) throw new Error(`CLAUDE_STATUS_${response.status}`);
    } else {
      const response = await fetch(`${(secret.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "")}/models`, {
        headers: {
          Authorization: `Bearer ${secret.apiKey ?? ""}`,
        },
      });
      reachable = response.ok;
      usable = response.ok;
      if (!response.ok) throw new Error(`PROVIDER_STATUS_${response.status}`);
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "PROVIDER_TEST_FAILED";
  }

  store[providerId] = {
    ...secret,
    lastExchangeStatus: usable ? "completed" : reachable ? "configured" : "error",
    lastExchangeError: errorMessage,
  };
  await saveProviderSecrets(store);
  return (await listProviderSummaries())[providerId];
};

export const saveProviderConfig = async (providerId: ProviderId, patch: ProviderSecretRecord) => {
  const store = await loadProviderSecrets();
  store[providerId] = {
    ...store[providerId],
    ...patch,
    lastExchangeStatus: patch.apiKey || patch.githubToken || patch.copilotToken || patch.enabled ? "configured" : store[providerId].lastExchangeStatus,
    lastExchangeError: null,
  };
  await saveProviderSecrets(store);
  return (await listProviderSummaries())[providerId];
};

const getPreferredProviders = (runtime: AiRuntimeSettings, explicitProviderId?: ProviderId): ProviderId[] => {
  if (explicitProviderId) return [explicitProviderId];
  if (runtime.strictProviderMode) return [runtime.defaultProvider];
  return [runtime.defaultProvider, ...runtime.fallbackProviders.filter((id) => id !== runtime.defaultProvider)];
};

export const generateArticleWithProviders = async (
  input: GenerationInput,
  runtime: AiRuntimeSettings,
  explicitProviderId?: ProviderId,
): Promise<GeneratedContent> => {
  const store = await loadProviderSecrets();
  const prompt = buildPrompt(input);
  const providerIds = getPreferredProviders(runtime, explicitProviderId);
  const failures: string[] = [];

  for (const providerId of providerIds) {
    const secret = store[providerId];
    if (!secret || !hasCredential(providerId, secret)) {
      failures.push(`${providerId}: credential missing`);
      continue;
    }

    try {
      const text = await providerRequest(providerId, secret, prompt);
      return normalizeGenerated(input, toJson<Omit<GeneratedContent, "generationMode">>(text), providerId);
    } catch (error) {
      failures.push(`${providerId}: ${error instanceof Error ? error.message : "request failed"}`);
      if (explicitProviderId || runtime.strictProviderMode) {
        break;
      }
    }
  }

  const fallback = buildFallbackContent(input);
  if (failures.length > 0) {
    fallback.references = [
      ...fallback.references,
      {
        title: "provider fallback",
        summary: failures.join(" | "),
        link: "#",
      },
    ];
  }
  return fallback;
};

export const regenerateAssetsWithProviders = async (
  source: {
    title: string;
    keyword: string;
    genre: string;
    freeContent: string;
    paidGuidance: string;
    paidContent: string;
    includeImages: boolean;
    includeGraphs: boolean;
  },
  runtime: AiRuntimeSettings,
  explicitProviderId?: ProviderId,
) => {
  const input: GenerationInput = {
    keyword: source.keyword,
    genre: source.genre,
    accountId: "",
    includeImages: source.includeImages,
    includeGraphs: source.includeGraphs,
    saleMode: source.paidContent.trim() ? "paid" : "free",
    price: null,
    action: "draft",
    instruction: `既存タイトル: ${source.title}\n無料部分: ${source.freeContent}\n有料導線: ${source.paidGuidance}\n有料部分: ${source.paidContent}`,
  };
  const generated = await generateArticleWithProviders(input, runtime, explicitProviderId);
  return {
    heroImagePrompt: generated.heroImagePrompt,
    heroImageCaption: generated.heroImageCaption,
    graphTitle: generated.graphTitle,
    graphUnit: generated.graphUnit,
    graphData: generated.graphData,
    generationMode: generated.generationMode,
  };
};

type DeviceFlowRecord = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  interval: number;
  expiresAt: number;
};

const pendingDeviceFlows = new Map<string, DeviceFlowRecord>();

const githubBuiltinClientId = process.env.GITHUB_COPILOT_BUILTIN_CLIENT_ID ?? "";

export const startCopilotDeviceFlow = async () => {
  const store = await loadProviderSecrets();
  const secret = store.github_copilot;
  const clientId = secret.configuredClientId || githubBuiltinClientId;
  const source = secret.configuredClientId ? "config" : githubBuiltinClientId ? "builtin" : "none";
  if (!clientId) {
    throw new Error("GITHUB_COPILOT_CLIENT_ID_MISSING");
  }
  const body = new URLSearchParams();
  body.set("client_id", clientId);
  body.set("scope", "read:user");

  const response = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`GITHUB_DEVICE_START_${response.status}`);
  }

  const data = (await response.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  };

  pendingDeviceFlows.set(data.device_code, {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    interval: data.interval,
    expiresAt: Date.now() + data.expires_in * 1000,
  });

  store.github_copilot = {
    ...secret,
    oauthClientSource: source,
    lastExchangeStatus: "configured",
    lastExchangeError: null,
  };
  await saveProviderSecrets(store);

  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    interval: data.interval,
    oauthClientSource: source,
  };
};

export const pollCopilotDeviceFlow = async (deviceCode: string) => {
  const flow = pendingDeviceFlows.get(deviceCode);
  if (!flow) throw new Error("GITHUB_DEVICE_FLOW_NOT_FOUND");
  if (flow.expiresAt < Date.now()) {
    pendingDeviceFlows.delete(deviceCode);
    throw new Error("GITHUB_DEVICE_FLOW_EXPIRED");
  }

  const store = await loadProviderSecrets();
  const secret = store.github_copilot;
  const clientId = secret.configuredClientId || githubBuiltinClientId;
  if (!clientId) throw new Error("GITHUB_COPILOT_CLIENT_ID_MISSING");

  const body = new URLSearchParams();
  body.set("client_id", clientId);
  body.set("device_code", deviceCode);
  body.set("grant_type", "urn:ietf:params:oauth:grant-type:device_code");

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (tokenData.error) {
    if (tokenData.error === "authorization_pending") {
      return { status: "pending" as const, detail: tokenData.error_description ?? "認証待ち" };
    }
    throw new Error(tokenData.error_description ?? tokenData.error);
  }

  const githubToken = tokenData.access_token;
  if (!githubToken) {
    throw new Error("GITHUB_TOKEN_MISSING");
  }

  // undocumented exchange は外形だけ残す。失敗内容は status に残す。
  let copilotToken: string | null = null;
  let exchangeStatus = "error";
  let exchangeError: string | null = null;
  try {
    const exchangeResponse = await fetch("https://api.githubcopilot.com/copilot_internal/v2/token", {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/json",
      },
    });
    if (!exchangeResponse.ok) {
      exchangeError = `COPILOT_TOKEN_EXCHANGE_${exchangeResponse.status}`;
    } else {
      const exchangeData = (await exchangeResponse.json()) as {
        token?: string;
        expires_at?: number;
      };
      copilotToken = exchangeData.token ?? null;
      exchangeStatus = copilotToken ? "completed" : "error";
      if (!copilotToken) {
        exchangeError = "COPILOT_TOKEN_EMPTY";
      }
      if (exchangeData.expires_at) {
        secret.copilotTokenExpiresAt = new Date(exchangeData.expires_at * 1000).toISOString();
      }
    }
  } catch (error) {
    exchangeError = error instanceof Error ? error.message : "COPILOT_TOKEN_EXCHANGE_FAILED";
  }

  store.github_copilot = {
    ...secret,
    githubToken,
    copilotToken,
    lastExchangeStatus: exchangeStatus,
    lastExchangeError: exchangeError,
  };
  await saveProviderSecrets(store);
  pendingDeviceFlows.delete(deviceCode);

  return {
    status: exchangeStatus === "completed" ? "completed" as const : "error" as const,
    githubTokenPresent: true,
    copilotTokenReady: Boolean(copilotToken),
    lastExchangeError: exchangeError,
  };
};

export const getCopilotStatus = async () => {
  const summaries = await listProviderSummaries();
  const store = await loadProviderSecrets();
  const secret = store.github_copilot;
  return {
    ...summaries.github_copilot,
    githubTokenPresent: Boolean(secret.githubToken),
    copilotTokenReady: Boolean(secret.copilotToken),
    oauthClientIdSource: secret.oauthClientSource ?? "none",
    configuredOauthClientId: secret.configuredClientId ?? null,
    lastExchangeStatus: secret.lastExchangeStatus ?? null,
    lastExchangeError: secret.lastExchangeError ?? null,
  };
};

export const disconnectCopilot = async () => {
  const store = await loadProviderSecrets();
  store.github_copilot = {
    ...store.github_copilot,
    githubToken: null,
    copilotToken: null,
    copilotTokenExpiresAt: null,
    lastExchangeStatus: "pending",
    lastExchangeError: null,
  };
  await saveProviderSecrets(store);
  return await getCopilotStatus();
};

export const getCodexCliStatus = async () => {
  const store = await loadProviderSecrets();
  const secret = store.codex_cli;
  try {
    const token = await readCodexBearer(secret);
    return {
      configured: true,
      reachable: true,
      usable: true,
      model: secret.model ?? "gpt-5-codex",
      authPath: secret.authPath ?? "C:\\Users\\i0swi\\.codex\\auth.json",
      tokenKind: token.startsWith("sk-") ? "api_key" : "session_token",
      lastTestStatus: "completed" as const,
      lastTestError: null,
    };
  } catch (error) {
    return {
      configured: false,
      reachable: false,
      usable: false,
      model: secret.model ?? "gpt-5-codex",
      authPath: secret.authPath ?? "C:\\Users\\i0swi\\.codex\\auth.json",
      tokenKind: null,
      lastTestStatus: "error" as const,
      lastTestError: error instanceof Error ? error.message : "CODEX_STATUS_FAILED",
    };
  }
};
