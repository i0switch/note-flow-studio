import { describe, expect, it } from "vitest";
import {
  buildPublishPayload,
  buildStructuredNoteContent,
  type SaveContext
} from "../../adapters/note-save-adapters.js";

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
