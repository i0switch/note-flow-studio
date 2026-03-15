note Flow Studio 初回案内

1. npm install
2. npm run dev
3. ブラウザで http://127.0.0.1:8080 を開く
4. 設定画面で Gemini API キーと note ログイン情報を保存
5. 診断画面で再診断
6. 生成画面から下書き保存または公開を試す

注意
- note 側でログイン制限が出た時は、手動ログインしてから再試行
- 記事、設定、プロンプト、アカウント名はこのPCに保存される
- 保存データは server/data/app-state.json にまとまる
- 予約投稿は日時保存のみで自動実行はまだしない
- Gemini の本文生成はまだテンプレート生成

困った時
- API ヘルス確認: http://127.0.0.1:3001/api/health
- 配布前の総合確認: npm run verify:release
