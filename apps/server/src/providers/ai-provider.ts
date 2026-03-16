import { buildArticle, type BuiltArticle } from "../services/content-builder.js";

export type ArticleGenerationRequest = {
  keyword: string;
  targetGenre?: string | null;
  additionalInstruction: string;
  referenceSummaries: string[];
  monetizationEnabled: boolean;
  salesMode: "normal" | "free_paid";
  desiredPriceYen: number | null;
  systemPrompt?: string;
  userPromptTemplate?: string;
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
      getApiKey: () => string | undefined;
      model: string;
      mockMode: boolean;
    }
  ) {}

  async generateArticle(input: ArticleGenerationRequest) {
    const apiKey = this.options.getApiKey();
    if (this.options.mockMode || !apiKey) {
      return buildArticle(input);
    }

    const systemPrompt = input.systemPrompt ?? "あなたはnote向けの販売記事生成アシスタント。";
    const jsonInstruction =
      "JSON形式（コードブロック不要）で以下フィールドを返す: " +
      "title（記事タイトル）, genreLabel, leadText（冒頭リード1〜2文）, " +
      "freePreviewMarkdown（無料パート: 問題提起・共感・途中ヒント。読者が続きを読みたくなる内容）, " +
      "paidContentMarkdown（有料パート: 具体的ノウハウ・実践ステップ・テンプレ。salesModeがnormalなら空文字）, " +
      "transitionCtaText（無料→有料の誘導文）, salesHookText（購入フック文）, " +
      "recommendedPriceYen（推奨価格の数値）, " +
      "bodyMarkdown（freePreviewMarkdownとpaidContentMarkdownを結合した全文マークダウン）, " +
      "noteRenderedBody（bodyMarkdownと同じ値）";
    const userContent = [
      `キーワード: ${input.keyword}`,
      `ジャンル: ${input.targetGenre ?? "auto"}`,
      `補足指示: ${input.additionalInstruction || "なし"}`,
      `販売モード: ${input.salesMode}`,
      `参考資料: ${input.referenceSummaries.join("\n") || "なし"}`,
      ...(input.userPromptTemplate ? [input.userPromptTemplate] : []),
      jsonInstruction,
    ].join("\n");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.options.model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userContent }] }]
        })
      }
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "(読めなかった)");
      throw new Error(`Gemini API エラー HTTP ${response.status}: ${errorBody.slice(0, 300)}`);
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`Gemini API レスポンスに JSON が見つからない。先頭200文字: ${text.slice(0, 200)}`);
    }

    try {
      return { ...buildArticle(input), ...JSON.parse(match[0]) };
    } catch (e) {
      throw new Error(`Gemini API JSON パース失敗: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async healthCheck() {
    if (this.options.mockMode || !this.options.getApiKey()) {
      return { status: "warn" as const, detail: "Gemini APIキー未設定（モックモードで動作中）" };
    }

    return { status: "ok" as const, detail: `${this.options.model} を利用可能` };
  }
}
