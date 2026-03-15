# UI_IMPLEMENTATION_AUDIT.md

2026-03-13 時点の `saas-hub` UI 棚卸し。

監査区分はこれで固定する。

- `実装済み`
- `このPC保存のみ`
- `外部接続依存`
- `未実装`

## 実装済み

- 記事生成
  - 生成画面から `即公開 / 下書き保存 / 予約投稿` を実行できる
  - provider 指定なしなら既定 provider、指定ありならその provider を使って生成する
- 記事詳細
  - 本文編集
  - NOTE保存
  - NOTE公開
  - 素材再生成 provider の選択
  - 実行履歴の反映
- 手動記事
  - 記事作成
  - 下書き保存
  - 即公開
  - 予約投稿
- 設定
  - note 設定
  - Playwright / PinchTab 設定
  - AI provider 一覧
  - provider 詳細保存
  - provider 接続テスト
  - 既定 provider / fallback providers / strict mode / timeout
- GitHub Copilot
  - Device Flow 開始
  - 認証状態確認
  - 切断
- Codex CLI
  - `C:\Users\i0swi\.codex\auth.json` の検出
- 診断
  - Playwright
  - PinchTab
  - note ログイン
  - provider ごとの `設定 / 接続 / 利用`

## このPC保存のみ

- 記事データ
  - `server/data/app-state.json`
- プロンプト管理
  - 追加 / 編集 / 削除
- アカウント管理
  - 追加 / 削除
- 画面状態のローカルキャッシュ
  - browser localStorage

## 外部接続依存

- Gemini
  - Google Generative Language API
- Claude
  - Anthropic Messages API
- OpenAI
  - OpenAI Responses API
- Codex CLI
  - ローカルの `.codex/auth.json`
- GitHub Copilot
  - GitHub OAuth Device Flow
  - Copilot token exchange
- Alibaba Cloud Model Studio
  - OpenAI互換 endpoint
- OpenRouter / Groq / DeepSeek / xAI / custom OpenAI互換
  - 各 provider の API key と endpoint
- note 投稿
  - note ログイン状態
  - Playwright / PinchTab / note 側の応答

## 未実装

- 販売対象のコア機能として未実装扱いのUIは `0件`

補足:
- provider を保存しただけでは `利用可` にならないものがある
- これは未実装ではなく、外部接続や認証状態に依存する
- GitHub Copilot は undocumented endpoint の応答次第で `設定済み` 止まりになることがある

## UI文言監査

以下は除去済み。

- `real`
- `準備中`
- `順次追加`
- `PC保存`
- `管理用メモ`
- `ローカル保存`

売り物として不自然な技術用語は UI から外し、必要な制約は docs に集約した。
