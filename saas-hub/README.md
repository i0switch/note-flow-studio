# note Flow Studio for `saas-hub`

`saas-hub` は Windows 上で `localhost` 動作する note 記事生成投稿フロー自動化アプリ。  
このリポジトリでは `Fastify API + Vite Web + Playwright 実投稿` をまとめて扱う。

## 起動

```powershell
npm install
npm run dev
```

- Web UI: `http://127.0.0.1:8080`
- API: `http://127.0.0.1:3001/api/health`

release 相当の起動確認はこれ。

```powershell
npm run build
npm run start:release-check
```

## 配布前チェック

配布判定は [DEPLOY_CHECKLIST.md](C:/Users/i0swi/OneDrive/デスクトップ/記事自動生成/saas-hub/DEPLOY_CHECKLIST.md) を正本にする。  
UI 実装の棚卸しは [UI_IMPLEMENTATION_AUDIT.md](C:/Users/i0swi/OneDrive/デスクトップ/記事自動生成/saas-hub/UI_IMPLEMENTATION_AUDIT.md) を見る。
直近の検証結果は [RELEASE_VERIFICATION.md](C:/Users/i0swi/OneDrive/デスクトップ/記事自動生成/saas-hub/RELEASE_VERIFICATION.md) に残す。

主要コマンドはこれ。

```powershell
npm run lint
npm test -- --run
npm run build
npm run test:smoke
npm run verify:release
```

`verify:release` は `lint -> test -> build -> api 起動 -> preview 起動 -> smoke` をまとめて回す。  
real note 投稿まで含める時は、実行前に環境変数を渡す。

```powershell
$env:NOTE_LOGIN_ID="your_note_id"
$env:NOTE_LOGIN_PASSWORD="your_note_password"
$env:GEMINI_API_KEY="your_gemini_key"
$env:RUN_REAL_NOTE="1"
npm run verify:release
```

## 実装状態

- コア動作
  - note 下書き保存
  - note 公開
  - 予約投稿の自動実行
  - 記事詳細の編集保存
  - 素材案の再生成
  - プロンプト管理
  - アカウント管理
- AI provider
  - Gemini
  - Claude
  - OpenAI
  - Codex CLI
  - GitHub Copilot OAuth
  - Alibaba Cloud Model Studio
  - OpenRouter
  - Groq
  - DeepSeek
  - xAI
  - custom OpenAI-compatible endpoint

provider の実接続可否は、資格情報と認証状態に依存する。  
実装区分の正本は [UI_IMPLEMENTATION_AUDIT.md](C:/Users/i0swi/OneDrive/デスクトップ/記事自動生成/saas-hub/UI_IMPLEMENTATION_AUDIT.md) を見る。

## 配布時の注意

- secrets は UI の設定画面と browser session に保存される
- AI provider secrets は `server/data/provider-secrets.json` に保存される
- `note` 側がログイン制限や 403 を返す時は、手動ログイン後に再試行する
- PinchTab は未接続でもアプリ全体の起動は可能
- 予約投稿の自動実行はアプリ起動中に動く
- `react-refresh` warning と `Browserslist` warning は既知の非致命

最初に購入者へ渡す案内は [README_FIRST.txt](C:/Users/i0swi/OneDrive/デスクトップ/記事自動生成/saas-hub/README_FIRST.txt) にまとめてある。
