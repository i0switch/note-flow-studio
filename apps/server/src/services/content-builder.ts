export type ContentBuildInput = {
  keyword: string;
  targetGenre?: string | null;
  additionalInstruction: string;
  referenceSummaries: string[];
  monetizationEnabled: boolean;
  salesMode: "normal" | "free_paid";
  desiredPriceYen: number | null;
};

export type BuiltArticle = {
  title: string;
  genreLabel: string;
  leadText: string;
  freePreviewMarkdown: string;
  paidContentMarkdown: string;
  transitionCtaText: string;
  salesHookText: string;
  recommendedPriceYen: number | null;
  bodyMarkdown: string;
  noteRenderedBody: string;
};

const inferGenre = (keyword: string, hint?: string | null) => {
  if (hint?.trim()) return hint;
  if (/売上|販売|集客|note|マーケ|ビジネス/i.test(keyword)) return "business";
  if (/投資|株|経済|金融/i.test(keyword)) return "finance";
  if (/AI|自動化|ツール|開発|Codex/i.test(keyword)) return "technology";
  return "general";
};

export const buildArticle = (input: ContentBuildInput): BuiltArticle => {
  const genreLabel = inferGenre(input.keyword, input.targetGenre);
  const references = input.referenceSummaries.length
    ? input.referenceSummaries.map((item, index) => `${index + 1}. ${item}`).join("\n")
    : "参考資料なし";
  const title = `${input.keyword}を最短で形にする実践ガイド`;
  const leadText = `${input.keyword}をテーマに、${genreLabel}向けの実践内容を整理した。`;
  const freePreviewMarkdown = [
    "## 先に全体像",
    `${input.keyword}で結果を出すには、最初に土台を固めてから仕組み化するのが近道。`,
    "### この記事でわかること",
    "- 何から着手するべきか",
    "- どこでつまずきやすいか",
    "- どこを自動化すると伸びやすいか"
  ].join("\n\n");
  const paidContentMarkdown = [
    "## 実装と運用の具体策",
    "- 手順をテンプレ化する",
    "- 失敗時の切り戻しを先に作る",
    "- 計測ポイントを先に定義する",
    input.additionalInstruction ? `### 補足指示の反映\n${input.additionalInstruction}` : "",
    `### 参考資料ベースの観点\n${references}`
  ]
    .filter(Boolean)
    .join("\n\n");
  const transitionCtaText =
    input.monetizationEnabled || input.salesMode === "free_paid"
      ? "ここから先で、実際に成果へつなげる具体的な設計、導線、運用ポイントをまとめている。"
      : "";
  const salesHookText =
    input.monetizationEnabled || input.salesMode === "free_paid"
      ? `${input.keyword}を放置すると、作業だけ増えて成果に繋がりにくい。`
      : "";
  const bodyMarkdown = [
    `# ${title}`,
    leadText,
    freePreviewMarkdown,
    transitionCtaText,
    paidContentMarkdown
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    title,
    genreLabel,
    leadText,
    freePreviewMarkdown,
    paidContentMarkdown,
    transitionCtaText,
    salesHookText,
    recommendedPriceYen: input.desiredPriceYen ?? (input.salesMode === "free_paid" ? 980 : null),
    bodyMarkdown,
    noteRenderedBody: bodyMarkdown
  };
};
