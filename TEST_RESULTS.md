# Test Results

最終更新: 2026-03-12

## Automated Verification

| Command | Result |
| --- | --- |
| `npm test` | pass |
| `npm run build` | pass |
| `npm run test:e2e` | pass |
| `npm run package:portable` | pass |
| `npm run verify:portable` | pass |

## Automated Matrix Coverage

| Area | Condition | Result |
| --- | --- | --- |
| Article build | `free_paid` mode with CTA/price | pass |
| Article build | `normal` mode without CTA/price | pass |
| Article build | auto genre inference | pass |
| References | `text` import | pass |
| References | `file` import | pass |
| References | `url` import with script/style stripping | pass |
| Assets | image on/off | pass |
| Assets | graph on/off | pass |
| Settings | get/update | pass |
| Note accounts | create/update | pass |
| Prompt templates | create/list | pass |
| Diagnostics | AI / Playwright / PinchTab / sale-setting status | pass |
| Save routing | unofficial API success | pass |
| Save routing | unofficial API fail -> Playwright fallback | pass |
| Save routing | unofficial API fail -> Playwright fail -> PinchTab fallback | pass |
| Save routing | all adapters fail | pass |
| Publish API | Playwright publish path | pass |
| Error handling | missing job save/publish | pass |
| Web UI | generate -> detail view | pass |
| Web UI | reference add -> generate -> draft save | pass |
| Web UI | generate -> publish | pass |

## Live note Verification

| Case | Result | Detail |
| --- | --- | --- |
| Diagnostics | pass | Gemini / Playwright / PinchTab reachable |
| PinchTab verify | pass | health check succeeded |
| Real draft save (`normal`, Playwright) | pass | `https://editor.note.com/notes/n581d9a1a8a41/edit/` |
| Real draft save (`free_paid`, Playwright) | pass | `https://editor.note.com/notes/n3d3cef282d63/edit/`, `saleSettingStatus=not_required` |
| Real publish (`normal`, Playwright) | pass | `https://note.com/mido_renai/n/na8213f4a42c8` |
| Real publish (`free_paid`, Playwright) | pass | `https://note.com/mido_renai/n/ne120f5b2b136`, `saleSettingStatus=applied` |
| Real draft save (`normal`, PinchTab) | pass | `https://editor.note.com/notes/n755e02fb4c89/edit/` |
| Real publish (`free_paid`, PinchTab) | pass | `https://note.com/mido_renai/n/nd033112a4528`, `saleSettingStatus=applied` |
| Force unofficial API only | expected fail | API URL not configured |
| Force PinchTab only | pass | real PinchTab CDP session で保存 / 公開を確認 |

## Remaining Notes

- `note` の非公式 API は URL 未設定のため、実運用の主経路は Playwright / PinchTab のセッション付き API 保存。
- Web build の 500kB 超チャンク警告は code splitting で解消済み。
- `portable` 配布物は `release/note-local-draft-studio-portable` に最新化済み。
