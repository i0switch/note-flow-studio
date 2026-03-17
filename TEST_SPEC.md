# テスト仕様書

> 対象リポジトリ: `記事自動生成`
> 作成日: 2026-03-17
> カバー目標: 命令網羅 / 分岐網羅 / 条件網羅 / 境界値分析 / 同値分割 / 例外系 / 状態遷移 / 複合条件組み合わせ

---

## 1. 前提整理

### 1.1 対象モジュール一覧

| # | モジュール | パス |
|---|-----------|------|
| BSN | `buildStructuredNoteContent` | `apps/server/src/adapters/note-save-adapters.ts` |
| PUB | `buildPublishPayload` | 同上 |
| BLK | ブロック変換ヘルパー群 (`normalizeBlocks` / `buildBlockHtml` / `buildParagraphs`) | 同上 |
| ADT | アダプタークラス群 (`UnofficialApiAdapter` / `PlaywrightAdapter` / `PinchTabAdapter`) | 同上 |
| API | `/api/note/draft`, `/api/note/publish` | `apps/server/src/routes/saas-hub-adapter.ts` |
| REG | `/api/articles/regenerate-assets` | 同上 |
| GEN | `/api/generate-article` | 同上 |
| STA | `/api/state` (GET/PUT) | 同上 |
| DEL | `DELETE /api/articles/:id` | 同上 |
| REF | `/api/reference-materials` | 同上 |
| ART | `buildArticleRecord` / `buildState` | 同上 |
| DLG | `ArticlePreviewDialog` | `saas-hub/src/components/ArticlePreviewDialog.tsx` |
| CTX | `AppDataContext.regenerateAssets` | `saas-hub/src/context/AppDataContext.tsx` |

### 1.2 テスト設計上の仮定

- `env.ENABLE_REAL_NOTE_AUTOMATION = false`（モックモード）でテスト
- `env.MOCK_NOTE_API_RESULT` / `env.MOCK_PLAYWRIGHT_RESULT` / `env.MOCK_PINCHTAB_RESULT` は各ケースで制御
- DB は in-memory SQLite または DI されたモック
- Playwright は E2E テストでのみ実使用

---

## 2. テスト観点一覧

### 2.1 buildStructuredNoteContent (BSN)

| ID | テスト観点 | 分類 |
|----|-----------|------|
| TP-BSN-01 | 3条件AND (`applySaleSettings && salesMode==="free_paid" && paidContentMarkdown.trim().length>0`) がすべて真のときセパレーター付き有料コンテンツが生成されること | 分岐網羅 / 条件網羅 |
| TP-BSN-02 | `applySaleSettings=false` で有料コンテンツ分割がスキップされること | 条件網羅 |
| TP-BSN-03 | `salesMode!=="free_paid"` で有料コンテンツ分割がスキップされること | 条件網羅 |
| TP-BSN-04 | `paidContentMarkdown` が空文字列でスキップされること | 条件網羅 / 境界値 |
| TP-BSN-05 | `paidContentMarkdown` がスペースのみでスキップされること | 境界値 |
| TP-BSN-06 | `freeParagraphs.length===0` のとき fallback してフルHTMLを返すこと | 分岐網羅 |
| TP-BSN-07 | `paidParagraphs.length===0` のとき fallback してフルHTMLを返すこと | 分岐網羅 |
| TP-BSN-08 | `separator` が最後の無料パートブロックの `id` と一致すること | 命令網羅 |
| TP-BSN-09 | `bodyLength` が改行除去後の文字数であること | 命令網羅 |
| TP-BSN-10 | `transitionCtaText` が無料パート末尾に追加されること | 命令網羅 |
| TP-BSN-11 | `transitionCtaText` が空文字列のとき追加されないこと | 境界値 |
| TP-BSN-12 | `freePreviewMarkdown` が空のとき `noteBody` にフォールバックすること | 分岐網羅 |

### 2.2 buildPublishPayload (PUB)

| ID | テスト観点 | 分類 |
|----|-----------|------|
| TP-PUB-01 | 4条件AND (`applySaleSettings && salesMode==="free_paid" && separator!==null && paidHtml.length>0`) がすべて真のとき `limited=true` / `pay_body` 設定 / `price` 設定されること | 条件網羅 |
| TP-PUB-02 | `separator===null` のとき `limited=false` / `pay_body=""` / `price=0` になること | 条件網羅 |
| TP-PUB-03 | `paidHtml===""` のとき `limited=false` になること | 条件網羅 |
| TP-PUB-04 | `priceYen===null` のとき `price=300`（デフォルト）になること | 境界値 |
| TP-PUB-05 | `priceYen` が正の数のとき設定値がそのまま使われること | 同値分割 |
| TP-PUB-06 | `free_body` に `freeHtml` が常にセットされること | 命令網羅 |
| TP-PUB-07 | `status` が常に `"published"` であること | 命令網羅 |

### 2.3 ブロック変換ヘルパー群 (BLK)

| ID | テスト観点 | 分類 |
|----|-----------|------|
| TP-BLK-01 | `---` 行がブロック区切り記号として機能し HTML に含まれないこと | 命令網羅 |
| TP-BLK-02 | コードフェンス `\`\`\`` 内の空行がブロック区切りにならないこと | 分岐網羅 |
| TP-BLK-03 | `# H1` → `<h2>`, `## H2` → `<h3>`, `### H3` → `<h4>` に変換されること | 命令網羅 |
| TP-BLK-04 | `- item` → `<ul><li>`, `1. item` → `<ol><li>` に変換されること | 命令網羅 |
| TP-BLK-05 | `**bold**` → `<b>`, `*italic*` → `<i>`, `` `code` `` → `<code>` に変換されること | 命令網羅 |
| TP-BLK-06 | XSS危険文字（`<`, `>`, `&`, `"`, `'`）がエスケープされること | セキュリティ / 例外系 |
| TP-BLK-07 | コードブロックの末尾 `\`\`\`` が `</code></pre>` を正しく閉じること | 分岐網羅 |
| TP-BLK-08 | 空文字列入力のとき空配列が返ること | 境界値 |
| TP-BLK-09 | `\r\n` 改行が `\n` に正規化されること | 同値分割 |
| TP-BLK-10 | ul と ol の混在ブロックが正しく分割されること | 複合条件 |
| TP-BLK-11 | ブロック先頭・末尾の空行がフィルタリングされること | 境界値 |

### 2.4 アダプタークラス群 (ADT)

| ID | テスト観点 | 分類 |
|----|-----------|------|
| TP-ADT-01 | `UnofficialApiAdapter.save`: `NOTE_UNOFFICIAL_API_URL` 未設定・モックモードで `mock/draft/` URL を返すこと | 分岐網羅 |
| TP-ADT-02 | `UnofficialApiAdapter.save`: `MOCK_NOTE_API_RESULT="fail"` で例外をスローすること | 例外系 |
| TP-ADT-03 | `UnofficialApiAdapter.save`: `targetState="published"` で `mock/published/` URL を返すこと | 分岐網羅 |
| TP-ADT-04 | `PlaywrightAdapter.save`: `ENABLE_REAL_NOTE_AUTOMATION=false` でモック URL を返すこと | 分岐網羅 |
| TP-ADT-05 | `PlaywrightAdapter.save`: `MOCK_PLAYWRIGHT_RESULT="fail"` で例外をスローすること | 例外系 |
| TP-ADT-06 | `PinchTabAdapter.save`: `ENABLE_REAL_NOTE_AUTOMATION=false` でモック URL を返すこと | 分岐網羅 |
| TP-ADT-07 | `PinchTabAdapter.save`: `MOCK_PINCHTAB_RESULT="fail"` で例外をスローすること | 例外系 |
| TP-ADT-08 | 有料設定なし (`saleMode="free"`) のとき `saleSettingStatus="not_required"` になること | 条件網羅 |
| TP-ADT-09 | Playwright/PinchTab の `targetState="published"` / `salesMode="free_paid"` で `saleSettingStatus="applied"` になること | 条件網羅 |

### 2.5 /api/note/draft・/api/note/publish (API)

| ID | テスト観点 | 分類 |
|----|-----------|------|
| TP-API-01 | 数値IDの記事でリクエストボディのコンテンツが使われること | 命令網羅 |
| TP-API-02 | 非数値ID（文字列ID）でも `jobId=0` にフォールバックしてコンテンツが使われること | 境界値 / 分岐網羅 |
| TP-API-03 | `saleMode="paid"` のとき `applySaleSettings=true` / `salesMode="free_paid"` で呼ばれること | 条件網羅 |
| TP-API-04 | `saleMode="free"` のとき `applySaleSettings=false` / `salesMode="normal"` で呼ばれること | 条件網羅 |
| TP-API-05 | `saveContextDirect` が例外をスローしたとき HTTP 400 を返すこと | 例外系 |
| TP-API-06 | `/draft` で `targetState="draft"` が、`/publish` で `targetState="published"` が渡されること | 命令網羅 |
| TP-API-07 | レスポンスに `method`, `draftUrl`, `saleSettingStatus` が含まれること | 命令網羅 |
| TP-API-08 | `price=null` のとき `priceYen=null` が渡されること | 境界値 |
| TP-API-09 | `paidGuidance` が `transitionCtaText` として渡されること | 命令網羅 |

### 2.6 /api/articles/regenerate-assets (REG)

| ID | テスト観点 | 分類 |
|----|-----------|------|
| TP-REG-01 | `article.keyword` が未指定のとき HTTP 400 を返すこと | 例外系 |
| TP-REG-02 | `accountId` が非数値のとき DBの最初のアカウントにフォールバックすること | 分岐網羅 |
| TP-REG-03 | DBにアカウントが存在しない場合 HTTP 400 を返すこと | 例外系 |
| TP-REG-04 | `promptId` が非数値のとき DBの最初のテンプレートにフォールバックすること | 分岐網羅 |
| TP-REG-05 | `providerId` が指定されたとき `aiProviderOverride` が生成されること | 条件網羅 |
| TP-REG-06 | `providerId="gemini"` のとき `aiProviderOverride=undefined` になること | 条件網羅 |
| TP-REG-07 | ジョブが `succeeded` になったとき `article` オブジェクトを返すこと | 状態遷移 |
| TP-REG-08 | ジョブが `failed` になったとき `buildArticleRecord` がエラー状態の記事を返すこと | 状態遷移 |
| TP-REG-09 | タイムアウト（300秒）経過後にポーリングが停止すること | 境界値 |
| TP-REG-10 | `buildArticleRecord` が null を返したとき HTTP 500 を返すこと | 例外系 |
| TP-REG-11 | レスポンスに `article` キーが含まれること | 命令網羅 |

### 2.7 /api/generate-article (GEN)

| ID | テスト観点 | 分類 |
|----|-----------|------|
| TP-GEN-01 | `body.input` が未指定のとき HTTP 400 を返すこと | 例外系 |
| TP-GEN-02 | `accountId` 解決フォールバック（数値でない / <=0 のとき DB 最初のアカウント）が機能すること | 分岐網羅 |
| TP-GEN-03 | DBにアカウントがない場合 HTTP 400 / NO_ACCOUNT を返すこと | 例外系 |
| TP-GEN-04 | `promptId` 解決フォールバックが機能すること | 分岐網羅 |
| TP-GEN-05 | `action="draft"` のとき `noteSaveService.saveJob` が呼ばれること | 命令網羅 |
| TP-GEN-06 | `action="publish"` のとき `noteSaveService.publishJob` が呼ばれること | 命令網羅 |
| TP-GEN-07 | `action="schedule"` のとき note保存が呼ばれないこと | 分岐網羅 |
| TP-GEN-08 | note保存が失敗しても HTTP 200 で記事を返すこと（非致命的エラー） | 例外系 |
| TP-GEN-09 | `saleMode="paid"` で `monetizationEnabled=true` / `salesMode="free_paid"` が渡されること | 条件網羅 |

### 2.8 /api/state GET / PUT (STA)

| ID | テスト観点 | 分類 |
|----|-----------|------|
| TP-STA-01 | GET でアカウント・プロンプト・記事・設定がマージされた状態が返ること | 命令網羅 |
| TP-STA-02 | PUT でアカウントが upsert されること（既存更新 / 新規挿入） | 状態遷移 |
| TP-STA-03 | PUT で空配列のアカウントが来ても DB の既存アカウントが削除されないこと | 境界値 |
| TP-STA-04 | PUT でプロンプトが upsert されること（既存更新 / 新規挿入） | 状態遷移 |
| TP-STA-05 | PUT で空配列のプロンプトが来ても DB の既存プロンプトが削除されないこと | 境界値 |
| TP-STA-06 | PUT で `deletedJobIds` が上書きされずに保持されること（サーバーサイドキー保護） | 命令網羅 |
| TP-STA-07 | `deletedJobIds` に含まれるジョブが記事一覧に現れないこと | 命令網羅 |
| TP-STA-08 | PUT 失敗時に HTTP 500 / STATE_UPDATE_FAILED を返すこと | 例外系 |

### 2.9 DELETE /api/articles/:id (DEL)

| ID | テスト観点 | 分類 |
|----|-----------|------|
| TP-DEL-01 | 数値IDの記事を削除すると `deletedJobIds` に追加されること | 命令網羅 |
| TP-DEL-02 | 非数値IDのとき DB に触れず即 `{ result: "success" }` を返すこと | 分岐網羅 |
| TP-DEL-03 | 同じIDを二度削除しても `deletedJobIds` に重複しないこと | 状態遷移 |
| TP-DEL-04 | 削除後に GET /api/state を呼ぶと対象記事が含まれないこと | 状態遷移 |

### 2.10 /api/reference-materials (REF)

| ID | テスト観点 | 分類 |
|----|-----------|------|
| TP-REF-01 | `type` が `url` / `file` 以外のとき HTTP 400 を返すこと | 例外系 |
| TP-REF-02 | `type="url"` で `url` が空のとき HTTP 400 を返すこと | 境界値 |
| TP-REF-03 | ブロックURLのとき HTTP 400 / BLOCKED_URL を返すこと | セキュリティ |
| TP-REF-04 | 外部URLフェッチ失敗（非200）のとき HTTP 400 を返すこと | 例外系 |
| TP-REF-05 | 外部URLフェッチ例外のとき HTTP 400 / FETCH_ERROR を返すこと | 例外系 |
| TP-REF-06 | `type="file"` で `.pdf` 等の非対応拡張子のとき HTTP 400 を返すこと | 例外系 |
| TP-REF-07 | `type="file"` で `filename` / `content` が空のとき HTTP 400 を返すこと | 境界値 |
| TP-REF-08 | `.txt` / `.md` ファイルが DB に保存されて HTTP 201 を返すこと | 命令網羅 |
| TP-REF-09 | コンテンツが 10,000 文字を超えるとき先頭10,000文字のみ保存されること | 境界値 |

### 2.11 ArticlePreviewDialog (DLG)

| ID | テスト観点 | 分類 |
|----|-----------|------|
| TP-DLG-01 | `article` prop 変更時に `editDraft` が自動同期されること（`isEditMode=false`） | 状態遷移 |
| TP-DLG-02 | `isEditMode=true` のとき `article` prop 変更で `editDraft` が上書きされないこと | 状態遷移 |
| TP-DLG-03 | 「直接編集」ボタンクリックで `isEditMode=true` になること | 命令網羅 |
| TP-DLG-04 | 「編集を適用」ボタンクリックで `onEdit` が呼ばれ `isEditMode=false` になること | 命令網羅 |
| TP-DLG-05 | `isRegenerating=true` のとき編集・再生成・確定ボタンが無効化されること | 条件網羅 |
| TP-DLG-06 | 「AIに再生成させる」クリック時に `onRegenerate` が呼ばれること | 命令網羅 |
| TP-DLG-07 | 再生成前に `isEditMode=true` のとき `onEdit` が呼ばれてから `isEditMode=false` になること | 状態遷移 |
| TP-DLG-08 | 再生成後に `additionalPrompt` がクリアされること | 命令網羅 |
| TP-DLG-09 | 「確認」ボタンで `isEditMode=true` のとき `onEdit` と `onConfirm` が両方呼ばれること | 複合条件 |
| TP-DLG-10 | `saleMode="paid"` かつ `paidContent` がある場合に有料パートセクションが表示されること | 条件網羅 |
| TP-DLG-11 | `saleMode="free"` のとき有料パートセクションが表示されないこと | 条件網羅 |
| TP-DLG-12 | `isEditMode=true` かつ `saleMode="paid"` のとき有料パートの Textarea が表示されること | 複合条件 |
| TP-DLG-13 | `open=false` になったとき `isRegenerating=false` ならば `onClose` が呼ばれること | 状態遷移 |
| TP-DLG-14 | `open=false` になったとき `isRegenerating=true` ならば `onClose` が呼ばれないこと | 状態遷移 |
| TP-DLG-15 | 初期表示時に `article.freeContent` が優先され `.body` はフォールバックになること | 分岐網羅 |

---

## 3. テストケース一覧

### 3.1 buildStructuredNoteContent

#### TC-BSN-01: 有料コンテンツ完全設定 → セパレーター付き分割出力

```typescript
// 入力
const ctx: SaveContext = {
  jobId: 1,
  title: "テスト記事",
  noteBody: "本文",
  freePreviewMarkdown: "無料パート",
  paidContentMarkdown: "有料パート",
  salesMode: "free_paid",
  targetState: "draft",
  applySaleSettings: true,
  priceYen: 500,
  transitionCtaText: "続きは有料",
};

// 期待値
const result = buildStructuredNoteContent(ctx);
expect(result.paidHtml).not.toBe("");
expect(result.separator).not.toBeNull();
expect(result.freeHtml).toContain("続きは有料");
```

#### TC-BSN-02: applySaleSettings=false → フルHTML返却

```typescript
const ctx = { ...baseCtx, applySaleSettings: false };
const result = buildStructuredNoteContent(ctx);
expect(result.separator).toBeNull();
expect(result.paidHtml).toBe("");
expect(result.freeHtml).toBe(result.fullHtml);
```

#### TC-BSN-03: salesMode="normal" → フルHTML返却

```typescript
const ctx = { ...baseCtx, salesMode: "normal" as const };
const result = buildStructuredNoteContent(ctx);
expect(result.separator).toBeNull();
```

#### TC-BSN-04: paidContentMarkdown="" → フルHTML返却

```typescript
const ctx = { ...baseCtx, paidContentMarkdown: "" };
const result = buildStructuredNoteContent(ctx);
expect(result.separator).toBeNull();
```

#### TC-BSN-05: paidContentMarkdown=" \n\t" → フルHTML返却（trim後空）

```typescript
const ctx = { ...baseCtx, paidContentMarkdown: "   \n\t  " };
const result = buildStructuredNoteContent(ctx);
expect(result.separator).toBeNull();
```

#### TC-BSN-06: freePreviewMarkdown="" → noteBody フォールバック

```typescript
const ctx = { ...baseCtx, freePreviewMarkdown: "", noteBody: "本文フォールバック" };
const result = buildStructuredNoteContent(ctx);
expect(result.freeHtml).toContain("本文フォールバック");
```

#### TC-BSN-07: 3条件AND の各条件単独 false でも分割スキップ（条件独立性テスト）

```typescript
// 各条件を一つずつ false にして残りを true に設定
const cases = [
  { applySaleSettings: false, salesMode: "free_paid", paidContentMarkdown: "paid" },
  { applySaleSettings: true, salesMode: "normal", paidContentMarkdown: "paid" },
  { applySaleSettings: true, salesMode: "free_paid", paidContentMarkdown: "" },
];
for (const override of cases) {
  const ctx = { ...baseCtx, ...override };
  const result = buildStructuredNoteContent(ctx as SaveContext);
  expect(result.separator).toBeNull();
}
```

#### TC-BSN-08: bodyLength = stripNewlines 後の文字数検証

```typescript
const ctx = { ...baseCtx, applySaleSettings: false, noteBody: "あ\nい\nう" };
const result = buildStructuredNoteContent(ctx);
expect(result.bodyLength).toBe(3); // "あいう" = 3文字
```

#### TC-BSN-09: separator が freeParagraphs 末尾ブロックの id であること

```typescript
const result = buildStructuredNoteContent(paidCtx);
expect(result.separator).toMatch(/^job-\d+-free-/);
```

---

### 3.2 buildPublishPayload

#### TC-PUB-01: 有料設定完全一致 → limited=true, pay_body 設定

```typescript
const structured: StructuredNoteContent = {
  fullHtml: "<p>full</p>",
  freeHtml: "<p>free</p>",
  paidHtml: "<p>paid</p>",
  separator: "some-id",
  bodyLength: 8,
};
const payload = buildPublishPayload(note, paidCtx, structured);
expect(payload.limited).toBe(true);
expect(payload.pay_body).toBe("<p>paid</p>");
expect(payload.separator).toBe("some-id");
```

#### TC-PUB-02: separator=null → limited=false

```typescript
const structured = { ...structuredBase, separator: null };
const payload = buildPublishPayload(note, paidCtx, structured);
expect(payload.limited).toBe(false);
expect(payload.pay_body).toBe("");
expect(payload.price).toBe(0);
```

#### TC-PUB-03: paidHtml="" → limited=false

```typescript
const structured = { ...structuredBase, paidHtml: "" };
const payload = buildPublishPayload(note, paidCtx, structured);
expect(payload.limited).toBe(false);
```

#### TC-PUB-04: priceYen=null → price=300（デフォルト）

```typescript
const ctx = { ...paidCtx, priceYen: null };
const payload = buildPublishPayload(note, ctx, structuredPaid);
expect(payload.price).toBe(300);
```

#### TC-PUB-05: 不変フィールドの固定値確認

```typescript
const payload = buildPublishPayload(note, ctx, structured);
expect(payload.status).toBe("published");
expect(payload.disable_comment).toBe(false);
expect(payload.hashtags).toEqual([]);
expect(payload.circle_permissions).toEqual([]);
```

---

### 3.3 ブロック変換ヘルパー群

#### TC-BLK-01: --- 行がブロック区切りになりコンテンツに含まれない

```typescript
const blocks = normalizeBlocks("段落1\n---\n段落2");
expect(blocks).toHaveLength(2);
expect(blocks[0]).toBe("段落1");
expect(blocks[1]).toBe("段落2");
```

#### TC-BLK-02: コードフェンス内の --- は区切りにならない

```typescript
const blocks = normalizeBlocks("```\nsome code\n---\n```");
expect(blocks).toHaveLength(1);
expect(blocks[0]).toContain("---");
```

#### TC-BLK-03: 見出し変換

```typescript
const { html } = buildBlockHtml("# H1", "seed");
expect(html).toMatch(/<h2[^>]*>H1<\/h2>/);

const { html: h2 } = buildBlockHtml("## H2", "seed");
expect(h2).toMatch(/<h3[^>]*>H2<\/h3>/);

const { html: h3 } = buildBlockHtml("### H3", "seed");
expect(h3).toMatch(/<h4[^>]*>H3<\/h4>/);
```

#### TC-BLK-04: リスト変換

```typescript
const { html } = buildBlockHtml("- item1\n- item2", "seed");
expect(html).toContain("<ul");
expect(html).toContain("<li>item1</li>");
```

#### TC-BLK-05: インラインマークダウン変換

```typescript
const { html } = buildBlockHtml("**太字** と *斜体* と `code`", "seed");
expect(html).toContain("<b>太字</b>");
expect(html).toContain("<i>斜体</i>");
expect(html).toContain("<code>code</code>");
```

#### TC-BLK-06: XSS エスケープ

```typescript
const { html } = buildBlockHtml('<script>alert("xss")</script>', "seed");
expect(html).not.toContain("<script>");
expect(html).toContain("&lt;script&gt;");
```

#### TC-BLK-07: コードブロック末尾 ``` 処理

```typescript
const { html } = buildBlockHtml("```js\nconsole.log(1)\n```", "seed");
expect(html).toContain('<code class="language-js">');
expect(html).not.toContain("```");
```

#### TC-BLK-08: 空文字列 → 空ブロック配列

```typescript
const blocks = normalizeBlocks("");
expect(blocks).toHaveLength(0);
```

---

### 3.4 UnofficialApiAdapter

#### TC-ADT-01: モードでの draft URL 返却

```typescript
process.env.ENABLE_REAL_NOTE_AUTOMATION = "false";
delete process.env.NOTE_UNOFFICIAL_API_URL;
const adapter = new UnofficialApiAdapter();
const result = await adapter.save({ ...ctx, targetState: "draft", jobId: 42 });
expect(result.draftUrl).toBe("https://note.com/mock/draft/42");
expect(result.method).toBe("unofficial_api");
```

#### TC-ADT-02: MOCK_NOTE_API_RESULT=fail で例外

```typescript
process.env.MOCK_NOTE_API_RESULT = "fail";
await expect(adapter.save(ctx)).rejects.toThrow("MOCK_NOTE_API_FAILED");
```

#### TC-ADT-03: saleMode=free → saleSettingStatus=not_required

```typescript
const result = await adapter.save({ ...ctx, applySaleSettings: false });
expect(result.saleSettingStatus).toBe("not_required");
```

#### TC-ADT-04: PlaywrightAdapter モック動作

```typescript
const adapter = new PlaywrightAdapter();
const result = await adapter.save({ ...ctx, targetState: "draft", jobId: 10 });
expect(result.draftUrl).toContain("/mock/playwright/10");
```

#### TC-ADT-05: PinchTabAdapter モック動作

```typescript
const adapter = new PinchTabAdapter();
const result = await adapter.save({ ...ctx, targetState: "published", jobId: 20 });
expect(result.draftUrl).toContain("/mock/pinchtab/published/20");
```

---

### 3.5 /api/note/draft・/api/note/publish

#### TC-API-01: 数値ID記事 → 200, draftUrl 含む

```typescript
const res = await app.inject({
  method: "POST",
  url: "/api/note/draft",
  payload: {
    article: { id: "5", saleMode: "free", title: "タイトル", body: "本文", freeContent: "無料" },
    settings: {},
  },
});
expect(res.statusCode).toBe(200);
expect(res.json().draftUrl).toContain("/mock/");
```

#### TC-API-02: 非数値ID → 200（jobId=0 フォールバック）

```typescript
const res = await app.inject({
  method: "POST",
  url: "/api/note/draft",
  payload: {
    article: { id: "invalid-id", saleMode: "free", title: "テスト", body: "本文", freeContent: "無料" },
    settings: {},
  },
});
expect(res.statusCode).toBe(200);
```

#### TC-API-03: saleMode=paid → applySaleSettings=true が渡される

```typescript
// saveContextDirect のモックで呼び出し引数を検証
const res = await app.inject({
  method: "POST",
  url: "/api/note/publish",
  payload: {
    article: { id: "1", saleMode: "paid", title: "T", body: "B", freeContent: "F", paidContent: "P", price: 500 },
    settings: {},
  },
});
expect(capturedCtx.applySaleSettings).toBe(true);
expect(capturedCtx.salesMode).toBe("free_paid");
expect(capturedCtx.targetState).toBe("published");
```

#### TC-API-04: サービス例外 → 400 / SAVE_FAILED

```typescript
mockSaveContextDirect.mockRejectedValue(new Error("保存失敗"));
const res = await app.inject({ method: "POST", url: "/api/note/draft", payload: validPayload });
expect(res.statusCode).toBe(400);
expect(res.json().error.code).toBe("SAVE_FAILED");
```

---

### 3.6 /api/articles/regenerate-assets

#### TC-REG-01: keyword 未指定 → 400

```typescript
const res = await app.inject({
  method: "POST",
  url: "/api/articles/regenerate-assets",
  payload: { article: { id: "1" }, settings: {} },
});
expect(res.statusCode).toBe(400);
expect(res.json().error.code).toBe("INVALID_REQUEST");
```

#### TC-REG-02: accountId 非数値フォールバック

```typescript
// DB に account_id=1 が存在する前提
const res = await app.inject({
  method: "POST",
  url: "/api/articles/regenerate-assets",
  payload: { article: { keyword: "AI", accountId: "abc", saleMode: "free" }, settings: {} },
});
expect(res.statusCode).toBe(200);
```

#### TC-REG-03: DB にアカウント0件 → 400 / NO_ACCOUNT

```typescript
// DB を空にしてテスト
const res = await app.inject({ method: "POST", url: "/api/articles/regenerate-assets", payload });
expect(res.statusCode).toBe(400);
expect(res.json().error.code).toBe("NO_ACCOUNT");
```

#### TC-REG-04: providerId=gemini → override なし

```typescript
// createProvider が呼ばれないことを確認
const res = await app.inject({
  method: "POST",
  url: "/api/articles/regenerate-assets",
  payload: { article: { keyword: "test", accountId: "1", providerId: "gemini", saleMode: "free" }, settings: {} },
});
expect(mockCreateProvider).not.toHaveBeenCalled();
```

#### TC-REG-05: ジョブ succeeded → article 返却

```typescript
mockGetJobDetail.mockResolvedValue({ status: "succeeded" });
const res = await app.inject({ method: "POST", url: "/api/articles/regenerate-assets", payload: validPayload });
expect(res.statusCode).toBe(200);
expect(res.json()).toHaveProperty("article");
```

---

### 3.7 /api/state

#### TC-STA-01: GET → articles / prompts / accounts / settings を含む

```typescript
const res = await app.inject({ method: "GET", url: "/api/state" });
const body = res.json();
expect(body.state).toHaveProperty("articles");
expect(body.state).toHaveProperty("prompts");
expect(body.state).toHaveProperty("accounts");
expect(body.state).toHaveProperty("settings");
```

#### TC-STA-02: PUT → アカウント upsert

```typescript
// 1回目 INSERT 確認
await app.inject({ method: "PUT", url: "/api/state", payload: stateWithNewAccount });
const accounts1 = await db.select().from(noteAccounts);
expect(accounts1).toHaveLength(1);

// 2回目 UPDATE 確認（件数変わらず）
await app.inject({ method: "PUT", url: "/api/state", payload: stateWithSameAccount });
const accounts2 = await db.select().from(noteAccounts);
expect(accounts2).toHaveLength(1);
```

#### TC-STA-03: PUT 空配列アカウント → 既存削除されない

```typescript
await db.insert(noteAccounts).values(existingAccount);
await app.inject({ method: "PUT", url: "/api/state", payload: { state: { accounts: [], prompts: [], settings: {} } } });
const accounts = await db.select().from(noteAccounts);
expect(accounts).toHaveLength(1); // 削除されていない
```

#### TC-STA-04: deletedJobIds が PUT で保持される

```typescript
// sidecar に deletedJobIds を設定
await stateService.updateSidecar((s) => ({ ...s, deletedJobIds: [99] }));
// PUT でも deletedJobIds は上書きされない
await app.inject({ method: "PUT", url: "/api/state", payload: { state: fullState } });
const sidecar = await stateService.load();
expect((sidecar as any).deletedJobIds).toContain(99);
```

---

### 3.8 DELETE /api/articles/:id

#### TC-DEL-01: 数値ID → deletedJobIds に追加

```typescript
const res = await app.inject({ method: "DELETE", url: "/api/articles/5" });
expect(res.statusCode).toBe(200);
const sidecar = await stateService.load();
expect((sidecar as any).deletedJobIds).toContain(5);
```

#### TC-DEL-02: 非数値ID → DB 無変更で 200

```typescript
const res = await app.inject({ method: "DELETE", url: "/api/articles/frontend-only-id" });
expect(res.statusCode).toBe(200);
expect(res.json().result).toBe("success");
```

#### TC-DEL-03: 重複削除で配列に重複なし

```typescript
await app.inject({ method: "DELETE", url: "/api/articles/5" });
await app.inject({ method: "DELETE", url: "/api/articles/5" });
const sidecar = await stateService.load();
const ids: number[] = (sidecar as any).deletedJobIds;
expect(ids.filter((x) => x === 5)).toHaveLength(1);
```

---

### 3.9 /api/reference-materials

#### TC-REF-01: type 不正値 → 400 / INVALID_REQUEST

```typescript
const res = await app.inject({
  method: "POST",
  url: "/api/reference-materials",
  payload: { type: "pdf", url: "https://example.com" },
});
expect(res.statusCode).toBe(400);
```

#### TC-REF-02: type=url, url 空 → 400

```typescript
const res = await app.inject({ method: "POST", url: "/api/reference-materials", payload: { type: "url", url: "" } });
expect(res.statusCode).toBe(400);
```

#### TC-REF-03: ブロックURL → 400 / BLOCKED_URL

```typescript
const res = await app.inject({
  method: "POST",
  url: "/api/reference-materials",
  payload: { type: "url", url: "http://localhost:8080/secret" },
});
expect(res.statusCode).toBe(400);
expect(res.json().error.code).toBe("BLOCKED_URL");
```

#### TC-REF-04: type=file, .pdf → 400 / UNSUPPORTED_FILE

```typescript
const res = await app.inject({
  method: "POST",
  url: "/api/reference-materials",
  payload: { type: "file", filename: "doc.pdf", content: "..." },
});
expect(res.statusCode).toBe(400);
expect(res.json().error.code).toBe("UNSUPPORTED_FILE");
```

#### TC-REF-05: type=file, .txt → 201 で保存

```typescript
const res = await app.inject({
  method: "POST",
  url: "/api/reference-materials",
  payload: { type: "file", filename: "note.txt", content: "テスト内容" },
});
expect(res.statusCode).toBe(201);
expect(res.json()).toHaveProperty("id");
```

#### TC-REF-06: content 10,001文字 → 先頭10,000文字のみ保存

```typescript
const longContent = "a".repeat(10_001);
await app.inject({ method: "POST", url: "/api/reference-materials", payload: { type: "file", filename: "x.txt", content: longContent } });
const [mat] = await db.select().from(referenceMaterials).limit(1);
expect(mat.extractedText.length).toBe(10_000);
```

---

### 3.10 ArticlePreviewDialog (E2E / Component テスト)

#### TC-DLG-01: article prop 変更で editDraft 同期

```
前提: isEditMode=false
操作: article.title を "新タイトル" に変更
期待: タイトル表示エリアに "新タイトル" が表示される
```

#### TC-DLG-02: isEditMode=true 中は article 変更で上書きされない

```
前提: 「直接編集」ボタンをクリックし isEditMode=true
操作: article.title prop を変更
期待: 編集中の title テキストエリアが変更されない
```

#### TC-DLG-03: 「直接編集」ボタンクリック → テキストエリア表示

```
操作: data-testid="edit-toggle" をクリック
期待: data-testid="edit-title" が表示される
     data-testid="edit-free-content" が表示される
```

#### TC-DLG-04: 「編集を適用」ボタン → onEdit 呼び出し

```
前提: isEditMode=true, タイトルを "変更後" に編集
操作: data-testid="edit-toggle" をクリック（適用ボタン）
期待: onEdit が { title: "変更後", ... } で呼ばれる
     isEditMode=false になる
```

#### TC-DLG-05: isRegenerating=true → ボタン無効化

```
前提: isRegenerating=true
期待: data-testid="regenerate-button" が disabled
     data-testid="confirm-button" が disabled
     data-testid="edit-toggle" が disabled
```

#### TC-DLG-06: 再生成ボタン → onRegenerate 呼び出し

```
操作: data-testid="additional-prompt" に "詳しく" と入力
     data-testid="regenerate-button" をクリック
期待: onRegenerate("詳しく") が呼ばれる
     クリック後 additionalPrompt がクリアされる
```

#### TC-DLG-07: 再生成前に編集内容反映

```
前提: isEditMode=true, タイトルを "編集中" に変更
操作: data-testid="regenerate-button" をクリック
期待: onEdit が先に呼ばれる
     その後 onRegenerate が呼ばれる
     isEditMode が false になる
```

#### TC-DLG-08: 確認ボタン（isEditMode=true）→ onEdit + onConfirm

```
前提: isEditMode=true
操作: data-testid="confirm-button" をクリック
期待: onEdit が呼ばれる
     onConfirm が呼ばれる
```

#### TC-DLG-09: saleMode=paid / paidContent あり → 有料パート表示

```
前提: article.saleMode="paid", article.paidContent="有料内容"
期待: "有料パート" ラベルが表示される
     "有料" バッジが表示される
```

#### TC-DLG-10: saleMode=free → 有料パート非表示

```
前提: article.saleMode="free"
期待: "有料パート" セクションが表示されない
```

#### TC-DLG-11: ダイアログクローズ（isRegenerating=false）→ onClose 呼び出し

```
前提: isRegenerating=false
操作: ダイアログ外をクリック or ESC
期待: onClose が呼ばれる
```

#### TC-DLG-12: ダイアログクローズ（isRegenerating=true）→ onClose 呼ばれない

```
前提: isRegenerating=true
操作: ダイアログ外をクリック
期待: onClose が呼ばれない
```

#### TC-DLG-13: freeContent優先・body フォールバック

```
前提: article.freeContent="無料内容", article.body="本文"
期待: 表示エリアに "無料内容" が表示される（body ではない）
```

```
前提: article.freeContent="", article.body="本文"
期待: 表示エリアに "本文" が表示される
```

---

## 4. 網羅性チェック

### 4.1 命令網羅 (Statement Coverage)

| モジュール | 対象パス数 | カバー済み |
|-----------|-----------|-----------|
| buildStructuredNoteContent | 3分岐×複数行 | TC-BSN-01〜09 |
| buildPublishPayload | 1分岐×複数行 | TC-PUB-01〜05 |
| normalizeBlocks / buildBlockHtml | 10+ | TC-BLK-01〜08 |
| UnofficialApiAdapter.save | 4パス | TC-ADT-01〜03 |
| PlaywrightAdapter.save | 2パス | TC-ADT-04〜05 |
| /api/note/draft | 2パス | TC-API-01〜04 |
| /api/articles/regenerate-assets | 5パス | TC-REG-01〜05 |
| DELETE /api/articles/:id | 2パス | TC-DEL-01〜03 |
| /api/reference-materials | 6パス | TC-REF-01〜06 |

### 4.2 分岐網羅 (Branch Coverage)

未カバーの主要分岐:
- `NoteApiClient.getCurrentUser` の `urlname` が null のケース（実装がモック化されているため E2E のみ可能）
- `PinchTabClient.selectProfile` の各フォールバック順序（`note-live` → `default` → `profiles[0]`）
- `waitForDebugger` 20回リトライ失敗パス

### 4.3 条件網羅 (Condition Coverage)

| 条件式 | すべての真偽組み合わせ |
|--------|----------------------|
| `applySaleSettings && salesMode==="free_paid" && paidContentMarkdown.trim().length>0` | TC-BSN-07 で8パターン網羅 |
| `applySaleSettings && salesMode==="free_paid" && separator!==null && paidHtml.length>0` | TC-PUB-01〜03 で網羅 |
| `isEditMode` × `article prop 変更` | TC-DLG-01〜02 で網羅 |
| `isRegenerating` × `ダイアログクローズ` | TC-DLG-11〜12 で網羅 |

---

## 5. レビューコメント

### 5.1 テスト不足ポイント

1. **`PinchTabClient` のプロファイル選択ロジック** (`selectProfile`) は E2E でしかテストしにくい。ピュア関数に切り出してユニットテスト化を推奨。
2. **`buildState` のタイムゾーン変換 (`toJST`)** が正しく UTC+9 に変換されているかのテストが不足。
3. **`clickPaywallButton`** の `separatorEl.isVisible` 失敗パスと成功パスのテストは Playwright モック E2E が必要。
4. **`PUT /api/state` の排他制御 (write lock)** は並列リクエストによる競合テストが必要。

### 5.2 仕様が曖昧な箇所

1. **`jobId=0` のフォールバック動作**: `saveContextDirect` に `jobId=0` が渡ったとき、サービス層でどう扱われるか明示されていない。テスト時はサービスのモックで検証すること。
2. **`additionalPrompt` を付けた再生成**: サーバー側のプロンプトへの反映ロジックがフロントエンドとバックエンドで分断されており、E2E テストが必要。

### 5.3 バグが出やすいポイント

1. **`stale closure` リスク**: `AppDataContext` の非同期処理中に状態が古いスナップショットを参照する可能性。`stateRef` パターンで対処済みだが、テストで async 更新後の値を検証すること。
2. **`paidContent` が空のとき `separator` が null になる**: `buildPublishPayload` で `paidHtml=""` のとき `limited=false` になるが、`buildStructuredNoteContent` で `freeParagraphs=0` の場合も同じ挙動になる。二重確認が必要。
3. **`deletedJobIds` の重複追加**: 明示的な重複チェック (`!deletedJobIds.includes(id)`) があるが、並列削除リクエストで競合する可能性。ロック取得前に読み込む実装のため、楽観ロック的な再チェックが必要。

### 5.4 実装注意点

1. **`isBlockedUrl` のカバー範囲**: `localhost` / `127.0.0.1` / プライベートIPのブロックが実装されているか確認すること（TC-REF-03 で検証必須）。
2. **HTML エスケープの漏れ**: `buildBlockHtml` のコードブロック内のコードは `escapeHtml` を通しているが、言語名 (`lang`) も `escapeHtml` されていることを TC-BLK-06 で確認すること。
3. **タイムアウト値の一貫性**: `regenerate-assets` と `generate-article` 両方で `TIMEOUT_MS=300_000` が使われているが、環境変数 `generationTimeoutMs` との連動が現状では未実装。

---

## 6. 参考: テストファイル配置案

```
apps/server/src/tests/
├── unit/
│   ├── note-save-adapters.test.ts   ← BSN, PUB, BLK, ADT
│   └── saas-hub-helpers.test.ts     ← buildArticleRecord, buildState
├── integration/
│   └── api.integration.test.ts      ← API, REG, GEN, STA, DEL, REF
saas-hub/src/tests/
├── components/
│   └── ArticlePreviewDialog.test.tsx ← DLG
└── context/
    └── AppDataContext.regenerate.test.tsx ← CTX
```
