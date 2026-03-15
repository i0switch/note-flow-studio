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

export class ClaudeProvider implements AiProvider {
  readonly providerName = "claude";

  constructor(
    private readonly options: {
      apiKey: string;
      model: string;
    },
  ) {}

  async generateArticle(input: ArticleGenerationRequest): Promise<BuiltArticle> {
    if (!this.options.apiKey) {
      return buildArticle(input);
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": this.options.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.options.model,
          max_tokens: 4000,
          messages: [{ role: "user", content: buildJapaneseArticlePrompt(input) }],
        }),
      });

      if (!response.ok) {
        return buildArticle(input);
      }

      const data = (await response.json()) as {
        content?: { type: string; text?: string }[];
      };
      const text = data.content?.find((c) => c.type === "text")?.text ?? "";
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
      const response = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
          "x-api-key": this.options.apiKey,
          "anthropic-version": "2023-06-01",
        },
      });
      if (response.ok) {
        return { status: "ok", detail: `Claude (${this.options.model}) 接続OK` };
      }
      return { status: "warn", detail: `Claude 接続確認失敗: ${response.status}` };
    } catch {
      return { status: "error", detail: "Claude 接続エラー" };
    }
  }
}
