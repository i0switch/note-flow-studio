import { buildArticle, type BuiltArticle } from "../services/content-builder.js";
import type { AiProvider, ArticleGenerationRequest } from "./ai-provider.js";

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
  return { systemPrompt, userContent: parts.join("\n") };
};

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
      const { systemPrompt, userContent } = buildPromptMessages(input);
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
          system: systemPrompt,
          messages: [{ role: "user", content: userContent }],
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
