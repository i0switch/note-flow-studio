import { buildArticle, type BuiltArticle } from "../services/content-builder.js";
import type { AiProvider, ArticleGenerationRequest } from "./ai-provider.js";
import type { SaasHubStateService } from "../services/saas-hub-state-service.js";

const BUILTIN_CLIENT_ID = "Iv1.b507a08c87ecfe98";
const DEVICE_FLOW_URL = "https://github.com/login/device/code";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const COPILOT_TOKEN_URL = "https://api.github.com/copilot_internal/v2/token";
const COPILOT_CHAT_URL = "https://api.githubcopilot.com/chat/completions";

type CopilotAuth = {
  githubToken: string;
  copilotToken: string;
  copilotTokenExpiresAt: string;
  oauthClientIdSource: "builtin" | "config" | "none";
  configuredOauthClientId: string | null;
  lastExchangeStatus: "success" | "error" | null;
  lastExchangeError: string | null;
};

export type DeviceFlowStart = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  interval: number;
  oauthClientSource: "builtin" | "config" | "none";
};

const JSON_INSTRUCTION =
  "JSON形式（コードブロック不要）で以下フィールドを返す: " +
  "title（記事タイトル）, genreLabel, leadText（冒頭リード1〜2文）, " +
  "freePreviewMarkdown（無料パート: 問題提起・共感・途中ヒント。読者が続きを読みたくなる内容）, " +
  "paidContentMarkdown（有料パート: 具体的ノウハウ・実践ステップ・テンプレ。salesModeがnormalなら空文字）, " +
  "transitionCtaText（無料→有料の誘導文）, salesHookText（購入フック文）, " +
  "recommendedPriceYen（推奨価格の数値）, " +
  "bodyMarkdown（freePreviewMarkdownとpaidContentMarkdownを結合した全文マークダウン）, " +
  "noteRenderedBody（bodyMarkdownと同じ値）。" +
  "【禁止】実在しない特典・ダウンロード・プレゼント・PDF・テンプレ配布・URLを記事内に書くこと。";

const buildPromptMessages = (input: ArticleGenerationRequest) => {
  const systemPrompt = input.systemPrompt ?? "あなたはnote向けの販売記事生成アシスタント。";
  const parts = [
    `キーワード: ${input.keyword}`,
    `ジャンル: ${input.targetGenre ?? "auto"}`,
    `補足指示: ${input.additionalInstruction || "なし"}`,
    `販売モード: ${input.salesMode}`,
    `参考資料: ${input.referenceSummaries.join("\n") || "なし"}`,
    ...(input.userPromptTemplate ? [input.userPromptTemplate] : []),
    JSON_INSTRUCTION,
  ];
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: parts.join("\n") },
  ];
};

const exchangeCopilotToken = async (githubToken: string): Promise<string | null> => {
  try {
    const response = await fetch(COPILOT_TOKEN_URL, {
      headers: {
        Authorization: `token ${githubToken}`,
        "Editor-Version": "vscode/1.90.0",
        "Editor-Plugin-Version": "copilot-chat/0.16.0",
        "User-Agent": "GitHubCopilotChat/0.16.0",
      },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { token?: string };
    return data.token ?? null;
  } catch {
    return null;
  }
};

const isTokenExpired = (expiresAt: string): boolean => {
  try {
    return new Date(expiresAt).getTime() < Date.now() + 60_000;
  } catch {
    return true;
  }
};

export class GitHubCopilotProvider implements AiProvider {
  readonly providerName = "github_copilot";

  constructor(
    private readonly options: {
      stateService: SaasHubStateService;
      model: string;
      configuredClientId?: string | null;
    },
  ) {}

  private async loadAuth(): Promise<CopilotAuth | null> {
    const state = await this.options.stateService.load();
    return (state?.githubCopilotAuth as CopilotAuth) ?? null;
  }

  private async saveAuth(auth: CopilotAuth): Promise<void> {
    const state = (await this.options.stateService.load()) ?? {};
    await this.options.stateService.save({ ...state, githubCopilotAuth: auth });
  }

  private async getValidCopilotToken(): Promise<string | null> {
    const auth = await this.loadAuth();
    if (!auth?.githubToken) return null;

    if (auth.copilotToken && !isTokenExpired(auth.copilotTokenExpiresAt)) {
      return auth.copilotToken;
    }

    // Re-exchange
    const newToken = await exchangeCopilotToken(auth.githubToken);
    if (!newToken) return null;

    await this.saveAuth({
      ...auth,
      copilotToken: newToken,
      copilotTokenExpiresAt: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
      lastExchangeStatus: "success",
      lastExchangeError: null,
    });
    return newToken;
  }

  async startDeviceFlow(): Promise<DeviceFlowStart> {
    const clientId = this.options.configuredClientId ?? BUILTIN_CLIENT_ID;
    const oauthClientSource = this.options.configuredClientId ? "config" : "builtin";

    const params = new URLSearchParams({
      client_id: clientId,
      scope: "read:user",
    });

    const response = await fetch(DEVICE_FLOW_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`DEVICE_FLOW_START_FAILED_${response.status}`);
    }

    const data = (await response.json()) as {
      device_code?: string;
      user_code?: string;
      verification_uri?: string;
      interval?: number;
    };

    if (!data.device_code || !data.user_code || !data.verification_uri) {
      throw new Error("DEVICE_FLOW_RESPONSE_INVALID");
    }

    return {
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      interval: data.interval ?? 5,
      oauthClientSource,
    };
  }

  async pollDeviceFlow(deviceCode: string): Promise<{ status: "pending" | "completed" | "error"; detail?: string }> {
    const clientId = this.options.configuredClientId ?? BUILTIN_CLIENT_ID;

    const params = new URLSearchParams({
      client_id: clientId,
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    });

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = (await response.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (data.access_token) {
      const githubToken = data.access_token;
      const copilotToken = await exchangeCopilotToken(githubToken);
      const auth: CopilotAuth = {
        githubToken,
        copilotToken: copilotToken ?? "",
        copilotTokenExpiresAt: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
        oauthClientIdSource: this.options.configuredClientId ? "config" : "builtin",
        configuredOauthClientId: this.options.configuredClientId ?? null,
        lastExchangeStatus: copilotToken ? "success" : "error",
        lastExchangeError: copilotToken ? null : "Copilotトークン交換に失敗",
      };
      await this.saveAuth(auth);
      return { status: "completed" };
    }

    if (data.error === "authorization_pending" || data.error === "slow_down") {
      return { status: "pending", detail: data.error_description ?? "認証待ち" };
    }

    return { status: "error", detail: data.error_description ?? data.error ?? "不明なエラー" };
  }

  async disconnect(): Promise<void> {
    const state = (await this.options.stateService.load()) ?? {};
    const { githubCopilotAuth: _removed, ...rest } = state as Record<string, unknown>;
    await this.options.stateService.save(rest);
  }

  async generateArticle(input: ArticleGenerationRequest): Promise<BuiltArticle> {
    const copilotToken = await this.getValidCopilotToken();
    if (!copilotToken) {
      return buildArticle(input);
    }

    try {
      const response = await fetch(COPILOT_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${copilotToken}`,
          "Content-Type": "application/json",
          "Editor-Version": "vscode/1.90.0",
          "Copilot-Integration-Id": "vscode-chat",
        },
        body: JSON.stringify({
          model: this.options.model,
          messages: buildPromptMessages(input),
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        return buildArticle(input);
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = data.choices?.[0]?.message?.content ?? "";
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return buildArticle(input);

      try {
        return { ...buildArticle(input), ...(JSON.parse(match[0]) as Partial<BuiltArticle>) };
      } catch {
        return buildArticle(input);
      }
    } catch {
      return buildArticle(input);
    }
  }

  async healthCheck(): Promise<{ status: "ok" | "warn" | "error"; detail: string }> {
    const auth = await this.loadAuth();
    if (!auth?.githubToken) {
      return { status: "warn", detail: "GitHub認証未完了" };
    }
    if (auth.copilotToken && !isTokenExpired(auth.copilotTokenExpiresAt)) {
      return { status: "ok", detail: `GitHub Copilot トークン有効` };
    }
    const newToken = await exchangeCopilotToken(auth.githubToken);
    if (newToken) {
      return { status: "ok", detail: "GitHub Copilot トークン再取得成功" };
    }
    return { status: "error", detail: "Copilotトークン取得失敗" };
  }
}
