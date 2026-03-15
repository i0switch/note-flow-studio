# note記事自動生成・下書き保存ローカルアプリ 開発入口

## このリポジトリの現状
現時点では、初期実装まで完了している。
開発の正本として、分割済み設計資料 `note_local_app_design_package_v_2_pinchtab_split/` を参照しつつ、実装は `apps/web`, `apps/server`, `packages/shared` に分かれている。

## 目標
- キーワード、参考資料、ジャンル指定から note 用記事を生成する
- アイキャッチ画像、本文画像、必要に応じたグラフを生成する
- 無料部分から有料部分への導線を含む販売用記事を作れるようにする
- note 下書き保存と note 販売設定反映を準自動化する
- 保存失敗時に `note 非公式API -> Playwright -> PinchTab` の順でフォールバックできるようにする

## 最初に読むファイル
- `AGENTS.md`
- `PROJECT_CONTEXT.md`
- `DEVELOPMENT_ROADMAP.md`
- `TASKS.md`
- `UI_CURRENT_STATE_SPECIFICATION.md`
- `UI_SPECIFICATION.md`
- `PORTABLE_DISTRIBUTION.md`
- `note_local_app_design_package_v_2_pinchtab_split/README.md`

## 設計資料マップ
- 文書概要: `note_local_app_design_package_v_2_pinchtab_split/00_document_overview.md`
- 要件定義: `note_local_app_design_package_v_2_pinchtab_split/01_requirements.md`
- 画面仕様: `note_local_app_design_package_v_2_pinchtab_split/02_screen_specifications.md`
- ワイヤーフレーム: `note_local_app_design_package_v_2_pinchtab_split/03_wireframes.md`
- 機能一覧: `note_local_app_design_package_v_2_pinchtab_split/04_feature_list.md`
- ユースケース: `note_local_app_design_package_v_2_pinchtab_split/05_use_cases.md`
- DB設計: `note_local_app_design_package_v_2_pinchtab_split/06_database_design.md`
- API仕様: `note_local_app_design_package_v_2_pinchtab_split/07_api_specification.md`
- 例外ルール: `note_local_app_design_package_v_2_pinchtab_split/08_business_and_exception_rules.md`
- 技術方針: `note_local_app_design_package_v_2_pinchtab_split/10_technical_policy.md`
- 実装優先順位: `note_local_app_design_package_v_2_pinchtab_split/12_implementation_priority.md`

## 開発のおすすめ開始順
1. 技術スタックを確定する
2. 最小構成のフォルダを作る
3. SQLite スキーマとマイグレーション基盤を作る
4. ローカルAPIサーバーとジョブ実行基盤を作る
5. 記事生成、履歴、保存の最短フローを通す
6. 参考資料、画像、販売導線、販売設定自動化を順次追加する

## 今このリポジトリでCodexに期待すること
- 設計を読み、迷いなく着手する
- 実装に必要な不足点を見つけたら明示する
- 影響範囲が広い変更は、コードと設計をセットで更新する

## 実装済み
- npm workspaces 構成
- React + Vite + Tailwind の Web UI
- Fastify + SQLite + Drizzle の API / DB
- 参考資料取込、記事生成、履歴、詳細、保存、診断
- Gemini モック対応のAIプロバイダ層
- note 非公式API / Playwright / PinchTab の保存アダプタ
- Unit / Integration / E2E テスト
- Windows 向け `portable` 配布パッケージ生成
- 初回セットアップ画面と依存関係チェック
- Node / Playwright 同梱のクリーン環境起動検証

## 配布版の現状
- 配布方式は `Windows portable` で確定
- 出力先は `release/note-local-draft-studio-portable`
- 起動ファイルは `start-note-local.bat`
- 初回起動時はセットアップ画面で API キー、note ログイン情報、PinchTab 設定を保存できる
- 詳細は `PORTABLE_DISTRIBUTION.md` を参照
