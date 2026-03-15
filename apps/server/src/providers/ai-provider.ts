import { buildArticle, type BuiltArticle } from "../services/content-builder.js";

export type ArticleGenerationRequest = {
  keyword: string;
  targetGenre?: string | null;
  additionalInstruction: string;
  referenceSummaries: string[];
  monetizationEnabled: boolean;
  salesMode: "normal" | "free_paid";
  desiredPriceYen: number | null;
};

export interface AiProvider {
  readonly providerName: string;
  generateArticle(input: ArticleGenerationRequest): Promise<BuiltArticle>;
  healthCheck(): Promise<{ status: "ok" | "warn" | "error"; detail: string }>;
}

export class GeminiProvider implements AiProvider {
  readonly providerName = "gemini";

  constructor(
    private readonly options: {
      apiKey?: string;
      model: string;
      mockMode: boolean;
    }
  ) {}

  async generateArticle(input: ArticleGenerationRequest) {
    if (this.options.mockMode || !this.options.apiKey) {
      return buildArticle(input);
    }

    const prompt = [
      "あなたはnote向けの販売記事生成アシスタント。",
      `キーワード: ${input.keyword}`,
      `ジャンル: ${input.targetGenre ?? "auto"}`,
      `補足指示: ${input.additionalInstruction || "なし"}`,
      `販売モード: ${input.salesMode}`,
      `参考資料: ${input.referenceSummaries.join("\n") || "なし"}`,
      "JSON形式で title, genreLabel, leadText, freePreviewMarkdown, paidContentMarkdown, transitionCtaText, salesHookText, recommendedPriceYen, bodyMarkdown, noteRenderedBody を返す。"
    ].join("\n");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.options.model}:generateContent?key=${this.options.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        })
      }
    );

    if (!response.ok) {
      return buildArticle(input);
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return buildArticle(input);
    }

    try {
      return { ...buildArticle(input), ...JSON.parse(match[0]) };
    } catch {
      return buildArticle(input);
    }
  }

  async healthCheck() {
    if (this.options.mockMode || !this.options.apiKey) {
      return { status: "warn" as const, detail: "モックモードで動作中" };
    }

    return { status: "ok" as const, detail: `${this.options.model} を利用可能` };
  }
}
