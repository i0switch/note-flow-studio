import { describe, expect, it } from "vitest";
import {
  buildPublishPayload,
  buildStructuredNoteContent,
  type SaveContext
} from "../../adapters/note-save-adapters.js";

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

describe("note-save-adapters helpers", () => {
  it("free_paid のとき無料部分と有料部分を分割して separator を作る", () => {
    const structured = buildStructuredNoteContent(baseContext);

    expect(structured.freeHtml).toContain("導入");
    expect(structured.paidHtml).toContain("ここから本編");
    expect(structured.separator).toBeTruthy();
    expect(structured.fullHtml).toContain(structured.freeHtml);
    expect(structured.fullHtml).toContain(structured.paidHtml);
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
});
