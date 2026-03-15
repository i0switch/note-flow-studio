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
| API-024 | POST | /reference-materials/import | 参考資料取込 |
| API-025 | GET | /reference-materials | 参考資料一覧 |
| API-026 | POST | /generation-jobs/{id}/generate-graphs | グラフ生成 |
| API-027 | POST | /generation-jobs/{id}/generate-sales-copy | 有料導線生成 |
| API-028 | POST | /generation-jobs/{id}/apply-note-sale-settings | note販売設定反映 |
| API-029 | GET | /sales-profiles | 販売プロファイル一覧 |

## 7-3. 主要API詳細

### API-001 POST /generation-jobs
```json
{
  "keyword": "Codex アプリ",
  "noteAccountId": 1,
  "promptTemplateId": 2,
  "aiProviderId": 1,
  "targetGenre": "business",
  "referenceMaterialIds": [11, 12],
  "imageEnabled": true,
  "graphEnabled": true,
  "imageProfileId": 3,
  "salesProfileId": 2,
  "monetizationEnabled": true,
  "desiredPriceYen": 980,
  "additionalInstruction": "初心者向けにわかりやすく"
}
```

### API-007 POST /generation-jobs/{id}/save-note
```json
{
  "forceMethod": null,
  "noteAccountId": 1,
  "applySaleSettings": true
}
```

**レスポンス例**
```json
{
  "result": "success",
  "methodUsed": "pinchtab",
  "saleSettingStatus": "applied",
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

### API-024 POST /reference-materials/import
```json
{
  "sourceType": "url",
  "sourceValue": "https://example.com/report",
  "title": "市場レポート",
  "genreLabel": "business",
  "tags": ["調査", "市場"]
}
```

### API-028 POST /generation-jobs/{id}/apply-note-sale-settings
```json
{
  "priceYen": 980,
  "freePreviewRatio": 0.35,
  "transitionCtaText": "ここから先で、実際に売れる構成と導線を具体例つきで解説する"
}
```

**レスポンス例**
```json
{
  "result": "success",
  "methodUsed": "playwright",
  "saleSettingStatus": "applied"
}
```

## 7-4. エラーレスポンス共通仕様
```json
{
  "error": {
    "code": "NOTE_SALE_SETTING_UNSUPPORTED",
    "message": "選択した保存方式では販売設定を適用できません"
  }
}
```

---
