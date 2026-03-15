# DEPLOY_CHECKLIST.md

`saas-hub` を購入者へ渡す前の判定基準。

## 合格条件

### 1. 起動
- `npm install` が通る
- `npm run build` が通る
- `npm run start:api` で `GET /api/health` が `ok`
- `npm run preview -- --host 127.0.0.1 --port 4173` で UI が開く

### 2. 設定保存
- note 設定を保存できる
- 基本設定を保存できる
- AI provider 設定を保存できる
- リロード後も設定が残る

### 3. 診断
- 再診断で Playwright / PinchTab / note ログイン / provider 状態が反映される
- Chromium 導入フローが動く
- provider ごとに `設定 / 接続 / 利用` が見分けられる

### 4. 生成
- 生成画面から記事作成できる
- `即公開 / 下書き保存 / 予約投稿` が動く
- 既定 provider と provider 上書きの両方が使える

### 5. 下書き保存
- 生成画面から note 下書き保存
- 記事詳細から note 下書き保存
- 手動記事から note 下書き保存

### 6. 公開
- 生成画面から note 公開
- 記事詳細から note 公開
- 予約投稿で自動公開
- 公開後に note URL が残る

### 7. 主要UI整合
- 擬似実装に見えるボタンが残っていない
- 技術メモっぽい文言が残っていない
- docs の監査結果と UI 表示が矛盾していない

### 8. 既知制約
- `UI_IMPLEMENTATION_AUDIT.md` が最新
- `RELEASE_VERIFICATION.md` が最新
- `README.md` が最新
- note 側制限時の復旧方法が文書化されている

## 実行コマンド

```powershell
npm run lint
npm test -- --run
npm run build
npm run verify:release
```

real note 投稿まで含める時:

```powershell
$env:NOTE_LOGIN_ID="your_note_id"
$env:NOTE_LOGIN_PASSWORD="your_note_password"
$env:GEMINI_API_KEY="your_gemini_key"
$env:RUN_REAL_NOTE="1"
npm run verify:release
```

## 許容する既知事項

- `react-refresh/only-export-components` warning
- `Browserslist: caniuse-lite is old` warning
- bundle chunk warning

この3つは配布阻害ではない。  
ただし warning が増えた時は再判定する。
