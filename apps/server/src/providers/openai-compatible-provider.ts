import { buildArticle, type BuiltArticle } from "../services/content-builder.js";
import type { AiProvider, ArticleGenerationRequest } from "./ai-provider.js";

const buildJapaneseArticlePrompt = (input: ArticleGenerationRequest): string =>
  [
    "あなたはnote向けの販売記事生成アシスタント。",
    `キーワード: ${input.keyword}`,
    `ジャンル: ${input.targetGenre ?? "auto"}`,
    `補足指示: ${input.additionalInstruction || "なし"}`,
    `販売モード: ${input.salesMode}`,
    `参考資料: ${input.referenceSummaries.join("\n") || "なし"}`,
    "JSON形式で title, genreLabel, leadText, freePreviewMarkdown, paidContentMarkdown, transitionCtaText, salesHookText, recommendedPriceYen, bodyMarkdown, noteRenderedBody を返す。",
  ].join("\n");

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
          messages: [{ role: "user", content: buildJapaneseArticlePrompt(input) }],
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
