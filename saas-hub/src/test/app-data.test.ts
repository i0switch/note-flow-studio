import { describe, expect, it } from "vitest";
import {
  buildDiagnostics,
  createGeneratedArticle,
  createDefaultProviderSummaries,
  defaultAccounts,
  defaultSettings,
} from "@/lib/app-data";

describe("app-data helpers", () => {
  it("生成記事を action に応じた note 状態で返す", () => {
    const article = createGeneratedArticle({
      keyword: "AI副業",
      genre: "テクノロジー",
      accountId: "1",
      promptId: "1",
      saleMode: "paid",
      price: 980,
      instruction: "具体例を入れる",
      providerId: "claude",
      noteAction: "draft"
    });

    expect(article.noteStatus).toBe("running");
    expect(article.noteUrl).toBeNull();
    expect(article.providerId).toBe("claude");
    expect(article.timeline.some((item) => item.label === "note 下書き保存を開始")).toBe(true);
  });

  it("診断結果を設定状態に応じて返す", () => {
    const providerSummaries = createDefaultProviderSummaries();
    providerSummaries.gemini.usable = true;
    const diagnostics = buildDiagnostics(
      {
        ...defaultSettings,
        chromiumInstalled: true,
        providerSummaries,
      },
      [{ id: "1", name: "テストアカウント", priority: 1 }]
    );

    expect(diagnostics.find((item) => item.name === "既定 AI Provider")?.status).toBe("completed");
    expect(diagnostics.find((item) => item.name === "Playwright")?.status).toBe("completed");
    // 新実装: アカウント有り → "pending"（セッション取得促すステータス）
    expect(diagnostics.find((item) => item.name === "note ログイン")?.status).toBe("pending");
  });
});
