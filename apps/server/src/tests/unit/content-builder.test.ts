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
});
