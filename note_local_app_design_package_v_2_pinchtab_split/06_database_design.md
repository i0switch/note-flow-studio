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
| reference_materials | 参考資料 |
| sales_profiles | 販売プロファイル |
| image_profiles | 画像生成プロファイル |
| generation_jobs | 実行ジョブ |
| generated_articles | 生成記事 |
| generated_images | 生成画像 |
| generated_graphs | 生成グラフ |
| job_reference_materials | ジョブ別参考資料紐付け |
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
| genre_scope | TEXT |  |  | all/business/finance など |
| article_system_prompt | TEXT |  | ○ | 本文システムプロンプト |
| article_user_prompt_template | TEXT |  | ○ | 本文ユーザーテンプレート |
| reference_prompt_template | TEXT |  |  | 参考資料処理テンプレート |
| sales_transition_template | TEXT |  |  | 無料→有料導線テンプレート |
| graph_prompt_template | TEXT |  |  | グラフ生成テンプレート |
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
| default_sales_profile_id | INTEGER | FK |  | 既定販売設定 |
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

### reference_materials
| カラム名 | 型 | PK | 必須 | 説明 |
|---|---|---|---|---|
| id | INTEGER | ○ | ○ | ID |
| title | TEXT |  | ○ | 資料名 |
| source_type | TEXT |  | ○ | url/text/file |
| source_path_or_url | TEXT |  |  | 元URLまたはファイルパス |
| extracted_text | TEXT |  | ○ | 抽出本文 |
| summary_text | TEXT |  |  | 要約 |
| genre_label | TEXT |  |  | 想定ジャンル |
| tags_json | TEXT |  |  | タグ |
| trust_note | TEXT |  |  | 信頼度メモ |
| is_active | INTEGER |  | ○ | 0/1 |
| created_at | TEXT |  | ○ | 作成日時 |
| updated_at | TEXT |  | ○ | 更新日時 |

### sales_profiles
| カラム名 | 型 | PK | 必須 | 説明 |
|---|---|---|---|---|
| id | INTEGER | ○ | ○ | ID |
| profile_name | TEXT |  | ○ | プロファイル名 |
| sales_mode | TEXT |  | ○ | normal/free_paid |
| default_price_yen | INTEGER |  |  | 既定価格 |
| free_preview_ratio | REAL |  |  | 無料公開比率 |
| intro_cta_template | TEXT |  |  | 導入CTA |
| paid_transition_template | TEXT |  |  | 有料導線文 |
| bonus_text_template | TEXT |  |  | 特典説明 |
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
| eyecatch_focus_mode | TEXT |  |  | article_aligned/manual |
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
| sales_profile_id | INTEGER | FK |  | 使用販売設定 |
| image_enabled | INTEGER |  | ○ | 0/1 |
| graph_enabled | INTEGER |  | ○ | 0/1 |
| monetization_enabled | INTEGER |  | ○ | 0/1 |
| target_genre | TEXT |  |  | 対象ジャンル |
| desired_price_yen | INTEGER |  |  | 想定価格 |
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
| genre_label | TEXT |  |  | 確定ジャンル |
| lead_text | TEXT |  |  | リード |
| free_preview_markdown | TEXT |  |  | 無料部分 |
| paid_content_markdown | TEXT |  |  | 有料部分 |
| transition_cta_text | TEXT |  |  | 無料→有料導線 |
| sales_hook_text | TEXT |  |  | 販売フック |
| recommended_price_yen | INTEGER |  |  | 推奨価格 |
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
| content_anchor_json | TEXT |  |  | 生成根拠 |
| file_path | TEXT |  |  | ローカル保存先 |
| provider_response_ref | TEXT |  |  | 応答参照 |
| status | TEXT |  | ○ | generated/failed |
| created_at | TEXT |  | ○ | 作成日時 |
| updated_at | TEXT |  | ○ | 更新日時 |

### generated_graphs
| カラム名 | 型 | PK | 必須 | 説明 |
|---|---|---|---|---|
| id | INTEGER | ○ | ○ | ID |
| generation_job_id | INTEGER | FK | ○ | generation_jobs.id |
| graph_title | TEXT |  | ○ | グラフ名 |
| graph_type | TEXT |  | ○ | bar/line/pie/table など |
| source_basis_json | TEXT |  | ○ | 根拠データ |
| graph_spec_json | TEXT |  | ○ | 描画仕様 |
| file_path | TEXT |  |  | 出力画像パス |
| status | TEXT |  | ○ | generated/failed |
| created_at | TEXT |  | ○ | 作成日時 |
| updated_at | TEXT |  | ○ | 更新日時 |

### job_reference_materials
| カラム名 | 型 | PK | 必須 | 説明 |
|---|---|---|---|---|
| id | INTEGER | ○ | ○ | ID |
| generation_job_id | INTEGER | FK | ○ | generation_jobs.id |
| reference_material_id | INTEGER | FK | ○ | reference_materials.id |
| usage_role | TEXT |  | ○ | context/fact/check/citation |
| created_at | TEXT |  | ○ | 作成日時 |

### save_attempts
| カラム名 | 型 | PK | 必須 | 説明 |
|---|---|---|---|---|
| id | INTEGER | ○ | ○ | ID |
| generation_job_id | INTEGER | FK | ○ | generation_jobs.id |
| method | TEXT |  | ○ | unofficial_api/playwright/pinchtab |
| attempt_no | INTEGER |  | ○ | 試行回数 |
| result | TEXT |  | ○ | success/failed |
| draft_url | TEXT |  |  | 下書きURL |
| sale_setting_status | TEXT |  |  | not_required/applied/failed |
| sale_price_yen | INTEGER |  |  | 販売価格 |
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
| category | TEXT |  | ○ | article/image/graph/reference/sales/save/auth/browser/system |
| message | TEXT |  | ○ | ログ本文 |
| detail_json | TEXT |  |  | 詳細 |
| created_at | TEXT |  | ○ | 作成日時 |

## 6-4. 主なリレーション
- note_accounts 1 - n generation_jobs
- prompt_templates 1 - n generation_jobs
- ai_providers 1 - n generation_jobs
- sales_profiles 1 - n generation_jobs
- generation_jobs 1 - 1 generated_articles
- generation_jobs 1 - n generated_images
- generation_jobs 1 - n generated_graphs
- generation_jobs 1 - n job_reference_materials
- generation_jobs 1 - n save_attempts
- generation_jobs 1 - n execution_logs
- note_accounts 1 - n note_account_sessions
- reference_materials 1 - n job_reference_materials

---
