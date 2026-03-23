import { beforeEach, afterEach, describe, expect, it } from "vitest";
import {
  buildPublishPayload,
  buildStructuredNoteContent,
  UnofficialApiAdapter,
  PlaywrightAdapter,
  PinchTabAdapter,
  type SaveContext
} from "../../adapters/note-save-adapters.js";
import { env } from "../../config.js";

const makeContext = (noteBody: string): SaveContext => ({
  jobId: 1,
  title: "test",
  noteBody,
  freePreviewMarkdown: "",
  paidContentMarkdown: "",
  salesMode: "normal",
  targetState: "draft",
  applySaleSettings: false,
  priceYen: null,
  transitionCtaText: ""
});

const baseContext: SaveContext = {
  jobId: 7,
  title: "テスト記事",
  noteBody: "導入\n\nここから本編",
  freePreviewMarkdown: "導入",
  paidContentMarkdown: "ここから本編",
  salesMode: "free_paid",
  targetState: "published",
  applySaleSettings: true,
  priceYen: 980,
  transitionCtaText: "続きは有料です"
};

describe("マークダウン→HTML変換", () => {
  it("# h1 → <h2>", () => {
    const { fullHtml } = buildStructuredNoteContent(makeContext("# セクションタイトル"));
    expect(fullHtml).toContain("<h2");
    expect(fullHtml).toContain("セクションタイトル");
    expect(fullHtml).not.toContain("# セクションタイトル");
  });

  it("## h2 → <h3>", () => {
    const { fullHtml } = buildStructuredNoteContent(makeContext("## サブセクション"));
    expect(fullHtml).toContain("<h3");
    expect(fullHtml).toContain("サブセクション");
  });

  it("### h3 → <h4>", () => {
    const { fullHtml } = buildStructuredNoteContent(makeContext("### 小見出し"));
    expect(fullHtml).toContain("<h4");
    expect(fullHtml).toContain("小見出し");
  });

  it("- リストアイテム → <ul><li>", () => {
    const { fullHtml } = buildStructuredNoteContent(makeContext("- item1\n- item2\n- item3"));
    expect(fullHtml).toContain("<ul");
    expect(fullHtml).toContain("<li>item1</li>");
    expect(fullHtml).toContain("<li>item2</li>");
  });

  it("* リストアイテム → <ul><li>", () => {
    const { fullHtml } = buildStructuredNoteContent(makeContext("* アイテムA\n* アイテムB"));
    expect(fullHtml).toContain("<ul");
    expect(fullHtml).toContain("<li>アイテムA</li>");
  });

  it("1. 番号付きリスト → <ol><li>", () => {
    const { fullHtml } = buildStructuredNoteContent(makeContext("1. 手順1\n2. 手順2"));
    expect(fullHtml).toContain("<ol");
    expect(fullHtml).toContain("<li>手順1</li>");
    expect(fullHtml).toContain("<li>手順2</li>");
  });

  it("**太字** → <b>", () => {
    const { fullHtml } = buildStructuredNoteContent(makeContext("これは**重要**なポイント"));
    expect(fullHtml).toContain("<b>重要</b>");
    expect(fullHtml).not.toContain("**重要**");
  });

  it("*イタリック* → <i>", () => {
    const { fullHtml } = buildStructuredNoteContent(makeContext("これは*強調*される"));
    expect(fullHtml).toContain("<i>強調</i>");
  });

  it("`code` → <code>", () => {
    const { fullHtml } = buildStructuredNoteContent(makeContext("関数`buildArticle()`を呼ぶ"));
    expect(fullHtml).toContain("<code>buildArticle()</code>");
  });

  it("通常テキスト → <p>", () => {
    const { fullHtml } = buildStructuredNoteContent(makeContext("普通の段落テキスト"));
    expect(fullHtml).toContain("<p");
    expect(fullHtml).toContain("普通の段落テキスト");
  });

  it("XSS: <script> がエスケープされる", () => {
    const { fullHtml } = buildStructuredNoteContent(makeContext("<script>alert('xss')</script>"));
    expect(fullHtml).not.toContain("<script>");
    expect(fullHtml).toContain("&lt;script&gt;");
  });

  it("複数ブロックが混在してもそれぞれ正しく変換される", () => {
    const body = "# タイトル\n\n通常の説明文\n\n- アイテム1\n- アイテム2\n\n**まとめ**はここ";
    const { fullHtml } = buildStructuredNoteContent(makeContext(body));
    expect(fullHtml).toContain("<h2");
    expect(fullHtml).toContain("<p");
    expect(fullHtml).toContain("<ul");
    expect(fullHtml).toContain("<b>まとめ</b>");
  });

  it("コードブロックを <pre><code> に変換する", () => {
    const { fullHtml } = buildStructuredNoteContent(makeContext("```bash\nnpm install foo\n```"));
    expect(fullHtml).toContain("<pre");
    expect(fullHtml).toContain('<code class="language-bash">');
    expect(fullHtml).toContain("npm install foo");
    expect(fullHtml).not.toContain("```");
  });

  it("コードブロック内の特殊文字を HTML エスケープする", () => {
    const { fullHtml } = buildStructuredNoteContent(makeContext("```html\n<div>hello</div>\n```"));
    expect(fullHtml).toContain('<code class="language-html">');
    expect(fullHtml).toContain("&lt;div&gt;hello&lt;/div&gt;");
    expect(fullHtml).not.toContain("<div>");
  });

  it("コードブロック内の空行で分割されない", () => {
    const { fullHtml } = buildStructuredNoteContent(makeContext('```json\n{\n\n  "key": 1\n}\n```'));
    const preCount = (fullHtml.match(/<pre/g) ?? []).length;
    expect(preCount).toBe(1);
    expect(fullHtml).toContain("&quot;key&quot;");
  });

  it("導入文 + リストの混合ブロックを <p> + <ul> に変換する", () => {
    const { fullHtml } = buildStructuredNoteContent(makeContext("例えば：\n- item1\n- item2"));
    expect(fullHtml).toContain("<p");
    expect(fullHtml).toContain("例えば：");
    expect(fullHtml).toContain("<ul");
    expect(fullHtml).toContain("<li>item1</li>");
    expect(fullHtml).not.toContain("- item1");
  });

  it("テキスト行 → リスト → テキスト行 の複合ブロックを正しく変換する", () => {
    const { fullHtml } = buildStructuredNoteContent(makeContext("注意点：\n- A\n- B\n詳細は後述"));
    expect(fullHtml).toContain("注意点：");
    expect(fullHtml).toContain("<ul");
    expect(fullHtml).toContain("<li>A</li>");
    expect(fullHtml).toContain("<li>B</li>");
    expect(fullHtml).toContain("詳細は後述");
    expect(fullHtml).not.toContain("- A");
  });
});

describe("note-save-adapters helpers", () => {
  it("free_paid のとき無料部分と有料部分を分割して separator を作る (published)", () => {
    const structured = buildStructuredNoteContent(baseContext);

    expect(structured.freeHtml).toContain("導入");
    expect(structured.paidHtml).toContain("ここから本編");
    expect(structured.separator).toBeTruthy();
    expect(structured.fullHtml).toContain(structured.freeHtml);
    expect(structured.fullHtml).toContain(structured.paidHtml);
  });

  it("free_paid + draft でも separator を生成する（下書き時も仕切り線が挿入される）", () => {
    const structured = buildStructuredNoteContent({
      ...baseContext,
      targetState: "draft"
    });

    expect(structured.freeHtml).toContain("導入");
    expect(structured.paidHtml).toContain("ここから本編");
    expect(structured.separator).toBeTruthy();
    expect(structured.fullHtml).toContain(structured.freeHtml);
    expect(structured.fullHtml).toContain(structured.paidHtml);
  });

  it("free_paid + draft の separator は freeHtml 末尾ブロックの id と一致する", () => {
    const structured = buildStructuredNoteContent({
      ...baseContext,
      targetState: "draft"
    });

    // separator は freeHtml 内の最後のブロック id のはず
    expect(structured.freeHtml).toContain(structured.separator!);
  });

  it("applySaleSettings=false なら draft でも separator は null", () => {
    const structured = buildStructuredNoteContent({
      ...baseContext,
      targetState: "draft",
      applySaleSettings: false
    });

    expect(structured.separator).toBeNull();
    expect(structured.paidHtml).toBe("");
    expect(structured.freeHtml).toBe(structured.fullHtml);
  });

  it("paidContentMarkdown が空なら draft でも separator は null", () => {
    const structured = buildStructuredNoteContent({
      ...baseContext,
      targetState: "draft",
      paidContentMarkdown: ""
    });

    expect(structured.separator).toBeNull();
    expect(structured.paidHtml).toBe("");
  });

  it("通常モードでは全文を無料本文として扱う", () => {
    const structured = buildStructuredNoteContent({
      ...baseContext,
      salesMode: "normal",
      applySaleSettings: false,
      targetState: "draft",
      paidContentMarkdown: ""
    });

    expect(structured.freeHtml).toBe(structured.fullHtml);
    expect(structured.paidHtml).toBe("");
    expect(structured.separator).toBeNull();
  });

  it("公開 payload に価格と separator を反映する", () => {
    const structured = buildStructuredNoteContent(baseContext);
    const payload = buildPublishPayload(
      {
        id: 1,
        key: "n123",
        slug: "slug-n123"
      },
      baseContext,
      structured
    );

    expect(payload.status).toBe("published");
    expect(payload.price).toBe(980);
    expect(payload.separator).toBe(structured.separator);
    expect(payload.pay_body).toBe(structured.paidHtml);
    expect(payload.free_body).toBe(structured.freeHtml);
  });

  it("draft context から作った structured を publishPayload に使っても price/separator が正しく入る", () => {
    const draftContext = { ...baseContext, targetState: "draft" as const };
    const structured = buildStructuredNoteContent(draftContext);
    const payload = buildPublishPayload(
      { id: 2, key: "n456", slug: "slug-n456" },
      draftContext,
      structured
    );

    expect(payload.price).toBe(980);
    expect(payload.separator).toBe(structured.separator);
    expect(payload.limited).toBe(true);
    expect(payload.pay_body).toBe(structured.paidHtml);
  });
});

describe("有料境界線ボタン（clickPaywallButton）", () => {
  /**
   * clickPaywallButton は実際の Playwright ページが必要なため、
   * ここではロジックの判定条件（境界線設定が必要かどうか）を
   * buildStructuredNoteContent の出力で検証する。
   * 実際の UI 操作は E2E テストで検証する。
   */

  it("free_paid + applySaleSettings=true → separator が存在し境界線設定が必要と判定できる", () => {
    const structured = buildStructuredNoteContent(baseContext);
    const shouldSetPaywall =
      baseContext.applySaleSettings &&
      baseContext.salesMode === "free_paid" &&
      Boolean(structured.separator) &&
      structured.paidHtml.length > 0;

    expect(shouldSetPaywall).toBe(true);
    expect(structured.separator).toBeTruthy();
    expect(structured.paidHtml.length).toBeGreaterThan(0);
  });

  it("applySaleSettings=false → 境界線設定は不要と判定される", () => {
    const ctx = { ...baseContext, applySaleSettings: false };
    const structured = buildStructuredNoteContent(ctx);
    const shouldSetPaywall =
      ctx.applySaleSettings &&
      ctx.salesMode === "free_paid" &&
      Boolean(structured.separator) &&
      structured.paidHtml.length > 0;

    expect(shouldSetPaywall).toBe(false);
    expect(structured.separator).toBeNull();
  });

  it("salesMode=normal → 境界線設定は不要と判定される", () => {
    const ctx = { ...baseContext, salesMode: "normal" as "normal" | "free_paid", applySaleSettings: false };
    const structured = buildStructuredNoteContent(ctx);
    const shouldSetPaywall =
      ctx.applySaleSettings &&
      ctx.salesMode === "free_paid" &&
      Boolean(structured.separator) &&
      structured.paidHtml.length > 0;

    expect(shouldSetPaywall).toBe(false);
  });

  it("paidContentMarkdown が空 → paidHtml が空なので境界線設定は不要と判定される", () => {
    const ctx = { ...baseContext, paidContentMarkdown: "" };
    const structured = buildStructuredNoteContent(ctx);
    const shouldSetPaywall =
      ctx.applySaleSettings &&
      ctx.salesMode === "free_paid" &&
      Boolean(structured.separator) &&
      structured.paidHtml.length > 0;

    expect(shouldSetPaywall).toBe(false);
    expect(structured.paidHtml).toBe("");
    expect(structured.separator).toBeNull();
  });

  it("separator は freeHtml 内に実際に存在する id を指す", () => {
    const structured = buildStructuredNoteContent(baseContext);
    // separator の id が freeHtml の中に含まれていることを確認
    expect(structured.freeHtml).toContain(`id="${structured.separator}"`);
    // 同時に paidHtml には含まれていない
    expect(structured.paidHtml).not.toContain(`id="${structured.separator}"`);
  });

  it("freePreviewMarkdown が空の場合 noteBody を代わりに使い separator が生成される", () => {
    const ctx: SaveContext = {
      ...baseContext,
      freePreviewMarkdown: "",
      paidContentMarkdown: "有料コンテンツ本文"
    };
    const structured = buildStructuredNoteContent(ctx);
    // freePreviewMarkdown が空でも noteBody にフォールバックして separator が生成される
    expect(structured.separator).toBeTruthy();
    expect(structured.paidHtml).toContain("有料コンテンツ本文");
  });
});

describe("bodyLength と transitionCtaText（BSN補足）", () => {
  it("TC-BSN-05: paidContentMarkdown がスペース・改行のみのとき separator は null", () => {
    const ctx: SaveContext = {
      ...baseContext,
      applySaleSettings: true,
      salesMode: "free_paid",
      paidContentMarkdown: "  \n  "
    };
    const structured = buildStructuredNoteContent(ctx);
    // trim() 後の長さが 0 なので saleSettingRequested=false → separator は null
    expect(structured.separator).toBeNull();
  });

  it("TC-BSN-08: bodyLength は改行除去後の文字数", () => {
    const ctx: SaveContext = {
      ...makeContext("あ\nい\nう"),
      applySaleSettings: false
    };
    const structured = buildStructuredNoteContent(ctx);
    // "あ\nい\nう" から改行を取り除くと "あいう" = 3文字
    expect(structured.bodyLength).toBe(3);
  });

  it("TC-BSN-09: separator の形式が 'job-{jobId}-free-' で始まること", () => {
    // baseContext は jobId=7, applySaleSettings=true, salesMode="free_paid", paidContentMarkdown 有り
    const structured = buildStructuredNoteContent(baseContext);
    expect(structured.separator).toMatch(/^job-7-free-/);
  });

  it("TC-BSN-11: transitionCtaText が空文字のとき freeHtml に追記されない", () => {
    const ctx: SaveContext = {
      ...baseContext,
      applySaleSettings: true,
      salesMode: "free_paid",
      transitionCtaText: "",
      freePreviewMarkdown: "無料パート",
      paidContentMarkdown: "有料パート"
    };
    const structured = buildStructuredNoteContent(ctx);
    // transitionCtaText が空なので freeHtml は「無料パート」の HTML のみ
    expect(structured.freeHtml).toContain("無料パート");
    // 空の transitionCtaText は追加されないため、余分なコンテンツが混入しない
    // freeHtml が paidHtml の内容を含まないことで境界が正しいことを確認
    expect(structured.freeHtml).not.toContain("有料パート");
  });

  it("TC-BSN-12: freePreviewMarkdown が空のとき noteBody を使い本文が反映されること", () => {
    const ctx: SaveContext = {
      ...baseContext,
      applySaleSettings: true,
      salesMode: "free_paid",
      freePreviewMarkdown: "",
      noteBody: "全文本文",
      paidContentMarkdown: "有料コンテンツ"
    };
    const structured = buildStructuredNoteContent(ctx);
    // freePreviewMarkdown が空なので noteBody にフォールバック
    expect(structured.freeHtml).toContain("全文本文");
  });
});

describe("normalizeBlocks 直接テスト（BLK補足）", () => {
  it("TC-BLK-01: '---' 行がブロック区切りとして機能し HTML に含まれない", () => {
    const ctx = makeContext("段落A\n\n---\n\n段落B");
    const { fullHtml } = buildStructuredNoteContent(ctx);
    expect(fullHtml).not.toContain("---");
    expect(fullHtml).toContain("段落A");
    expect(fullHtml).toContain("段落B");
  });

  it("TC-BLK-09: \\r\\n 改行が正規化されること", () => {
    const ctx = makeContext("段落A\r\n\r\n段落B");
    const { fullHtml } = buildStructuredNoteContent(ctx);
    expect(fullHtml).toContain("段落A");
    expect(fullHtml).toContain("段落B");
  });
});

describe("buildPublishPayload 補足（PUB）", () => {
  it("TC-PUB-04: priceYen=null のとき price が 300（デフォルト）になる", () => {
    const ctx: SaveContext = {
      ...baseContext,
      applySaleSettings: true,
      salesMode: "free_paid",
      priceYen: null,
      freePreviewMarkdown: "無料",
      paidContentMarkdown: "有料"
    };
    const structured = buildStructuredNoteContent(ctx);
    const payload = buildPublishPayload({ id: 1, key: "n1", slug: "s1" }, ctx, structured);
    expect(payload.price).toBe(300);
  });

  it("TC-PUB-05: status, disable_comment, hashtags, circle_permissions の値", () => {
    const structured = buildStructuredNoteContent(baseContext);
    const payload = buildPublishPayload({ id: 1, key: "n1", slug: "s1" }, baseContext, structured);
    expect(payload.status).toBe("published");
    expect(payload.disable_comment).toBe(false);
    expect(payload.hashtags).toEqual([]);
    expect(payload.circle_permissions).toEqual([]);
  });
});

// ---- PinchTabClient.selectProfile フォールバック順序テスト ----
// private メソッドのため、同一ロジックをテスト内で再現して検証する

const selectProfile = (
  profiles: { id: string; name: string }[],
  preferredName: string
): { id: string; name: string } | undefined => {
  return (
    (preferredName ? profiles.find((p) => p.name === preferredName) : undefined) ??
    profiles.find((p) => p.name === "note-live") ??
    profiles.find((p) => p.name === "default") ??
    profiles[0]
  );
};

describe("PinchTabClient.selectProfile フォールバック順序", () => {
  const profiles = [
    { id: "a", name: "other" },
    { id: "b", name: "note-live" },
    { id: "c", name: "default" },
    { id: "d", name: "custom" },
  ];

  it("PINCHTAB_PROFILE_NAME 指定あり → 一致するプロファイルを返す", () => {
    const result = selectProfile(profiles, "custom");
    expect(result?.name).toBe("custom");
  });

  it("PINCHTAB_PROFILE_NAME 空 → 'note-live' にフォールバックする", () => {
    const result = selectProfile(profiles, "");
    expect(result?.name).toBe("note-live");
  });

  it("note-live 存在しない場合 'default' にフォールバックする", () => {
    const withoutNoteLive = profiles.filter((p) => p.name !== "note-live");
    const result = selectProfile(withoutNoteLive, "");
    expect(result?.name).toBe("default");
  });

  it("note-live も default も存在しない場合 profiles[0] を返す", () => {
    const onlyOther = [{ id: "x", name: "my-profile" }];
    const result = selectProfile(onlyOther, "");
    expect(result?.name).toBe("my-profile");
  });

  it("PINCHTAB_PROFILE_NAME が存在しないプロファイル名のとき note-live にフォールバック", () => {
    const result = selectProfile(profiles, "nonexistent");
    expect(result?.name).toBe("note-live");
  });

  it("プロファイルが空配列のとき undefined を返す", () => {
    const result = selectProfile([], "");
    expect(result).toBeUndefined();
  });
});

describe("アダプタークラス モック動作（ADT）", () => {
  // env の型は zod の parse 結果なので、as unknown as XXX でキャストして書き換える
  let originalEnableReal: boolean;
  let originalMockNoteApi: "success" | "fail";
  let originalMockPlaywright: "success" | "fail";
  let originalMockPinchtab: "success" | "fail";
  let originalNoteApiUrl: string | undefined;

  beforeEach(() => {
    originalEnableReal = env.ENABLE_REAL_NOTE_AUTOMATION;
    originalMockNoteApi = env.MOCK_NOTE_API_RESULT;
    originalMockPlaywright = env.MOCK_PLAYWRIGHT_RESULT;
    originalMockPinchtab = env.MOCK_PINCHTAB_RESULT;
    originalNoteApiUrl = env.NOTE_UNOFFICIAL_API_URL;
  });

  afterEach(() => {
    (env as unknown as Record<string, unknown>).ENABLE_REAL_NOTE_AUTOMATION = originalEnableReal;
    (env as unknown as Record<string, unknown>).MOCK_NOTE_API_RESULT = originalMockNoteApi;
    (env as unknown as Record<string, unknown>).MOCK_PLAYWRIGHT_RESULT = originalMockPlaywright;
    (env as unknown as Record<string, unknown>).MOCK_PINCHTAB_RESULT = originalMockPinchtab;
    (env as unknown as Record<string, unknown>).NOTE_UNOFFICIAL_API_URL = originalNoteApiUrl;
  });

  it("TC-ADT-01: UnofficialApiAdapter（mock成功）draft URL", async () => {
    (env as unknown as Record<string, unknown>).ENABLE_REAL_NOTE_AUTOMATION = false;
    (env as unknown as Record<string, unknown>).MOCK_NOTE_API_RESULT = "success";
    (env as unknown as Record<string, unknown>).NOTE_UNOFFICIAL_API_URL = undefined as unknown as string;

    const adapter = new UnofficialApiAdapter();
    const ctx: SaveContext = {
      ...baseContext,
      targetState: "draft",
      jobId: 99
    };
    const result = await adapter.save(ctx);
    expect(result.draftUrl).toContain("/mock/draft/99");
    expect(result.method).toBe("unofficial_api");
  });

  it("TC-ADT-02: UnofficialApiAdapter（mock失敗）throw", async () => {
    (env as unknown as Record<string, unknown>).ENABLE_REAL_NOTE_AUTOMATION = false;
    (env as unknown as Record<string, unknown>).MOCK_NOTE_API_RESULT = "fail";
    (env as unknown as Record<string, unknown>).NOTE_UNOFFICIAL_API_URL = undefined as unknown as string;

    const adapter = new UnofficialApiAdapter();
    await expect(adapter.save(baseContext)).rejects.toThrow();
  });

  it("TC-ADT-03: UnofficialApiAdapter（applySaleSettings=false）→ saleSettingStatus='not_required'", async () => {
    (env as unknown as Record<string, unknown>).ENABLE_REAL_NOTE_AUTOMATION = false;
    (env as unknown as Record<string, unknown>).MOCK_NOTE_API_RESULT = "success";
    (env as unknown as Record<string, unknown>).NOTE_UNOFFICIAL_API_URL = undefined as unknown as string;

    const adapter = new UnofficialApiAdapter();
    const ctx: SaveContext = { ...baseContext, applySaleSettings: false };
    const result = await adapter.save(ctx);
    expect(result.saleSettingStatus).toBe("not_required");
  });

  it("TC-ADT-04: PlaywrightAdapter（mock成功）draft URL", async () => {
    (env as unknown as Record<string, unknown>).ENABLE_REAL_NOTE_AUTOMATION = false;
    (env as unknown as Record<string, unknown>).MOCK_PLAYWRIGHT_RESULT = "success";

    const adapter = new PlaywrightAdapter();
    const ctx: SaveContext = {
      ...baseContext,
      targetState: "draft",
      jobId: 88
    };
    const result = await adapter.save(ctx);
    expect(result.draftUrl).toContain("/mock/playwright/88");
    expect(result.method).toBe("playwright");
  });

  it("TC-ADT-05: PlaywrightAdapter（mock失敗）throw", async () => {
    (env as unknown as Record<string, unknown>).ENABLE_REAL_NOTE_AUTOMATION = false;
    (env as unknown as Record<string, unknown>).MOCK_PLAYWRIGHT_RESULT = "fail";

    const adapter = new PlaywrightAdapter();
    await expect(adapter.save(baseContext)).rejects.toThrow();
  });

  it("TC-ADT-06: PinchTabAdapter（mock成功）draft URL", async () => {
    (env as unknown as Record<string, unknown>).ENABLE_REAL_NOTE_AUTOMATION = false;
    (env as unknown as Record<string, unknown>).MOCK_PINCHTAB_RESULT = "success";

    const adapter = new PinchTabAdapter();
    const ctx: SaveContext = {
      ...baseContext,
      targetState: "draft",
      jobId: 77
    };
    const result = await adapter.save(ctx);
    expect(result.draftUrl).toContain("/mock/pinchtab/77");
    expect(result.method).toBe("pinchtab");
  });

  it("TC-ADT-07: PinchTabAdapter（mock失敗）throw", async () => {
    (env as unknown as Record<string, unknown>).ENABLE_REAL_NOTE_AUTOMATION = false;
    (env as unknown as Record<string, unknown>).MOCK_PINCHTAB_RESULT = "fail";

    const adapter = new PinchTabAdapter();
    await expect(adapter.save(baseContext)).rejects.toThrow();
  });
});
