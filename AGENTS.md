# AGENTS.md

## 目的
このワークスペースは、`note記事自動生成・下書き保存ローカルアプリ` の開発用プロジェクト。
Codex は設計資料を参照しながら、実装、設計更新、検証、整理を進める。

## 基本方針
- 出力は日本語で統一する
- 実装前に `README.md` と `PROJECT_CONTEXT.md` を確認する
- 設計の正本は `note_local_app_design_package_v_2_pinchtab_split/` 配下の分割資料とする
- 仕様変更が発生したら、コードだけでなく関連する設計Markdownも更新対象として扱う
- 実装は小さく刻み、各フェーズで動作確認できる状態を維持する

## 開発時の最初の確認順
1. `README.md`
2. `PROJECT_CONTEXT.md`
3. `DEVELOPMENT_ROADMAP.md`
4. `TASKS.md`
5. `note_local_app_design_package_v_2_pinchtab_split/README.md`

## 設計参照ルール
- 要件確認: `note_local_app_design_package_v_2_pinchtab_split/01_requirements.md`
- 画面仕様確認: `note_local_app_design_package_v_2_pinchtab_split/02_screen_specifications.md`
- ワイヤー確認: `note_local_app_design_package_v_2_pinchtab_split/03_wireframes.md`
- 機能一覧確認: `note_local_app_design_package_v_2_pinchtab_split/04_feature_list.md`
- DB確認: `note_local_app_design_package_v_2_pinchtab_split/06_database_design.md`
- API確認: `note_local_app_design_package_v_2_pinchtab_split/07_api_specification.md`
- 業務ルール確認: `note_local_app_design_package_v_2_pinchtab_split/08_business_and_exception_rules.md`
- 技術方針確認: `note_local_app_design_package_v_2_pinchtab_split/10_technical_policy.md`

## 実装優先ルール
- まずはローカルで完結する最小構成を作る
- Phase 1 は「記事生成の基盤」と「保存の最短経路」を優先する
- 販売自動化、グラフ、PinchTab は基盤完成後に段階追加する
- 参考資料、オールジャンル対応、無料→有料導線は内部データ構造を早い段階で入れる

## コード変更ルール
- 新機能追加時は、画面、API、DB、ジョブ、保存フローのどこに影響するかを明示する
- DB変更時はマイグレーション方針もあわせて残す
- 外部依存を増やす時は理由と代替案を記録する
- note 側仕様に依存する部分は、失敗時のフォールバック前提で設計する

## 完了時の確認
- 変更内容が `TASKS.md` の対象項目と対応していること
- 実装済み仕様が分割資料と矛盾していないこと
- 実行確認または未確認理由を明記していること
