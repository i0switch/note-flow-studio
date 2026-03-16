import { describe, expect, it } from "vitest";
import { buildArticle } from "../../services/content-builder.js";

describe("buildArticle", () => {
  it("販売モードの記事を構造化して返す", () => {
    const result = buildArticle({
      keyword: "note販売",
      targetGenre: "business",
      additionalInstruction: "初心者向け",
      referenceSummaries: ["参考資料A"],
      monetizationEnabled: true,
      salesMode: "free_paid",
      desiredPriceYen: 980
    });

    expect(result.title).toContain("note販売");
    expect(result.genreLabel).toBe("business");
    expect(result.transitionCtaText.length).toBeGreaterThan(0);
    expect(result.recommendedPriceYen).toBe(980);
  });

  it("技術系キーワードからジャンルを自動推定する", () => {
    const result = buildArticle({
      keyword: "CodexとAI自動化",
      targetGenre: null,
      additionalInstruction: "",
      referenceSummaries: [],
      monetizationEnabled: false,
      salesMode: "normal",
      desiredPriceYen: null
    });

    expect(result.genreLabel).toBe("technology");
    expect(result.title).toContain("Codex");
  });

  it("通常モードでは有料導線を含めない", () => {
    const result = buildArticle({
      keyword: "日報テンプレート",
      targetGenre: "general",
      additionalInstruction: "",
      referenceSummaries: [],
      monetizationEnabled: false,
      salesMode: "normal",
      desiredPriceYen: null
    });

    expect(result.transitionCtaText).toBe("");
    expect(result.salesHookText).toBe("");
    expect(result.recommendedPriceYen).toBeNull();
  });

  // ---- ジャンル自動推定 ----

  it("金融系キーワードから finance ジャンルを推定する", () => {
    const result = buildArticle({
      keyword: "投資信託の始め方",
      targetGenre: null,
      additionalInstruction: "",
      referenceSummaries: [],
      monetizationEnabled: false,
      salesMode: "normal",
      desiredPriceYen: null
    });

    expect(result.genreLabel).toBe("finance");
  });

  it("ビジネス系キーワードから business ジャンルを推定する", () => {
    const result = buildArticle({
      keyword: "売上を3倍にする方法",
      targetGenre: null,
      additionalInstruction: "",
      referenceSummaries: [],
      monetizationEnabled: false,
      salesMode: "normal",
      desiredPriceYen: null
    });

    expect(result.genreLabel).toBe("business");
  });

  it("マッチしないキーワードは general にフォールバックする", () => {
    const result = buildArticle({
      keyword: "読書感想文の書き方",
      targetGenre: null,
      additionalInstruction: "",
      referenceSummaries: [],
      monetizationEnabled: false,
      salesMode: "normal",
      desiredPriceYen: null
    });

    expect(result.genreLabel).toBe("general");
  });

  it("targetGenre が指定されていればキーワードより優先される", () => {
    const result = buildArticle({
      keyword: "投資AI自動化ツール", // 金融・技術どちらにもマッチするが
      targetGenre: "lifestyle",      // 明示指定が優先
      additionalInstruction: "",
      referenceSummaries: [],
      monetizationEnabled: false,
      salesMode: "normal",
      desiredPriceYen: null
    });

    expect(result.genreLabel).toBe("lifestyle");
  });

  // ---- 参考資料 ----

  it("複数の referenceSummaries が paidContentMarkdown に含まれる", () => {
    const result = buildArticle({
      keyword: "コンテンツ販売",
      targetGenre: "business",
      additionalInstruction: "",
      referenceSummaries: ["要約1", "要約2", "要約3"],
      monetizationEnabled: true,
      salesMode: "free_paid",
      desiredPriceYen: 500
    });

    expect(result.paidContentMarkdown).toContain("1. 要約1");
    expect(result.paidContentMarkdown).toContain("2. 要約2");
    expect(result.paidContentMarkdown).toContain("3. 要約3");
  });

  it("referenceSummaries が空のとき参考資料なし と表示される", () => {
    const result = buildArticle({
      keyword: "テスト",
      targetGenre: null,
      additionalInstruction: "",
      referenceSummaries: [],
      monetizationEnabled: false,
      salesMode: "normal",
      desiredPriceYen: null
    });

    expect(result.paidContentMarkdown).toContain("参考資料なし");
  });

  // ---- 価格のデフォルト ----

  it("free_paid で desiredPriceYen=null のとき recommendedPriceYen が 980 になる", () => {
    const result = buildArticle({
      keyword: "有料note",
      targetGenre: null,
      additionalInstruction: "",
      referenceSummaries: [],
      monetizationEnabled: true,
      salesMode: "free_paid",
      desiredPriceYen: null
    });

    expect(result.recommendedPriceYen).toBe(980);
  });

  // ---- bodyMarkdown の構造 ----

  it("bodyMarkdown にタイトル・リード・コンテンツすべてが含まれる", () => {
    const result = buildArticle({
      keyword: "習慣化",
      targetGenre: "general",
      additionalInstruction: "毎日続ける方法",
      referenceSummaries: [],
      monetizationEnabled: false,
      salesMode: "normal",
      desiredPriceYen: null
    });

    expect(result.bodyMarkdown).toContain(result.title);
    expect(result.bodyMarkdown).toContain(result.leadText);
    expect(result.bodyMarkdown).toContain(result.freePreviewMarkdown);
    expect(result.bodyMarkdown).toContain("毎日続ける方法");
    expect(result.noteRenderedBody).toBe(result.bodyMarkdown);
  });

  // ---- transitionCtaText / salesHookText の OR 条件 ----

  it("monetizationEnabled=true の normal モードでも transitionCtaText・salesHookText が設定される", () => {
    const result = buildArticle({
      keyword: "note運用",
      targetGenre: "business",
      additionalInstruction: "",
      referenceSummaries: [],
      monetizationEnabled: true,
      salesMode: "normal",
      desiredPriceYen: null
    });

    expect(result.transitionCtaText.length).toBeGreaterThan(0);
    expect(result.salesHookText.length).toBeGreaterThan(0);
  });

  it("salesMode=free_paid のとき monetizationEnabled=false でも transitionCtaText・salesHookText が設定される", () => {
    const result = buildArticle({
      keyword: "コンテンツ販売戦略",
      targetGenre: null,
      additionalInstruction: "",
      referenceSummaries: [],
      monetizationEnabled: false,
      salesMode: "free_paid",
      desiredPriceYen: null
    });

    expect(result.transitionCtaText.length).toBeGreaterThan(0);
    expect(result.salesHookText.length).toBeGreaterThan(0);
  });

  // ---- additionalInstruction の有無 ----

  it("additionalInstruction が空のとき paidContentMarkdown に補足指示セクションを含まない", () => {
    const result = buildArticle({
      keyword: "業務改善",
      targetGenre: null,
      additionalInstruction: "",
      referenceSummaries: [],
      monetizationEnabled: false,
      salesMode: "normal",
      desiredPriceYen: null
    });

    expect(result.paidContentMarkdown).not.toContain("補足指示の反映");
  });

  it("additionalInstruction がある場合は paidContentMarkdown に補足指示セクションが含まれる", () => {
    const result = buildArticle({
      keyword: "業務改善",
      targetGenre: null,
      additionalInstruction: "週次レビューを挟むこと",
      referenceSummaries: [],
      monetizationEnabled: false,
      salesMode: "normal",
      desiredPriceYen: null
    });

    expect(result.paidContentMarkdown).toContain("補足指示の反映");
    expect(result.paidContentMarkdown).toContain("週次レビューを挟むこと");
  });

  // ---- desiredPriceYen の優先度 ----

  it("desiredPriceYen が設定されているとき salesMode=free_paid でもその値が優先される", () => {
    const result = buildArticle({
      keyword: "有料コンテンツ",
      targetGenre: null,
      additionalInstruction: "",
      referenceSummaries: [],
      monetizationEnabled: true,
      salesMode: "free_paid",
      desiredPriceYen: 500
    });

    expect(result.recommendedPriceYen).toBe(500);
  });

  it("salesMode=normal かつ desiredPriceYen=null のとき recommendedPriceYen が null になる", () => {
    const result = buildArticle({
      keyword: "無料記事",
      targetGenre: null,
      additionalInstruction: "",
      referenceSummaries: [],
      monetizationEnabled: false,
      salesMode: "normal",
      desiredPriceYen: null
    });

    expect(result.recommendedPriceYen).toBeNull();
  });
});
