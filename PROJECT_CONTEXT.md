# PROJECT_CONTEXT.md

## プロジェクト概要
ローカルPC上で動く note 記事生成アプリを作る。
記事生成だけでなく、参考資料取り込み、画像生成、グラフ生成、無料→有料導線生成、note下書き保存、販売設定自動化までを視野に入れた設計になっている。

## 主要ユースケース
- 記事を新規生成する
- 参考資料を取り込んで記事へ反映する
- 画像付き、グラフ付きの記事を生成する
- 無料部分と有料部分を分けた販売用記事を作る
- note に下書き保存する
- 販売設定をブラウザ自動操作で反映する

## 主要ドメイン
- 記事生成ジョブ
- 生成記事
- 参考資料
- 画像生成
- グラフ生成
- 販売プロファイル
- note アカウント
- 保存試行履歴

## 想定アーキテクチャ
- UI: ブラウザUI
- Backend: ローカルAPIサーバー
- DB: SQLite
- AI Provider Layer: Gemini / OpenAI / Claude / Codex OAuth
- Media Adapter Layer: note を中心に将来拡張
- Browser Automation Layer: Playwright / PinchTab

## 重要な保存フロー
1. 記事生成ジョブ作成
2. 記事本文生成
3. 必要なら画像生成
4. 必要ならグラフ生成
5. 必要なら無料→有料導線生成
6. note 非公式APIで下書き保存
7. 足りない設定は Playwright または PinchTab で補完
8. 保存結果と試行履歴を記録

## 実装時に早めに固めるべきこと
- 使用技術スタック
- UI実装方式
- ジョブキュー方式
- DBマイグレーション方式
- note 非公式APIの採用範囲
- Playwright と PinchTab の切替条件
- グラフ生成形式
- 参考資料の取り込み対応形式

## 重要な設計ファイル
- 画面仕様: `note_local_app_design_package_v_2_pinchtab_split/02_screen_specifications.md`
- DB設計: `note_local_app_design_package_v_2_pinchtab_split/06_database_design.md`
- API設計: `note_local_app_design_package_v_2_pinchtab_split/07_api_specification.md`
- ルール: `note_local_app_design_package_v_2_pinchtab_split/08_business_and_exception_rules.md`

## 現在の前提
- まだ実装は始まっていない前提で動いてよい
- 設計はかなり固まっているが、技術選定は未確定部分がある
- 販売自動化は「下書き保存と販売設定の反映」までで、公開実行は対象外
