# UI_CURRENT_STATE_SPECIFICATION.md

## 目的

この文書は、現時点で実装されている Web UI の実態をそのまま記録するための現状仕様書。
改善案や理想像ではなく、`2026-03-12` 時点の実装内容を基準に整理する。

改善検討時は `UI_SPECIFICATION.md` と並べて使う。

## 対象

- アプリ名: `note Local Draft Studio`
- 実行形態: `localhost` ローカルアプリ
- フロントエンド: `React + Vite`
- ルーティング: `react-router-dom`
- 状態管理: `TanStack Query + Zustand`

## 現在の画面構成

| パス | 画面名 | 実装コンポーネント | 表示条件 |
| --- | --- | --- | --- |
| `setup gate` | 初回セットアップ | `SetupPage` | `setup-status.isConfigured = false` |
| `/` | ダッシュボード | `DashboardPage` | `setup-status.isConfigured = true` |
| `/jobs/:id` | 記事詳細 | `JobDetailPage` | `setup-status.isConfigured = true` |
| `/references` | 参考資料管理 | `ReferencePage` | `setup-status.isConfigured = true` |
| `/settings` | 設定 / 診断 | `SettingsPage` | `setup-status.isConfigured = true` |

## レイアウト構造

### 初回セットアップ時

- サイドバーなし
- 1カラム構成
- 上部にヒーロー説明
- 下部に `初回設定 / 依存チェック / 配布前チェック`

### 通常起動時

- 左側: サイドバー
- 右側: メインコンテンツ
- 依存警告がある場合のみ、メイン上部に警告バナーを表示
- 各ページはカードコンポーネント中心の構成

## 共通UI

### Sidebar

**表示内容**
- アプリタイトル
- サブ説明文
- ナビリンク
  - ダッシュボード
  - 参考資料
  - 設定 / 診断

**現状の仕様**
- 現在地ハイライトなし
- アイコンなし
- 折りたたみなし

### Field

**役割**
- ラベル + 入力欄の共通ラッパー

**使用箇所**
- セットアップ画面
- 記事生成画面
- 参考資料管理画面
- 設定画面

### Toggle

**役割**
- Boolean項目の ON / OFF 入力

**使用箇所**
- Playwrightヘッドレス
- 画像
- グラフ
- 販売導線

### InfoCard

**役割**
- 長文テキストのカード表示

**使用箇所**
- 記事詳細画面

### LoadingCard

**役割**
- ローディング中の簡易表示

## 状態遷移

### アプリ起動

1. `/api/setup/status` を取得
2. `isConfigured=false` ならセットアップ画面表示
3. `isConfigured=true` なら通常画面表示

### 通常画面起動

1. `/api/setup/dependencies` を定期取得
2. `warn / error` がある場合は警告バナー表示
3. 各ページは個別に API を定期取得

### 遅延読込

- `SetupPage`
- `DashboardPage`
- `JobDetailPage`
- `ReferencePage`
- `SettingsPage`

上記は `React.lazy` + `Suspense` で遅延読込される。

## 画面別現状仕様

### 1. 初回セットアップ画面

**目的**
- 初回利用者向けの設定入力
- 依存関係確認

**表示ブロック**
- ヒーロー説明
- Step 1: 初回設定
- Step 2: 依存チェック
- Step 3: 配布前チェック

**入力項目**
- Gemini API Key
- Gemini Model
- note ID
- note Password
- PinchTab URL
- PinchTab Profile
- PinchTab Port
- localhost Port
- Playwrightをヘッドレスで動かす

**操作**
- 設定を保存
- Chromiumを導入

**API**
- `GET /api/setup/status`
- `GET /api/setup/dependencies`
- `POST /api/setup/save`
- `POST /api/setup/install-playwright`

**現状の表示特性**
- 保存成功時は短いテキスト表示
- 導入成功時はログ文字列を `<pre>` で表示
- 入力必須の視覚表現は未実装

### 2. ダッシュボード画面

**目的**
- 記事生成の実行
- 実行履歴の確認

**構成**
- 上段: 記事生成フォーム
- 下段: 実行履歴テーブル

**入力項目**
- キーワード
- 対象ジャンル
- 使用アカウント
- プロンプト
- 想定価格
- 販売モード
- 参考資料
- 補足指示
- 画像トグル
- グラフトグル
- 販売導線トグル

**操作**
- 生成開始

**実行結果**
- 成功時はジョブ詳細へ自動遷移

**履歴一覧の表示項目**
- キーワード
- ジャンル
- 販売
- 状態
- 詳細リンク

**API**
- `GET /api/note-accounts`
- `GET /api/prompt-templates`
- `GET /api/reference-materials`
- `GET /api/generation-jobs`
- `POST /api/generation-jobs`

### 3. 記事詳細画面

**目的**
- 生成済み記事の確認
- 再実行系操作
- note 保存 / 公開

**表示ブロック**
- 上部ヘッダー
- 無料部分 / 有料導線 / 有料部分
- 本文 / アイキャッチ・グラフ
- 参考資料
- 保存履歴 / 実行ログ

**操作**
- グラフ再生成
- 販売設定反映
- noteへ下書き保存
- noteへ公開

**表示項目**
- タイトル
- 無料部分
- 有料導線
- 有料部分
- 本文
- 画像 / グラフ要約
- 参考資料一覧
- 保存履歴
- 実行ログ

**API**
- `GET /api/generation-jobs/:id`
- `POST /api/generation-jobs/:id/generate-graphs`
- `POST /api/generation-jobs/:id/apply-note-sale-settings`
- `POST /api/generation-jobs/:id/save-note`
- `POST /api/generation-jobs/:id/publish-note`

**現状の表示特性**
- 保存履歴は `method / result / URL` をテキストで連結
- 実行ログは `[level] message` のテキスト表示
- 実画像プレビューは未実装

### 4. 参考資料管理画面

**目的**
- 記事生成に使う参考資料の登録

**構成**
- 上段: 取込フォーム
- 下段: 登録済み一覧

**入力項目**
- タイトル
- ソース種類
- ジャンル
- タグ
- 本文 / URL / ファイルパス

**操作**
- 取り込む

**表示項目**
- タイトル
- 要約

**API**
- `GET /api/reference-materials`
- `POST /api/reference-materials/import`

### 5. 設定 / 診断画面

**目的**
- 基本設定の変更
- 診断結果の表示
- noteアカウント追加

**構成**
- 上段: 設定 / 診断
- 下段: noteアカウント

**設定項目**
- localhost Port
- Gemini Model

**診断表示**
- `diagnostics`
- `setup-dependencies`

**アカウント項目**
- 表示名
- 保存優先順位

**操作**
- 設定を保存
- アカウント追加

**API**
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/diagnostics/run`
- `GET /api/setup/dependencies`
- `GET /api/note-accounts`
- `POST /api/note-accounts`

## デザイン特性

### 配色

- 背景: ベージュ系グラデーション
- 主要濃色: `ink`
- 強調色: `gold`
- 成功: 緑系
- 警告: 黄系
- エラー: 赤系

### タイポグラフィ

- 和文UI向けサンセリフ
- 見出しは太字寄り
- セクションラベルは uppercase と letter spacing を使用

### コンポーネント傾向

- 角丸が大きい
- ボーダー + 薄背景のカード
- 余白広め
- 情報をカード単位で区切る

## 現状の制約

- 実行履歴に日時列がない
- 現在地ナビがない
- フォーム補助説明が少ない
- 詳細画面に編集UIはなく、再生成中心
- 設定画面に Playwright / PinchTab 詳細設定編集がまだない
- モーダル、トースト、インラインバリデーションがない

## 現状UIの長所

- 主要導線が少なく迷いにくい
- 初回セットアップと通常利用が分かれている
- 記事生成から公開までの流れが短い
- 画面ごとの責務は大きくは崩れていない

## 現状UIの弱点

- ダッシュボードの情報量が多い
- 履歴の管理機能が弱い
- 成功 / 失敗の視認性が弱い
- 設定画面が混在気味
- 購入者向けの補助文がまだ足りない

## 関連ファイル

- `apps/web/src/App.tsx`
- `apps/web/src/components/ui.tsx`
- `apps/web/src/pages/SetupPage.tsx`
- `apps/web/src/pages/DashboardPage.tsx`
- `apps/web/src/pages/JobDetailPage.tsx`
- `apps/web/src/pages/ReferencePage.tsx`
- `apps/web/src/pages/SettingsPage.tsx`
- `UI_SPECIFICATION.md`
