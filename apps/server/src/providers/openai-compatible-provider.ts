import { buildArticle, type BuiltArticle } from "../services/content-builder.js";
import type { AiProvider, ArticleGenerationRequest } from "./ai-provider.js";

const JSON_INSTRUCTION =
  "JSON形式（コードブロック不要）で以下フィールドを返す: " +
  "title（記事タイトル）, genreLabel, leadText（冒頭リード1〜2文）, " +
  "freePreviewMarkdown（無料パート: 問題提起・共感・途中ヒント。読者が続きを読みたくなる内容）, " +
  "paidContentMarkdown（有料パート: 具体的ノウハウ・実践ステップ・テンプレ・実例・コード例など。salesModeがnormalなら空文字。有料パートは最低でも2500文字以上の充実した内容で書くこと）, " +
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

export class OpenAICompatibleProvider implements AiProvider {
  readonly providerName: string;

  constructor(
    private readonly options: {
      providerName: string;
      apiKey: string;
      model: string;
      baseUrl: string;
    },
  ) {
    this.providerName = options.providerName;
  }

  async generateArticle(input: ArticleGenerationRequest): Promise<BuiltArticle> {
    if (!this.options.apiKey) {
      return buildArticle(input);
    }

    try {
      const response = await fetch(`${this.options.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.options.model,
          messages: buildPromptMessages(input),
          max_tokens: 32000,
          // Qwen3 などの thinking モデルでは思考を無効化して速度優先
          enable_thinking: false,
        }),
        signal: AbortSignal.timeout(300_000),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "(読めなかった)");
        throw new Error(`${this.options.providerName} API エラー HTTP ${response.status}: ${errorBody.slice(0, 300)}`);
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string }; finish_reason?: string }[];
      };
      const choice = data.choices?.[0];
      const text = choice?.message?.content ?? "";
      const finishReason = choice?.finish_reason ?? "unknown";
      if (finishReason === "length") {
        throw new Error(`${this.options.providerName} API レスポンスがトークン上限で途中切断されました (finish_reason=length)。max_tokensを増やしてください。`);
      }
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error(`${this.options.providerName} API レスポンスに JSON が見つからない。finish_reason=${finishReason} 先頭200文字: ${text.slice(0, 200)}`);
      }

      try {
        // 制御文字（タブ・改行以外）を除去してパース失敗を防ぐ
        const sanitized = match[0].replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
        return { ...buildArticle(input), ...(JSON.parse(sanitized) as Partial<BuiltArticle>) };
      } catch (e) {
        throw new Error(`${this.options.providerName} API JSON パース失敗: ${e instanceof Error ? e.message : String(e)}`);
      }
    } catch (e) {
      throw e instanceof Error ? e : new Error(`${this.options.providerName} 生成エラー: ${String(e)}`);
    }
  }

  async healthCheck(): Promise<{ status: "ok" | "warn" | "error"; detail: string }> {
    if (!this.options.apiKey) {
      return { status: "warn", detail: "APIキー未設定" };
    }
    try {
      // First try GET /models (lightweight)
      const modelsRes = await fetch(`${this.options.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.options.apiKey}` },
      });
      if (modelsRes.ok) {
        return { status: "ok", detail: `${this.options.providerName} (${this.options.model}) 接続OK` };
      }
      // 401/403 = definitely wrong key
      if (modelsRes.status === 401 || modelsRes.status === 403) {
        return { status: "error", detail: `${this.options.providerName} 認証失敗 (HTTP ${modelsRes.status}) — APIキーを確認してください` };
      }
      // /models が実装されていないプロバイダー向け: minimal chat completion で確認
      const chatRes = await fetch(`${this.options.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.options.model,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 1,
        }),
      });
      if (chatRes.ok || chatRes.status === 400) {
        // 400 = リクエスト形式エラーだがAPIキー自体は有効
        return { status: "ok", detail: `${this.options.providerName} (${this.options.model}) 接続OK` };
      }
      if (chatRes.status === 401 || chatRes.status === 403) {
        return { status: "error", detail: `${this.options.providerName} 認証失敗 (HTTP ${chatRes.status}) — APIキーを確認してください` };
      }
      return { status: "warn", detail: `${this.options.providerName} 接続確認失敗: HTTP ${chatRes.status}` };
    } catch {
      return { status: "error", detail: `${this.options.providerName} 接続エラー` };
    }
  }
}
