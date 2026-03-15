import type { RuntimeSettings } from "./noteAutomation";

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
  generationMode: "gemini" | "fallback";
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
      ? [
          "## 実践ステップ",
          `1. ${input.keyword}で狙う成果を1つに絞る`,
          "2. 1週間で回せる小さな検証にする",
          "3. 数字で振り返って改善する",
        ].join("\n")
      : "無料公開モードのため、有料パートは使わずに最後まで読める構成にしている。";
  const body = [intro, freeContent, paidGuidance, paidContent, input.instruction].filter(Boolean).join("\n\n");

  return {
    title: `【${input.genre}向け】${input.keyword}を最短で形にする手順`,
    freeContent,
    paidGuidance,
    paidContent,
    body,
    references: [
      {
        title: `${input.keyword}の要点メモ`,
        summary: `${input.genre}の読者に必要な論点を整理した内部メモ。`,
        link: "#",
      },
    ],
    heroImagePrompt: input.includeImages
      ? `${input.keyword}を象徴する要素を1つ置き、${input.genre}の読者に信頼感が伝わるアイキャッチを作る。`
      : null,
    heroImageCaption: input.includeImages ? `${input.keyword}のアイキャッチ案` : null,
    graphTitle: input.includeGraphs ? `${input.keyword}の改善イメージ` : null,
    graphUnit: input.includeGraphs ? "スコア" : null,
    graphData: clampGraphPoints(undefined, input.includeGraphs),
    generationMode: "fallback",
  };
};

const callGemini = async (settings: RuntimeSettings, prompt: string) => {
  const model = settings.geminiModel || "gemini-2.0-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.geminiApiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.9,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`GEMINI_REQUEST_FAILED_${response.status}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("GEMINI_EMPTY_RESPONSE");
  }

  return text;
};

export const generateArticleContent = async (
  input: GenerationInput,
  settings: RuntimeSettings,
): Promise<GeneratedContent> => {
  if (!settings.geminiApiKey) {
    return buildFallbackContent(input);
  }

  const prompt = `
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

  try {
    const parsed = toJson<Omit<GeneratedContent, "generationMode">>(await callGemini(settings, prompt));
    return {
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
      generationMode: "gemini",
    };
  } catch {
    return buildFallbackContent(input);
  }
};

export const regenerateAssetContent = async (
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
  settings: RuntimeSettings,
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

  const generated = await generateArticleContent(input, settings);
  return {
    heroImagePrompt: generated.heroImagePrompt,
    heroImageCaption: generated.heroImageCaption,
    graphTitle: generated.graphTitle,
    graphUnit: generated.graphUnit,
    graphData: generated.graphData,
    generationMode: generated.generationMode,
  };
};
