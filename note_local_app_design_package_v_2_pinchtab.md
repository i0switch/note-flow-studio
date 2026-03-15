# note記事自動生成・下書き保存ローカルアプリ 統合設計書 v2（PinchTab連携版）

## 0. 文書概要

### 0-1. 目的
本書は、以下の機能を持つ買い切り型ローカルアプリについて、開発・実装・運用の基準となる統合設計を定義するものである。

- キーワードを入力して note 用記事を生成する
- 保存済みのプロンプトテンプレートを利用できる
- 使用する note アカウントを選択できる
- 必要に応じて画像生成を実行できる
- note に下書き保存できる
- note 非公式APIが失敗した場合、ブラウザ自動操作へフォールバックできる
- ブラウザ自動操作は Playwright と PinchTab を併用できる
- 将来、X 投稿用の派生出力に対応できる

### 0-2. この版の位置づけ
本版では、従来の「note 非公式API + Playwright フォールバック」に加え、PinchTab をブラウザ操作基盤として設計に組み込む。

### 0-3. 文書構成
本書には以下を含む。

1. 要件定義書
2. 画面一覧・画面仕様書
3. ワイヤーフレーム
4. 機能一覧
5. ユースケース一覧
6. DB設計書
7. API仕様書
8. 業務ルール・例外ルール集
9. 権限設計書
10. 技術方針書

### 0-4. システム前提
- 配布形態: 買い切りアプリ
- 動作形態: ローカル動作
- UI: ブラウザUI（localhost）
- 自動化範囲: 準自動
- 保存先の主対象: note 下書き
- 将来拡張: X 投稿用原稿生成および投稿連携
- ブラウザ操作基盤: Playwright + PinchTab

---

# 1. 要件定義書

## 1-1. システム名称
仮称: note Local Draft Studio

## 1-2. 背景
note 記事作成では以下の課題がある。

- 記事の構成作成、本文作成、整形に時間がかかる
- 記事スタイルや文体を都度再現するのが面倒
- 画像生成を記事ごとに切り替えたい
- note への保存を手動で行うのが非効率
- 複数アカウントや複数テンプレートを使い分けたい
- note ログイン済み状態を安定的に再利用したい
- 将来、note 以外の媒体にも派生させたい

## 1-3. 目的
本アプリは、指定キーワードと設定情報から note 用記事を生成し、必要に応じて画像生成を行い、note に下書き保存するまでの作業を効率化することを目的とする。

## 1-4. 対象ユーザー
- 主対象: 購入者本人
- 想定利用者: 1人利用中心
- 将来想定: 少人数運用、媒体追加、機能追加

## 1-5. 解決したい業務課題
- note 記事の量産効率向上
- 記事スタイルの再現性向上
- 複数生成AIの使い分け
- note アカウントごとの運用最適化
- 下書き保存までの作業自動化
- ブラウザログイン状態の使い回し最適化

## 1-6. スコープ

### スコープ内
- 記事生成
- プロンプトテンプレート管理
- note アカウント管理
- AIプロバイダ設定管理
- 画像生成設定管理
- note 下書き保存
- フォールバック実行
- PinchTab 連携
- Playwright 連携
- 実行履歴管理
- 再編集・再生成
- 将来の X 出力基盤のための内部構造保持

### スコープ外
- note の公開実行
- 公開スケジュール実行
- チーム向け詳細権限制御
- クラウド同期
- 課金管理

## 1-7. 業務要件
1. ユーザーはキーワード等を指定して記事生成を開始できること
2. ユーザーは保存済みプロンプト名を選択できること
3. ユーザーは note アカウントを選択できること
4. ユーザーは画像生成有無を選択できること
5. ユーザーは補足指示を入力できること
6. システムは選択したAIプロバイダを用いて記事生成できること
7. システムは画像生成が必要な場合に画像生成ジョブを実行できること
8. システムは note 非公式APIで下書き保存を試みること
9. 非公式API失敗時、条件に応じて Playwright または PinchTab にフォールバックできること
10. 実行結果を履歴として保持できること
11. 生成済み記事を再編集・再保存できること
12. note アカウントごとにブラウザ自動操作方式を分けられること
13. PinchTab のプロファイルを note アカウントごとに管理できること

## 1-8. 非機能要件

### 性能
- 一般的な1記事生成は数十秒〜数分以内を目安とする
- UI操作に対し、主要画面の初期表示はローカル環境で快適に行えること

### 可用性
- ローカル動作のため、アプリ自体は単体PCで完結可能であること
- AI API未接続時でも設定閲覧や履歴閲覧は可能であること
- PinchTab 未使用時でも Playwright で運用可能であること

### 保守性
- AIプロバイダ追加が容易な構成であること
- 媒体アダプタ追加が容易な構成であること
- ブラウザ操作アダプタを差し替え可能な構成であること

### セキュリティ
- APIキーは安全にローカル保存すること
- 認証情報の表示はマスクすること
- note セッション情報は分離管理すること
- PinchTab トークンを安全に保持すること

### 拡張性
- 将来、X用派生出力に対応できること
- 将来、媒体アダプタ追加に対応できること
- 将来、ブラウザ操作先を note 以外へ広げられること

## 1-9. 成功条件
- 指定キーワードから再現性のある記事生成ができる
- note 下書き保存まで準自動化できる
- 複数AI / 複数noteアカウント / 複数プロンプトの運用が成立する
- Playwright と PinchTab の両方を選択可能にできる

---

# 2. 画面一覧・画面仕様書

## 2-1. 画面一覧

| 画面ID | 画面名 | 目的 |
|---|---|---|
| SCR-001 | ダッシュボード / 記事生成画面 | 記事生成の実行 |
| SCR-002 | 実行履歴一覧 | 実行結果の確認 |
| SCR-003 | 記事詳細 / 再編集画面 | 生成結果の編集・再保存 |
| SCR-004 | プロンプト管理一覧 | テンプレート確認 |
| SCR-005 | プロンプト編集画面 | テンプレート作成・編集 |
| SCR-006 | noteアカウント一覧 | noteアカウント管理 |
| SCR-007 | noteアカウント編集画面 | noteアカウント設定・セッション管理 |
| SCR-008 | AI設定画面 | APIキー・OAuth設定 |
| SCR-009 | 画像生成設定画面 | 画像生成方式・既定値管理 |
| SCR-010 | システム設定画面 | 全体設定・既定値 |
| SCR-011 | 接続確認 / 診断画面 | API・保存経路の確認 |
| SCR-012 | ブラウザ操作設定画面 | Playwright / PinchTab 設定 |

## 2-2. 画面仕様書

### SCR-001 ダッシュボード / 記事生成画面
**目的**
記事生成の起点となる主画面。

**主な入力項目**
- キーワード
- 使用アカウント
- プロンプト名
- 画像あり/なし
- 補足指示
- 本文生成AI
- 画像生成方式

**主な表示項目**
- 現在の既定設定
- 直近実行結果
- 実行状態
- 保存先方式
- フォールバック経路

**主な操作**
- 記事生成開始
- 下書き保存まで実行
- 生成だけ実行
- フォールバック設定確認

### SCR-002 実行履歴一覧
**主な表示項目**
- 実行日時
- キーワード
- アカウント名
- プロンプト名
- 本文生成AI
- 保存結果
- フォールバック有無
- 使用保存方式
- 下書きURL
- ステータス

### SCR-003 記事詳細 / 再編集画面
**主な表示項目**
- タイトル
- リード
- 本文
- 画像プロンプト
- 生成画像一覧
- 保存ログ
- エラーログ
- 保存アダプタ履歴

**主な操作**
- タイトル再生成
- 本文再生成
- 画像再生成
- noteへ再保存
- 他アカウントへ保存
- 保存方式を指定して再保存

### SCR-005 プロンプト編集画面
**入力項目**
- プロンプト名
- 用途
- 対象媒体
- 本文システムプロンプト
- 本文ユーザープロンプトテンプレート
- 画像プロンプトテンプレート
- 推奨AI
- 既定文字数帯
- メモ

### SCR-007 noteアカウント編集画面
**入力項目**
- 表示名
- 保存方式優先順位
- ブラウザ操作方式優先順位
- Playwright セッション設定
- PinchTab プロファイル設定
- 既定プロンプト
- 既定画像設定
- フォールバック設定

### SCR-008 AI設定画面
**対象**
- Gemini API
- OpenAI API
- Claude API
- Codex OAuth

### SCR-009 画像生成設定画面
**入力項目**
- 有効/無効
- 生成方式
- 生成枚数
- 用途（アイキャッチ / 挿絵）
- 比率
- サイズ
- スタイル補足

### SCR-010 システム設定画面
**入力項目**
- localhost ポート
- ログ保存期間
- 自動バックアップ有無
- 再試行回数
- タイムアウト秒
- デバッグログ有無
- PinchTab ベースURL
- PinchTab トークン使用有無

### SCR-011 接続確認 / 診断画面
**確認対象**
- 各AI API接続
- Codex OAuth状態
- note API疎通
- Playwright起動可否
- PinchTab疎通
- アカウント別保存テスト

### SCR-012 ブラウザ操作設定画面
**目的**
ブラウザ自動操作の詳細設定を管理する。

**入力項目**
- 既定ブラウザ操作方式
- Playwright 有効/無効
- PinchTab 有効/無効
- PinchTab ベースURL
- PinchTab 認証トークン
- Playwright 永続プロファイルパス
- PinchTab プロファイル名ルール
- 操作前確認有無

---

# 3. ワイヤーフレーム

## 3-1. SCR-001 記事生成画面

```text
+-------------------------------------------------------------+
| ヘッダ: note Local Draft Studio                             |
+----------------------+--------------------------------------+
| サイドメニュー       | 記事生成                             |
| - 記事生成           |--------------------------------------|
| - 実行履歴           | キーワード      [                ]   |
| - プロンプト管理     | 使用アカウント  [note_main ▼     ]   |
| - noteアカウント     | プロンプト名    [SEO記事 ▼        ]   |
| - AI設定             | 本文生成AI      [Gemini ▼         ]   |
| - 画像設定           | 画像あり/なし   [ON/OFF]              |
| - ブラウザ操作設定   | 画像生成方式    [Google Flow ▼    ]   |
| - システム設定       | 補足指示        [                ]   |
|                      |                                      |
|                      | [生成のみ] [下書き保存まで実行]      |
|                      |                                      |
|                      | 保存経路: API → Playwright → PinchTab|
|                      | 実行ログ / 直近結果                  |
+----------------------+--------------------------------------+
```

## 3-2. SCR-002 実行履歴一覧

```text
+-------------------------------------------------------------+
| 実行履歴                                                    |
+-------------------------------------------------------------+
| 検索 [        ] ステータス[▼] AI[▼] 保存方式[▼]            |
+-------------------------------------------------------------+
| 日時 | キーワード | AI | 保存結果 | 使用方式 | 詳細       |
|------|------------|----|----------|----------|------------|
| ...                                                        |
+-------------------------------------------------------------+
```

## 3-3. SCR-003 記事詳細 / 再編集画面

```text
+-------------------------------------------------------------+
| 記事詳細                                                    |
+-------------------------------------------------------------+
| タイトル [                                              ]   |
| リード   [                                              ]   |
|-------------------------------------------------------------|
| 本文                                                        |
| [                                                       ]   |
|-------------------------------------------------------------|
| 画像プロンプト                                              |
| [                                                       ]   |
|-------------------------------------------------------------|
| 保存履歴                                                    |
| API失敗 → Playwright失敗 → PinchTab成功                    |
|-------------------------------------------------------------|
| [タイトル再生成] [本文再生成] [画像再生成] [再保存]        |
+-------------------------------------------------------------+
```

## 3-4. SCR-012 ブラウザ操作設定画面

```text
+-------------------------------------------------------------+
| ブラウザ操作設定                                            |
+-------------------------------------------------------------+
| 既定方式          [Auto ▼]                                 |
| Playwright        [有効]                                    |
| プロファイルパス  [                           ]             |
|-------------------------------------------------------------|
| PinchTab          [有効]                                    |
| Base URL          [http://localhost:9867      ]             |
| 認証トークン      [***************            ]             |
| プロファイル命名  [note_{account_name}        ]             |
|-------------------------------------------------------------|
| [接続確認] [保存]                                           |
+-------------------------------------------------------------+
```

---

# 4. 機能一覧

## 4-1. 機能一覧表

| 機能ID | 機能名 | 区分 | 概要 |
|---|---|---|---|
| F-001 | 記事生成実行 | 主要 | 指定条件で記事を生成する |
| F-002 | 画像生成実行 | 主要 | 条件に応じて画像を生成する |
| F-003 | note下書き保存 | 主要 | noteへ下書き保存する |
| F-004 | note保存フォールバック | 主要 | 非公式API失敗時に別経路へ切替 |
| F-005 | 実行履歴管理 | 主要 | 実行結果を保存・検索する |
| F-006 | 記事詳細表示 | 主要 | 生成済み結果を詳細表示する |
| F-007 | タイトル再生成 | 主要 | タイトルのみ再生成する |
| F-008 | 本文再生成 | 主要 | 本文のみ再生成する |
| F-009 | 画像再生成 | 主要 | 画像のみ再生成する |
| F-010 | 再保存 | 主要 | noteへ再保存する |
| F-011 | プロンプト管理 | 管理 | テンプレートを管理する |
| F-012 | noteアカウント管理 | 管理 | noteアカウント設定を管理する |
| F-013 | AI設定管理 | 管理 | APIキー/OAuthを管理する |
| F-014 | 画像設定管理 | 管理 | 画像生成の既定値を管理する |
| F-015 | システム設定管理 | 管理 | 全体設定を管理する |
| F-016 | 接続診断 | 補助 | 接続確認と診断を行う |
| F-017 | ログ出力 | 補助 | 実行ログ・エラーログを出力する |
| F-018 | 記事複製 | 補助 | 過去記事を複製して再利用する |
| F-019 | 他アカウント保存 | 補助 | 別noteアカウントに保存する |
| F-020 | X派生原稿生成 | 将来 | X投稿向け原稿を生成する |
| F-021 | Playwright保存アダプタ | 主要 | Playwright で note 保存する |
| F-022 | PinchTab保存アダプタ | 主要 | PinchTab で note 保存する |
| F-023 | PinchTab接続確認 | 補助 | PinchTab の疎通確認を行う |
| F-024 | ブラウザ操作方式選択 | 管理 | アカウント別に方式を設定する |

## 4-2. 優先度

### v1 必須
- F-001, F-003, F-004, F-005, F-006, F-007, F-008, F-010, F-011, F-012, F-013, F-015, F-016, F-017, F-021

### v1 推奨
- F-002, F-009, F-014, F-018, F-019, F-022, F-023, F-024

### 将来
- F-020

---

# 5. ユースケース一覧

## 5-1. ユースケース表

| UC-ID | ユースケース名 | 主役 |
|---|---|---|
| UC-001 | 記事を新規生成する | ユーザー |
| UC-002 | 画像付きで記事を生成する | ユーザー |
| UC-003 | noteへ下書き保存する | システム |
| UC-004 | note保存失敗時にフォールバックする | システム |
| UC-005 | 実行履歴を確認する | ユーザー |
| UC-006 | 記事を再編集する | ユーザー |
| UC-007 | タイトルだけ再生成する | ユーザー |
| UC-008 | 本文だけ再生成する | ユーザー |
| UC-009 | 画像だけ再生成する | ユーザー |
| UC-010 | 別アカウントへ再保存する | ユーザー |
| UC-011 | プロンプトを新規作成する | ユーザー |
| UC-012 | noteアカウントを追加する | ユーザー |
| UC-013 | API接続を設定する | ユーザー |
| UC-014 | 接続診断を行う | ユーザー |
| UC-015 | PinchTab を設定する | ユーザー |
| UC-016 | 保存方式を指定して再保存する | ユーザー |

## 5-2. 主要ユースケース記述

### UC-001 記事を新規生成する
**事前条件**
- AI設定が完了している
- 使用するアカウントが登録済みである
- 使用するプロンプトが登録済みである

**基本フロー**
1. ユーザーは記事生成画面を開く
2. キーワードを入力する
3. 使用アカウントを選択する
4. プロンプト名を選択する
5. 画像有無を選択する
6. 補足指示を入力する
7. 実行ボタンを押す
8. システムは記事生成を実行する
9. システムは結果を保存する
10. システムは結果を表示する

### UC-003 noteへ下書き保存する
**基本フロー**
1. システムは note 非公式APIで保存を試行する
2. 保存成功時、下書きURLを取得する
3. 実行履歴に保存する

### UC-004 note保存失敗時にフォールバックする
**基本フロー**
1. 非公式API保存が失敗する
2. システムは再試行条件を判定する
3. 条件一致時、設定されたブラウザ操作方式へ切り替える
4. Playwright または PinchTab で保存を試行する
5. 成功時、下書きURLを履歴に保存する

### UC-015 PinchTab を設定する
**基本フロー**
1. ユーザーはブラウザ操作設定画面を開く
2. PinchTab の Base URL を入力する
3. 必要に応じてトークンを入力する
4. 接続確認を行う
5. 成功時、システムは設定を保存する

---

# 6. DB設計書

## 6-1. DB方針
- ローカルDBとして SQLite を採用する
- 論理設計は媒体拡張可能な形にする
- ブラウザ操作アダプタもDB設定で切り替え可能とする

## 6-2. テーブル一覧

| テーブル名 | 概要 |
|---|---|
| app_settings | システム設定 |
| ai_providers | AIプロバイダ定義 |
| ai_provider_credentials | AI認証情報 |
| prompt_templates | プロンプトテンプレート |
| note_accounts | noteアカウント |
| note_account_sessions | noteセッション情報 |
| browser_automation_profiles | ブラウザ操作設定 |
| image_profiles | 画像生成プロファイル |
| generation_jobs | 実行ジョブ |
| generated_articles | 生成記事 |
| generated_images | 生成画像 |
| save_attempts | 保存試行履歴 |
| execution_logs | 実行ログ |
| x_export_profiles | 将来拡張用X出力設定 |

## 6-3. テーブル定義

### app_settings
| カラム名 | 型 | PK | 必須 | 説明 |
|---|---|---|---|---|
| id | INTEGER | ○ | ○ | 固定ID |
| localhost_port | INTEGER |  | ○ | UIポート |
| default_timeout_sec | INTEGER |  | ○ | タイムアウト秒 |
| default_retry_count | INTEGER |  | ○ | 再試行回数 |
| log_retention_days | INTEGER |  | ○ | ログ保持日数 |
| debug_mode | INTEGER |  | ○ | 0/1 |
| pinchtab_base_url | TEXT |  |  | Base URL |
| pinchtab_token_ref | TEXT |  |  | トークン参照 |
| created_at | TEXT |  | ○ | 作成日時 |
| updated_at | TEXT |  | ○ | 更新日時 |

### ai_providers
| カラム名 | 型 | PK | 必須 | 説明 |
|---|---|---|---|---|
| id | INTEGER | ○ | ○ | ID |
| provider_type | TEXT |  | ○ | gemini/openai/claude/codex_oauth |
| display_name | TEXT |  | ○ | 表示名 |
| auth_mode | TEXT |  | ○ | api_key/oauth |
| is_enabled | INTEGER |  | ○ | 0/1 |
| created_at | TEXT |  | ○ | 作成日時 |
| updated_at | TEXT |  | ○ | 更新日時 |

### ai_provider_credentials
| カラム名 | 型 | PK | 必須 | 説明 |
|---|---|---|---|---|
| id | INTEGER | ○ | ○ | ID |
| ai_provider_id | INTEGER | FK | ○ | ai_providers.id |
| credential_label | TEXT |  | ○ | ラベル |
| secret_ref | TEXT |  | ○ | 秘匿情報参照先 |
| extra_config_json | TEXT |  |  | 追加設定 |
| last_verified_at | TEXT |  |  | 最終確認日時 |
| created_at | TEXT |  | ○ | 作成日時 |
| updated_at | TEXT |  | ○ | 更新日時 |

### prompt_templates
| カラム名 | 型 | PK | 必須 | 説明 |
|---|---|---|---|---|
| id | INTEGER | ○ | ○ | ID |
| name | TEXT |  | ○ | プロンプト名 |
| purpose | TEXT |  | ○ | 用途 |
| target_media | TEXT |  | ○ | note など |
| article_system_prompt | TEXT |  | ○ | 本文システムプロンプト |
| article_user_prompt_template | TEXT |  | ○ | 本文ユーザーテンプレート |
| image_prompt_template | TEXT |  |  | 画像テンプレート |
| recommended_ai_provider_id | INTEGER | FK |  | 推奨AI |
| default_length_band | TEXT |  |  | 文字数帯 |
| is_active | INTEGER |  | ○ | 0/1 |
| memo | TEXT |  |  | メモ |
| created_at | TEXT |  | ○ | 作成日時 |
| updated_at | TEXT |  | ○ | 更新日時 |

### note_accounts
| カラム名 | 型 | PK | 必須 | 説明 |
|---|---|---|---|---|
| id | INTEGER | ○ | ○ | ID |
| display_name | TEXT |  | ○ | 表示名 |
| default_prompt_template_id | INTEGER | FK |  | 既定プロンプト |
| default_image_profile_id | INTEGER | FK |  | 既定画像設定 |
| save_mode_priority | TEXT |  | ○ | api_first/browser_first |
| browser_adapter_priority | TEXT |  | ○ | playwright_first/pinchtab_first/auto |
| fallback_enabled | INTEGER |  | ○ | 0/1 |
| is_active | INTEGER |  | ○ | 0/1 |
| last_verified_at | TEXT |  |  | 最終確認 |
| created_at | TEXT |  | ○ | 作成日時 |
| updated_at | TEXT |  | ○ | 更新日時 |

### note_account_sessions
| カラム名 | 型 | PK | 必須 | 説明 |
|---|---|---|---|---|
| id | INTEGER | ○ | ○ | ID |
| note_account_id | INTEGER | FK | ○ | note_accounts.id |
| session_type | TEXT |  | ○ | playwright/pinchtab |
| session_storage_path | TEXT |  |  | Playwright 用保存先 |
| external_profile_name | TEXT |  |  | PinchTab プロファイル名 |
| session_status | TEXT |  | ○ | valid/expired/unknown |
| last_login_at | TEXT |  |  | 最終ログイン |
| created_at | TEXT |  | ○ | 作成日時 |
| updated_at | TEXT |  | ○ | 更新日時 |

### browser_automation_profiles
| カラム名 | 型 | PK | 必須 | 説明 |
|---|---|---|---|---|
| id | INTEGER | ○ | ○ | ID |
| profile_name | TEXT |  | ○ | プロファイル名 |
| adapter_type | TEXT |  | ○ | playwright/pinchtab |
| is_enabled | INTEGER |  | ○ | 0/1 |
| config_json | TEXT |  |  | 設定JSON |
| last_verified_at | TEXT |  |  | 最終確認 |
| created_at | TEXT |  | ○ | 作成日時 |
| updated_at | TEXT |  | ○ | 更新日時 |

### image_profiles
| カラム名 | 型 | PK | 必須 | 説明 |
|---|---|---|---|---|
| id | INTEGER | ○ | ○ | ID |
| profile_name | TEXT |  | ○ | プロファイル名 |
| generator_type | TEXT |  | ○ | google_flow/antigravity/none |
| enabled | INTEGER |  | ○ | 0/1 |
| image_count | INTEGER |  | ○ | 枚数 |
| image_role | TEXT |  | ○ | cover/inline/both |
| aspect_ratio | TEXT |  |  | 比率 |
| size_preset | TEXT |  |  | サイズ |
| style_instruction | TEXT |  |  | 追加指示 |
| created_at | TEXT |  | ○ | 作成日時 |
| updated_at | TEXT |  | ○ | 更新日時 |

### generation_jobs
| カラム名 | 型 | PK | 必須 | 説明 |
|---|---|---|---|---|
| id | INTEGER | ○ | ○ | ID |
| keyword | TEXT |  | ○ | キーワード |
| note_account_id | INTEGER | FK | ○ | 使用アカウント |
| prompt_template_id | INTEGER | FK | ○ | 使用プロンプト |
| ai_provider_id | INTEGER | FK | ○ | 使用AI |
| image_profile_id | INTEGER | FK |  | 使用画像設定 |
| image_enabled | INTEGER |  | ○ | 0/1 |
| additional_instruction | TEXT |  |  | 補足指示 |
| status | TEXT |  | ○ | queued/running/succeeded/failed/partial |
| created_at | TEXT |  | ○ | 作成日時 |
| updated_at | TEXT |  | ○ | 更新日時 |

### generated_articles
| カラム名 | 型 | PK | 必須 | 説明 |
|---|---|---|---|---|
| id | INTEGER | ○ | ○ | ID |
| generation_job_id | INTEGER | FK | ○ | generation_jobs.id |
| internal_format_json | TEXT |  | ○ | 構造化記事 |
| title | TEXT |  | ○ | タイトル |
| lead_text | TEXT |  |  | リード |
| body_markdown | TEXT |  | ○ | 本文Markdown |
| note_rendered_body | TEXT |  | ○ | note向け整形本文 |
| x_export_text | TEXT |  |  | 将来拡張 |
| status | TEXT |  | ○ | generated/edited/saved |
| created_at | TEXT |  | ○ | 作成日時 |
| updated_at | TEXT |  | ○ | 更新日時 |

### generated_images
| カラム名 | 型 | PK | 必須 | 説明 |
|---|---|---|---|---|
| id | INTEGER | ○ | ○ | ID |
| generation_job_id | INTEGER | FK | ○ | generation_jobs.id |
| image_role | TEXT |  | ○ | cover/inline |
| prompt_text | TEXT |  | ○ | 画像プロンプト |
| file_path | TEXT |  |  | ローカル保存先 |
| provider_response_ref | TEXT |  |  | 応答参照 |
| status | TEXT |  | ○ | generated/failed |
| created_at | TEXT |  | ○ | 作成日時 |
| updated_at | TEXT |  | ○ | 更新日時 |

### save_attempts
| カラム名 | 型 | PK | 必須 | 説明 |
|---|---|---|---|---|
| id | INTEGER | ○ | ○ | ID |
| generation_job_id | INTEGER | FK | ○ | generation_jobs.id |
| method | TEXT |  | ○ | unofficial_api/playwright/pinchtab |
| attempt_no | INTEGER |  | ○ | 試行回数 |
| result | TEXT |  | ○ | success/failed |
| draft_url | TEXT |  |  | 下書きURL |
| error_code | TEXT |  |  | エラーコード |
| error_message | TEXT |  |  | エラー内容 |
| started_at | TEXT |  | ○ | 開始日時 |
| finished_at | TEXT |  |  | 終了日時 |

### execution_logs
| カラム名 | 型 | PK | 必須 | 説明 |
|---|---|---|---|---|
| id | INTEGER | ○ | ○ | ID |
| generation_job_id | INTEGER | FK |  | generation_jobs.id |
| log_level | TEXT |  | ○ | info/warn/error |
| category | TEXT |  | ○ | article/image/save/auth/browser/system |
| message | TEXT |  | ○ | ログ本文 |
| detail_json | TEXT |  |  | 詳細 |
| created_at | TEXT |  | ○ | 作成日時 |

## 6-4. 主なリレーション
- note_accounts 1 - n generation_jobs
- prompt_templates 1 - n generation_jobs
- ai_providers 1 - n generation_jobs
- generation_jobs 1 - 1 generated_articles
- generation_jobs 1 - n generated_images
- generation_jobs 1 - n save_attempts
- generation_jobs 1 - n execution_logs
- note_accounts 1 - n note_account_sessions

---

# 7. API仕様書

## 7-1. API方針
- ローカルアプリ内部用APIとして REST 形式を採用する
- ベースURL: `http://localhost:{port}/api`
- JSON ベース
- PinchTab 連携は内部のアダプタ層で吸収する

## 7-2. API一覧

| API ID | メソッド | パス | 概要 |
|---|---|---|---|
| API-001 | POST | /generation-jobs | 記事生成ジョブ作成 |
| API-002 | GET | /generation-jobs | ジョブ一覧取得 |
| API-003 | GET | /generation-jobs/{id} | ジョブ詳細取得 |
| API-004 | POST | /generation-jobs/{id}/regenerate-title | タイトル再生成 |
| API-005 | POST | /generation-jobs/{id}/regenerate-body | 本文再生成 |
| API-006 | POST | /generation-jobs/{id}/regenerate-images | 画像再生成 |
| API-007 | POST | /generation-jobs/{id}/save-note | note保存実行 |
| API-008 | GET | /prompt-templates | プロンプト一覧 |
| API-009 | POST | /prompt-templates | プロンプト作成 |
| API-010 | PUT | /prompt-templates/{id} | プロンプト更新 |
| API-011 | GET | /note-accounts | noteアカウント一覧 |
| API-012 | POST | /note-accounts | noteアカウント作成 |
| API-013 | PUT | /note-accounts/{id} | noteアカウント更新 |
| API-014 | POST | /note-accounts/{id}/verify | 接続確認 |
| API-015 | GET | /ai-providers | AI設定一覧 |
| API-016 | POST | /ai-providers/{id}/verify | AI接続確認 |
| API-017 | GET | /image-profiles | 画像設定一覧 |
| API-018 | POST | /diagnostics/run | 総合診断 |
| API-019 | GET | /settings | システム設定取得 |
| API-020 | PUT | /settings | システム設定更新 |
| API-021 | GET | /browser-automation-profiles | ブラウザ操作設定一覧 |
| API-022 | POST | /browser-automation-profiles | ブラウザ操作設定作成 |
| API-023 | POST | /browser-automation/pinchtab/verify | PinchTab接続確認 |

## 7-3. 主要API詳細

### API-001 POST /generation-jobs
```json
{
  "keyword": "Codex アプリ",
  "noteAccountId": 1,
  "promptTemplateId": 2,
  "aiProviderId": 1,
  "imageEnabled": true,
  "imageProfileId": 3,
  "additionalInstruction": "初心者向けにわかりやすく"
}
```

### API-007 POST /generation-jobs/{id}/save-note
```json
{
  "forceMethod": null,
  "noteAccountId": 1
}
```

**レスポンス例**
```json
{
  "result": "success",
  "methodUsed": "pinchtab",
  "draftUrl": "https://note.com/..."
}
```

### API-023 POST /browser-automation/pinchtab/verify
```json
{
  "baseUrl": "http://localhost:9867",
  "token": "********"
}
```

**レスポンス例**
```json
{
  "result": "success",
  "adapter": "pinchtab"
}
```

## 7-4. エラーレスポンス共通仕様
```json
{
  "error": {
    "code": "PINCHTAB_UNREACHABLE",
    "message": "PinchTab に接続できません"
  }
}
```

---

# 8. 業務ルール・例外ルール集

## 8-1. 業務ルール
1. 記事生成と note 保存は別工程として扱う
2. 画像生成は本文生成と別工程として扱う
3. note 保存に失敗しても生成済み記事は削除しない
4. 実行履歴は成功・失敗に関わらず残す
5. note アカウントごとに別設定を持つ
6. 品質ルールはアプリ固定ロジックではなくプロンプトで制御する
7. 公開処理は行わず、下書き保存までを対象とする
8. 生成記事は内部構造化形式と媒体向け整形形式の両方を保持する
9. 画像生成失敗時でも本文保存は続行する
10. 再編集後の再保存を許可する
11. ブラウザ操作方式はアカウントごとに設定可能とする

## 8-2. note保存ルール
1. 既定は非公式API優先とする
2. 非公式APIでタイムアウト、5xx、一時的通信失敗が発生した場合は再試行またはフォールバック判定を行う
3. 認証失敗時は即エラーとし、自動フォールバックしない
4. ブラウザ操作フォールバック先はアカウント設定に従う
5. Auto 設定時は Playwright を優先し、PinchTab は第2候補とする

## 8-3. フォールバックルール
1. 非公式API保存失敗時、再試行回数以内であれば再試行する
2. 再試行上限到達後、設定されたブラウザ操作方式へ移行する
3. Playwright 失敗時、PinchTab 有効なら PinchTab を試行可能とする
4. PinchTab 失敗時、Playwright 有効なら Playwright を試行可能とする
5. すべての試行結果を save_attempts に記録する

## 8-4. PinchTab運用ルール
1. PinchTab はローカル接続を前提とする
2. PinchTab トークンを使用する場合、秘匿情報として扱う
3. PinchTab プロファイルは note アカウントごとに分離する
4. PinchTab 未起動時は接続エラーとして扱う
5. PinchTab 連携は無効化可能とする

## 8-5. 画像生成ルール
1. 画像生成の有無はジョブ単位で選択可能とする
2. 画像生成方式はプロファイルで管理する
3. 画像生成失敗時は本文処理を止めない
4. アイキャッチと本文挿絵は役割を分けて保持する

## 8-6. 例外ルール

### AI API接続不可
- 記事生成は失敗
- UIへ接続エラー表示
- 実行履歴へ失敗記録保存

### noteセッション期限切れ
- 該当ブラウザ操作方式での保存は失敗
- 接続再確認を促す
- セッション状態を expired に更新

### PinchTab疎通不可
- PinchTab 保存は失敗
- 代替方式があればそちらへ移行
- ログへ接続失敗記録を残す

### 画像生成プロバイダ異常
- 画像生成のみ失敗扱い
- 本文生成結果は保持

---

# 9. 権限設計書

## 9-1. 権限方針
初期版は単一利用者前提とするため、厳密な多人数権限は採用しない。
ただし将来拡張に備え、論理上の権限区分を定義する。

## 9-2. 権限ロール

| ロール | 概要 |
|---|---|
| owner | アプリ購入者本人。全機能利用可 |
| editor | 将来拡張。記事生成・編集可 |
| viewer | 将来拡張。閲覧のみ |

## 9-3. 権限制御マトリクス

| 機能 | owner | editor | viewer |
|---|---|---|---|
| 記事生成 | ○ | ○ | × |
| 再編集 | ○ | ○ | × |
| note保存 | ○ | ○ | × |
| プロンプト管理 | ○ | ○ | × |
| noteアカウント管理 | ○ | × | × |
| AI設定管理 | ○ | × | × |
| ブラウザ操作設定 | ○ | × | × |
| システム設定変更 | ○ | × | × |
| 履歴閲覧 | ○ | ○ | ○ |
| 診断実行 | ○ | ○ | × |

## 9-4. 初期版の実装方針
- 初期版は owner 権限のみ実装対象とする
- ローカル単独利用前提のため、ログイン機能は必須としない
- 将来ユーザー管理を追加する場合、ロールベース制御を導入する

---

# 10. 技術方針書

## 10-1. 技術方針の要約
- UIはブラウザUIとする
- 実行環境はローカルPCとする
- DBは SQLite を採用する
- note 保存は二段構えを基本とし、ブラウザ保存基盤を複線化する
- AIプロバイダ層を分離する
- 媒体アダプタ層を分離する
- ブラウザ操作アダプタ層を分離する
- 記事内部形式は構造化データを保持する

## 10-2. 推奨アーキテクチャ

```text
[ Browser UI (localhost) ]
           |
[ Local App Backend API ]
           |
  +--------+---------+------------------+--------------------+
  |                  |                  |                    |
[ SQLite ]   [ AI Provider Layer ] [ Media Adapter Layer ] [ Browser Automation Adapter Layer ]
                 |                    |                    |
   +-------------+-------------+      |          +---------+----------+
   |             |             |      |          |                    |
 Gemini       OpenAI        Claude    |      Playwright           PinchTab
                                      |
                                 note unofficial API

                [ Optional: Codex OAuth Adapter ]
                [ Image Generation Adapter Layer ]
```

## 10-3. UI技術方針
- ブラウザUIで実装する
- localhost を自動で開くランチャーを持つ
- UIとロジックを分離する
- PC利用前提とする

## 10-4. バックエンド技術方針
- ローカルAPIサーバーを持つ
- ジョブ実行とUIリクエストを分離する
- 長時間処理は非同期ジョブ化する
- 生成・保存・画像処理・ブラウザ操作を別サービスとして分離可能な構造とする

## 10-5. note保存技術方針
- 第1経路: note 非公式API
- 第2経路: Playwright によるブラウザ自動操作
- 第3経路: PinchTab によるブラウザ自動操作
- 保存方式はアカウント単位で優先度を持てるようにする
- Playwright は永続プロファイル方式を採用する
- PinchTab はローカルHTTP APIとプロファイルを利用する

## 10-6. ブラウザ操作アダプタ方針
- ブラウザ操作は adapter interface を通して呼び出す
- 実装候補:
  - PlaywrightAdapter
  - PinchTabAdapter
- note 保存フローは adapter 非依存の共通手順を持つ
- 方式差分はアダプタ内部で吸収する

## 10-7. AI連携技術方針
- 標準APIプロバイダ
  - Gemini API
  - OpenAI API
  - Claude API
- 特殊実行プロバイダ
  - Codex OAuth
- AIプロバイダごとの差異は抽象化レイヤーで吸収する

## 10-8. 画像生成技術方針
- 画像生成は本文生成とは別モジュールにする
- 画像生成方式はプロファイル化する
- 失敗時も本文処理を継続可能にする

## 10-9. データ構造方針
- 記事は内部で構造化形式 JSON を保持する
- 媒体別出力は変換して生成する
- note 向け整形本文を別保持する
- 将来 X 向け文面を別保持可能とする

## 10-10. セキュリティ方針
- APIキーは平文保存しない
- マスク表示を基本とする
- セッション情報はアカウントごとに分離する
- PinchTab トークンは平文保存しない
- ログに秘匿情報を出力しない

## 10-11. ログ・診断方針
- 主要イベントは必ずログ出力する
- 保存経路ごとの失敗理由を記録する
- 接続診断画面から手動検証を可能にする
- PinchTab 疎通確認を独立診断項目にする

## 10-12. 将来拡張方針
- 媒体アダプタに X を追加可能にする
- AIプロバイダ追加可能にする
- クラウド同期やライセンス認証は別モジュールで追加可能にする
- PinchTab を note 以外の媒体操作にも再利用可能にする

---

# 11. 補足: 初期版の確定仕様まとめ

## 11-1. 初期版で確定している内容
- 買い切り配布
- ローカル動作
- UIはブラウザ
- 準自動
- 品質ルールはプロンプト管理
- note保存は非公式API + ブラウザ自動操作フォールバック
- browser automation は Playwright と PinchTab を併用可能
- noteアカウントごとに別設定
- 画像生成仕様はカスタム可能
- 入力項目は以下
  - キーワード
  - 使用アカウント
  - プロンプト名
  - 画像あり/なし
  - 補足指示
- 保存単位は履歴・生成物・保存結果を含めて採用
- 再編集あり
- 将来X対応を視野に入れる

## 11-2. 次工程で詰めるべき詳細
- 利用技術スタックの最終選定
- ライセンス方式
- ファイル保存先仕様
- UIデザインルール
- エラーメッセージ定義
- 実装優先順位の確定
- テーブルインデックス設計
- API詳細レスポンス定義
- PinchTab 具体操作フロー
- Playwright と PinchTab の切替条件詳細

---

# 12. 実装優先順位案

## Phase 1
- 記事生成画面
- プロンプト管理
- noteアカウント管理
- AI設定
- SQLite保存
- 実行履歴
- note非公式API保存
- Playwright保存アダプタ

## Phase 2
- PinchTab設定画面
- PinchTab保存アダプタ
- 再編集機能
- 画像生成機能
- 接続診断

## Phase 3
- X派生出力
- エクスポート機能
- ライセンス認証
- 更新機能

---

以上。

