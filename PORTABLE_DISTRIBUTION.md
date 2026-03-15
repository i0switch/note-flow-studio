# PORTABLE_DISTRIBUTION.md

## 配布方式
- 購入者向け配布方式は `Windows portable` を採用
- Web サービスとして公開せず、購入者の PC 上で `localhost` アプリとして動かす
- 配布物は `release/note-local-draft-studio-portable` に出力する

## 配布物の中身
- `start-note-local.bat`: 通常起動
- `start-note-local-headless.bat`: ブラウザ自動起動なし
- `runtime/`: 同梱 Node.js
- `ms-playwright/`: 同梱 Chromium
- `apps/server/dist`: 配布用 API サーバー
- `apps/web/dist`: 配布用 Web UI
- `.env.example`: 設定雛形
- `README_FIRST.txt`: 最低限の起動案内

## 初回セットアップ
1. `start-note-local.bat` を実行する
2. セットアップ画面で Gemini、note、PinchTab、Playwright 設定を入力する
3. 必要なら `Chromium を導入する` を押す
4. 設定保存後、通常のダッシュボードへ進む

## セットアップ画面で吸収しているもの
- `.env` 手編集を不要化
- Node 実行環境の同梱
- Playwright パッケージと Chromium 有無の診断
- note セッション未保存の警告表示
- PinchTab 接続確認

## 検証コマンド
- 開発検証: `npm test`
- ビルド検証: `npm run build`
- E2E 検証: `npm run test:e2e`
- 手動リリース確認起動: `npm run start:release-check`
- 配布パッケージ生成: `npm run package:portable`
- クリーン環境検証: `npm run verify:portable`
- 配布版スモーク検証: `npm run verify:release`

## 起動保護
- `start:release-check` は `APP_PORT` 既定 `3001` と `WEB_PORT` 既定 `4273` を使う
- 起動前に同ポートを占有している `vite preview` `tsx server` `built server` を検知し、このプロジェクト由来と判断できるものだけ自動停止する
- 別プロセスが使っている場合は PID とコマンドラインを出して停止理由を明示する
- `verify:release` も同じポート保護を使い、配布版検証用ポート `3310` の競合を先に弾く

## 現時点の到達点
- 購入者向け `portable` 配布物を自動生成できる
- クリーン環境相当でセットアップ画面が起動し、設定保存まで通る
- note 生成、下書き保存、公開、PinchTab 経路をローカルアプリ前提で検証済み

## 残タスク
- 購入者向け操作マニュアルの清書
- 更新配布時の差分アップデート方針
- Windows Defender など配布時注意点の整理
