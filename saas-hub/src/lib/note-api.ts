import type {
  AppDataState,
  AppSettings,
  ArticleRecord,
  DiagnosticsRecord,
  NoteMethod,
  ProviderId,
  ProviderSummary,
  SaleSettingStatus,
} from "@/lib/app-data";

type SaveNoteResponse = {
  method: NoteMethod;
  draftUrl: string;
  saleSettingStatus: SaleSettingStatus;
};

type DiagnosticsResponse = {
  diagnostics: DiagnosticsRecord[];
  providers: Record<ProviderId, ProviderSummary>;
  codexStatus: {
    configured: boolean;
    reachable: boolean;
    usable: boolean;
    model: string;
    authPath: string;
    tokenKind: "api_key" | "session_token" | null;
    lastTestStatus: "completed" | "error";
    lastTestError: string | null;
  };
  copilotStatus: ProviderSummary & {
    githubTokenPresent: boolean;
    copilotTokenReady: boolean;
    oauthClientIdSource: "builtin" | "config" | "none";
    configuredOauthClientId: string | null;
    lastExchangeStatus: string | null;
    lastExchangeError: string | null;
  };
};

export type DeviceFlowStartResponse = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  interval: number;
  oauthClientSource: "builtin" | "config" | "none";
};

export type DeviceFlowPollResponse = {
  status: "pending" | "completed" | "error";
  detail?: string;
  githubTokenPresent?: boolean;
  copilotTokenReady?: boolean;
  lastExchangeError?: string | null;
};

const readErrorMessage = async (response: Response) => {
  try {
    const data = (await response.json()) as {
      error?: {
        message?: string;
      };
    };
    return data.error?.message ?? `Request failed: ${response.status}`;
  } catch {
    return `Request failed: ${response.status}`;
  }
};

const requestJson = async <T>(input: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as T;
};

const buildPayload = (article: ArticleRecord, settings: AppSettings) => ({
  article: {
    id: article.id,
    title: article.title,
    keyword: article.keyword,
    genre: article.genre,
    freeContent: article.freeContent,
    paidGuidance: article.paidGuidance,
    paidContent: article.paidContent,
    body: article.body,
    saleMode: article.saleMode,
    price: article.price,
    providerId: article.providerId,
  },
  settings,
});

export const saveDraftToNote = (article: ArticleRecord, settings: AppSettings) =>
  requestJson<SaveNoteResponse>("/api/note/draft", {
    method: "POST",
    body: JSON.stringify(buildPayload(article, settings)),
  });

export const publishToNote = (article: ArticleRecord, settings: AppSettings) =>
  requestJson<SaveNoteResponse>("/api/note/publish", {
    method: "POST",
    body: JSON.stringify(buildPayload(article, settings)),
  });

export const runRemoteDiagnostics = (settings: AppSettings) =>
  requestJson<DiagnosticsResponse>("/api/diagnostics/run", {
    method: "POST",
    body: JSON.stringify({ settings }),
  });

export const installPlaywrightChromium = () =>
  requestJson<{ result: "success"; output: string }>("/api/playwright/install", {
    method: "POST",
    body: JSON.stringify({}),
  });

export const fetchRemoteState = () =>
  requestJson<{ state: AppDataState | null; providers: Record<ProviderId, ProviderSummary> }>("/api/state");

export const persistRemoteState = (state: AppDataState) =>
  requestJson<{ result: "success"; providers: Record<ProviderId, ProviderSummary> }>("/api/state", {
    method: "PUT",
    body: JSON.stringify({ state }),
  });

export const fetchAiProviders = () =>
  requestJson<{ providers: Record<ProviderId, ProviderSummary> }>("/api/ai/providers");

export const saveAiProvider = (
  providerId: ProviderId,
  patch: {
    apiKey?: string;
    model?: string;
    baseUrl?: string;
    authPath?: string;
    enabled?: boolean;
    configuredClientId?: string | null;
    workspace?: string | null;
  },
) =>
  requestJson<{ provider: ProviderSummary }>(`/api/ai/providers/${providerId}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });

export const testAiProvider = (providerId: ProviderId) =>
  requestJson<{ provider: ProviderSummary }>(`/api/ai/providers/${providerId}/test`, {
    method: "POST",
    body: JSON.stringify({}),
  });

export const fetchGitHubCopilotStatus = () =>
  requestJson<{
    status: ProviderSummary & {
      githubTokenPresent: boolean;
      copilotTokenReady: boolean;
      oauthClientIdSource: "builtin" | "config" | "none";
      configuredOauthClientId: string | null;
      lastExchangeStatus: string | null;
      lastExchangeError: string | null;
    };
  }>("/api/ai/providers/github-copilot/status");

export const startGitHubCopilotDeviceFlow = () =>
  requestJson<DeviceFlowStartResponse>("/api/ai/providers/github-copilot/device/start", {
    method: "POST",
    body: JSON.stringify({}),
  });

export const pollGitHubCopilotDeviceFlow = (deviceCode: string) =>
  requestJson<DeviceFlowPollResponse>("/api/ai/providers/github-copilot/device/poll", {
    method: "POST",
    body: JSON.stringify({ deviceCode }),
  });

export const disconnectGitHubCopilot = () =>
  requestJson<{
    status: ProviderSummary & {
      githubTokenPresent: boolean;
      copilotTokenReady: boolean;
      oauthClientIdSource: "builtin" | "config" | "none";
      configuredOauthClientId: string | null;
      lastExchangeStatus: string | null;
      lastExchangeError: string | null;
    };
  }>("/api/ai/providers/github-copilot/disconnect", {
    method: "POST",
    body: JSON.stringify({}),
  });

export const fetchCodexCliStatus = () =>
  requestJson<{
    status: {
      configured: boolean;
      reachable: boolean;
      usable: boolean;
      model: string;
      authPath: string;
      tokenKind: "api_key" | "session_token" | null;
      lastTestStatus: "completed" | "error";
      lastTestError: string | null;
    };
  }>("/api/ai/providers/codex-cli/status");

export const generateArticle = (
  input: {
    keyword: string;
    genre: string;
    accountId: string;
    promptId?: string;
    promptTitle?: string;
    promptContent?: string;
    saleMode: "free" | "paid";
    price: number | null;
    instruction?: string;
    scheduledAt?: string | null;
    action: "publish" | "draft" | "schedule";
    providerId?: ProviderId;
  },
  settings: AppSettings,
) =>
  requestJson<{
    article: Partial<ArticleRecord> & {
      generationMode?: ProviderId | "fallback";
    };
  }>("/api/generate-article", {
    method: "POST",
    body: JSON.stringify({ input, settings }),
  });

export const deleteArticle = (id: string) =>
  requestJson<{ result: "success" }>(`/api/articles/${id}`, { method: "DELETE" });

export const captureNoteSession = (accountId?: string) =>
  requestJson<{ success: boolean; message: string }>(
    accountId
      ? `/api/note-accounts/${accountId}/capture-session`
      : `/api/note-accounts/default/capture-session`,
    { method: "POST", body: JSON.stringify({}) },
  );

export const getNoteSessionStatus = (accountId: string) =>
  requestJson<{ hasSession: boolean }>(`/api/note-accounts/${accountId}/session-status`);

export const regenerateArticleAssets = (
  article: ArticleRecord,
  settings: AppSettings,
  providerId?: ProviderId,
) =>
  requestJson<{
    article: Partial<ArticleRecord> & {
      generationMode?: ProviderId | "fallback";
    };
  }>("/api/articles/regenerate-assets", {
    method: "POST",
    body: JSON.stringify({ article, settings, providerId }),
  });
