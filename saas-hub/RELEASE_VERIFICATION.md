# RELEASE_VERIFICATION.md

`saas-hub` の配布前検証結果。

更新日: 2026-03-13

## 結論

- `Windows localhost 配布アプリ` として渡せる水準まで確認済み
- `npm install -> lint -> test -> build -> api 起動 -> preview 起動 -> smoke -> real note 投稿` まで通過
- provider registry 方式へ切り替えたあとも、note 下書き保存 / note 公開 / 予約投稿の既存フローは regress していない

## 自動検証

- `npm run lint`
  - 成功
  - error 0 / warning 8
- `npm test -- --run`
  - 成功
  - 3 tests passed
- `npm run build`
  - 成功
  - chunk warning あり
- `npm run verify:release`
  - 成功
  - mock smoke 通過
- `RUN_REAL_NOTE=1 npm run verify:release`
  - 成功
  - real note 投稿通過

## 実機確認

- 設定画面
  - 基本設定保存: 成功
  - note 設定保存: 成功
  - Gemini provider 保存: 成功
  - Gemini 接続テスト: 成功
- 診断画面
  - 再診断: 成功
  - provider 状態反映: 成功
- 生成画面
  - 予約投稿で記事作成: 成功
  - 記事詳細URL再表示: 成功
- 記事詳細
  - 編集保存: 成功
  - 素材案更新: 成功
- プロンプト管理
  - 追加: 成功
- アカウント管理
  - 追加: 成功
- real note
  - 予約投稿の自動公開: 成功
    - URL: `https://note.com/mido_renai/n/na7597f11ec07`
  - 生成後即公開: 成功
    - URL: `https://note.com/mido_renai/n/n76f18005a183`
  - 手動記事の下書き保存: 成功
    - URL: `https://editor.note.com/notes/ndf527c76a484/edit/`

## provider 対応確認

- 実装あり
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
  - custom OpenAI互換
- real 接続確認済み
  - Gemini
  - Codex CLI 検出
- 実装済みだが資格情報未投入のため mock / 設定確認まで
  - Claude
  - OpenAI
  - GitHub Copilot
  - Alibaba Cloud Model Studio
  - OpenRouter
  - Groq
  - DeepSeek
  - xAI
  - custom OpenAI互換

## 既知の非致命事項

- `react-refresh/only-export-components` warning が 8 件ある
- `Browserslist: caniuse-lite is old` warning が出る
- build 後の最大 chunk は `608.06 kB`
  - 現時点では preview / 実運用とも動作確認済み
  - ただし今後さらに画面や依存が増えるなら再分割を検討する

## 未実装判定

- 販売対象のコア機能で `未実装` と扱うものは `0件`
- 外部接続の可否で `利用可` が変わるものはある
  - これは未実装ではなく資格情報や認証状態の問題
