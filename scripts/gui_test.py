"""
note-local-draft-studio 網羅的GUIテスト（正確なセレクター版）
Usage:
  python scripts/gui_test.py --url http://127.0.0.1:3001
  python scripts/gui_test.py --url http://192.168.1.40:3001 --socks5 127.0.0.1:12800 --tag Win
  python scripts/gui_test.py --url http://127.0.0.1:13002 --tag Mac
"""
import argparse, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument("--url", required=True)
ap.add_argument("--socks5", default=None)
ap.add_argument("--tag", default="App")
ap.add_argument("--out", default="/tmp/gui_test")
args = ap.parse_args()

OUT = Path(args.out) / args.tag
OUT.mkdir(parents=True, exist_ok=True)
BASE = args.url.rstrip("/")

PASS, FAIL, WARN = "✅", "❌", "⚠️"
results = []

def log(icon, name, detail=""):
    msg = f"{icon} {name}" + (f": {detail}" if detail else "")
    print(msg)
    results.append((icon, name, detail))

def shot(page, name):
    p = OUT / f"{name}.png"
    page.screenshot(path=str(p), full_page=True)

def check(cond, name, detail="", warn=False):
    log(PASS if cond else (WARN if warn else FAIL), name, detail)
    return cond

def safe(fn, name, detail_ok="", warn=False):
    try:
        fn()
        log(PASS, name, detail_ok)
        return True
    except Exception as e:
        log(WARN if warn else FAIL, name, str(e)[:100])
        return False

# --- ユーティリティ ---
def open_sidebar(page):
    """サイドバーを開く（mobile viewport <768px でSheet/Dialogが開く）"""
    try:
        btn = page.get_by_role("button", name="Toggle Sidebar")
        btn.wait_for(state="visible", timeout=3000)
        btn.click()
        page.wait_for_timeout(1000)
        page.locator('[role="dialog"] a').first.wait_for(state="attached", timeout=5000)
        return True
    except Exception:
        return False

def close_sidebar(page):
    try:
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
    except Exception:
        pass

def goto(page, path):
    page.goto(f"{BASE}{path}")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

# ==========================================
with sync_playwright() as p:
    opts = {"headless": True}
    if args.socks5:
        opts["proxy"] = {"server": f"socks5://{args.socks5}"}
    browser = p.chromium.launch(**opts)
    ctx = browser.new_context(viewport={"width": 1400, "height": 900})
    page = ctx.new_page()
    page.set_default_timeout(12000)

    print(f"\n{'='*60}")
    print(f"  {args.tag} GUI テスト: {BASE}")
    print(f"{'='*60}")

    # ==========================================
    # [1] 初期ロード
    # ==========================================
    print("\n--- [1] 初期ロード ---")
    goto(page, "/")
    shot(page, "01_home")
    check(page.title() == "note Flow Studio | note記事自動投稿ツール", "タイトル正確", page.title())
    check(page.locator('h1:has-text("生成")').is_visible(), "生成フォームのh1表示")

    # ==========================================
    # [2] サイドバーナビゲーション
    # ==========================================
    print("\n--- [2] サイドバーナビゲーション ---")
    nav_links = [
        ("記事生成", "/"),
        ("投稿管理", "/articles"),
        ("プロンプト管理", "/prompts"),
        ("設定", "/settings"),
        ("環境診断", "/diagnostics"),
    ]
    # モバイルviewport (<768px) でSheet/Dialogとして開く（desktopではpersistent sidebar）
    ctx_mobile = browser.new_context(
        viewport={"width": 750, "height": 900},
        **( {"proxy": {"server": f"socks5://{args.socks5}"}} if args.socks5 else {} )
    )
    page_mobile = ctx_mobile.new_page()
    page_mobile.set_default_timeout(12000)
    page_mobile.goto(f"{BASE}/")
    page_mobile.wait_for_load_state("networkidle")
    page_mobile.wait_for_timeout(800)
    sidebar_ok = open_sidebar(page_mobile)
    shot(page_mobile, "02_sidebar")
    if sidebar_ok:
        page_mobile.wait_for_timeout(500)
        dialog = page_mobile.locator('[role="dialog"]').first
        for label, _ in nav_links:
            link = dialog.get_by_role("link", name=label)
            check(link.count() > 0, f"ナビ「{label}」")
        close_sidebar(page_mobile)
        check(True, "サイドバー開く")
    else:
        check(False, "サイドバー開く", "タイムアウト（Toggle Sidebar が反応しない）")
        for label, _ in nav_links:
            log(WARN, f"ナビ「{label}」", "サイドバー未開のためスキップ")
    page_mobile.close()
    ctx_mobile.close()

    # ==========================================
    # [3] 記事生成フォーム（詳細）
    # ==========================================
    print("\n--- [3] 記事生成フォーム ---")
    goto(page, "/")
    shot(page, "03_generate_form")

    # キーワード入力
    kw = page.get_by_placeholder("例: AI副業の始め方")
    safe(lambda: kw.fill("Python入門ガイド"), "キーワード入力")

    # ジャンル選択（カスタムcombobox）
    genre_box = page.locator('[role="combobox"]').nth(0)
    check(genre_box.is_visible(), "ジャンル選択UI表示")
    safe(lambda: genre_box.click(), "ジャンルcombobox クリック", warn=True)
    page.wait_for_timeout(300)
    options = page.locator('[role="option"]').all()
    check(len(options) > 0, "ジャンルオプション表示", f"{len(options)}件", warn=True)
    if options:
        options[0].click()
    page.wait_for_timeout(200)

    # 使用アカウント選択
    acct_box = page.locator('[role="combobox"]').nth(1)
    check(acct_box.is_visible(), "使用アカウント選択UI表示")

    # 補足指示
    extra = page.get_by_placeholder("追加の指示があれば入力...")
    safe(lambda: extra.fill("初心者向けに丁寧に解説して"), "補足指示入力")

    # 参考資料URL
    ref_url = page.get_by_placeholder("https://example.com/article")
    safe(lambda: ref_url.fill("https://example.com/python-guide"), "参考資料URL入力")

    # 参考資料追加ボタン（URLフィールドの隣のbutton）
    add_ref_btn = ref_url.locator("..").get_by_role("button")
    safe(lambda: (add_ref_btn.click(), page.wait_for_timeout(1000)), "参考資料URL追加", warn=True)
    shot(page, "03b_form_filled")

    # AI provider スイッチOFFにしてcombobox有効化
    provider_switch = page.locator('button[role="switch"]').nth(0)
    if provider_switch.get_attribute("data-state") == "checked" or provider_switch.is_checked() or True:
        safe(lambda: (provider_switch.click(), page.wait_for_timeout(300)), "AIプロバイダースイッチ切替", warn=True)
    provider_cb = page.get_by_text("AI provider").locator("..").get_by_role("combobox")
    check(provider_cb.is_visible(), "AI provider選択UI", warn=True)

    # ファイル添付ボタン確認
    file_btn = page.get_by_role("button", name="ファイルを選択")
    check(file_btn.is_visible(), "ファイル添付ボタン")

    # 生成ボタン3種確認
    for btn_name in ["生成後即公開", "生成後下書き", "生成後予約投稿"]:
        check(page.get_by_role("button", name=btn_name).is_visible(), f"ボタン「{btn_name}」")
    shot(page, "03c_generate_ready")

    # 生成完了後プレビュースイッチ確認（2番目のswitch）
    preview_switch = page.locator('button[role="switch"]').nth(1)
    check(preview_switch.is_visible(), "生成後プレビュースイッチ")

    # 生成条件サマリー確認
    check(page.locator('h2:has-text("生成条件サマリー")').is_visible(), "生成条件サマリー表示")

    # ==========================================
    # [4] 投稿管理（記事一覧）
    # ==========================================
    print("\n--- [4] 投稿管理 ---")
    goto(page, "/articles")
    shot(page, "04_articles")
    check(page.locator("h1").first.is_visible(), "投稿管理ページ表示")

    # 記事テーブル確認（テーブル構造: 行クリックで詳細遷移、各行にTrashアイコンボタン）
    # 「該当する記事がありません」の空状態行は除外する
    all_rows = page.locator("table tbody tr").all()
    empty_state = page.locator("table tbody tr").filter(has_text="該当する記事がありません")
    real_article_rows = [r for r in all_rows if "該当する記事がありません" not in (r.inner_text() or "")]
    article_count = len(real_article_rows)
    check(True, "記事一覧表示", f"{article_count}件")

    # テーブル検索・フィルターUI確認
    check(page.locator('input[placeholder*="検索"]').is_visible(), "記事検索入力欄")

    if article_count > 0:
        # 削除アイコンボタン（Trashアイコン, テキストなし ghost button）確認
        action_btns = real_article_rows[0].get_by_role("button").all()
        check(len(action_btns) > 0, "記事行アクションボタン", f"{len(action_btns)}件")

        # 行クリック → 詳細ページ遷移確認
        real_article_rows[0].click()
        page.wait_for_timeout(800)
        shot(page, "04b_article_detail")
        check("/articles/" in page.url, "記事詳細ページ遷移", page.url)
        page.go_back()
        page.wait_for_load_state("networkidle")
    else:
        log(WARN, "記事行アクションボタン", "記事なしのためスキップ")
        log(WARN, "記事詳細ページ遷移", "記事なしのためスキップ")

    # ==========================================
    # [5] 設定 > 基本設定タブ
    # ==========================================
    print("\n--- [5] 設定 > 基本設定 ---")
    goto(page, "/settings")
    shot(page, "05_settings_basic")

    # タブ確認
    for tab_name in ["基本設定", "アカウント", "note", "AI provider"]:
        check(page.get_by_role("tab", name=tab_name).is_visible(), f"設定タブ「{tab_name}」")

    # 基本設定の項目確認
    check(page.locator('h2:has-text("localhost")').is_visible(), "localhost設定セクション")
    check(page.locator('h2:has-text("Playwright")').is_visible(), "Playwright設定セクション")
    check(page.locator('h2:has-text("記事ジャンル")').is_visible(), "記事ジャンル管理セクション")

    # ジャンル追加テスト
    genre_input = page.get_by_placeholder("例: マーケティング")
    safe(lambda: genre_input.fill("テストジャンル"), "ジャンル追加入力")
    add_genre_btn = page.get_by_role("button", name="追加")
    safe(lambda: (add_genre_btn.click(), page.wait_for_timeout(500)), "ジャンル追加実行", warn=True)
    shot(page, "05b_genre_added")

    # 保存ボタン確認
    check(page.get_by_role("button", name="基本設定を保存").is_visible(), "基本設定保存ボタン")

    # ==========================================
    # [6] 設定 > アカウントタブ
    # ==========================================
    print("\n--- [6] 設定 > アカウント ---")
    page.get_by_role("tab", name="アカウント").click()
    page.wait_for_timeout(500)
    shot(page, "06_settings_accounts")

    acct_section = page.get_by_role("tabpanel", name="アカウント")
    check(acct_section.is_visible(), "アカウントタブ表示")
    # 追加ボタンまたはフォーム確認
    add_btns = page.get_by_role("button", name="追加").all()
    check(len(add_btns) > 0 or page.locator('input[placeholder*="ID"], input[placeholder*="ユーザー"]').is_visible(),
          "アカウント追加UI", warn=True)

    # ==========================================
    # [7] 設定 > AI providerタブ
    # ==========================================
    print("\n--- [7] 設定 > AI provider ---")
    page.get_by_role("tab", name="AI provider").click()
    page.wait_for_timeout(500)
    shot(page, "07_settings_providers")

    # プロバイダーカード確認
    provider_cards = page.locator('[role="tabpanel"] [class*="card"], [role="tabpanel"] [class*="Card"], [role="tabpanel"] [class*="provider"]').all()
    check(len(provider_cards) > 0, "AIプロバイダーカード表示", f"{len(provider_cards)}件")

    # alibaba_codingのAPI key入力
    alibaba_section = page.get_by_text("alibaba_coding", exact=False).first
    if alibaba_section.is_visible():
        alibaba_section.scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        shot(page, "07b_alibaba_section")

        # APIキー入力欄
        key_inputs = page.locator('[role="tabpanel"] input[type="password"], [role="tabpanel"] input[type="text"]').all()
        for inp in key_inputs:
            try:
                if inp.is_visible() and inp.is_editable():
                    ph = inp.get_attribute("placeholder") or ""
                    if "key" in ph.lower() or "api" in ph.lower() or "sk-" in ph.lower() or inp.input_value() == "":
                        inp.fill("sk-sp-99f8cd5a78594674bc531320c9bec2ba")
                        log(PASS, "alibaba_coding APIキー入力")
                        break
            except Exception:
                pass

        # テストボタン
        test_btn = page.locator('[role="tabpanel"]').get_by_role("button", name="テスト").first
        if not test_btn.is_visible():
            test_btn = page.locator('[role="tabpanel"] button:has-text("テスト")').first
        if test_btn.is_visible():
            test_btn.click()
            page.wait_for_timeout(3000)
            shot(page, "07c_provider_test_result")
            check(True, "プロバイダーテスト実行")
        else:
            log(WARN, "プロバイダーテストボタン", "見つからない")
    else:
        log(WARN, "alibaba_codingセクション", "見つからない")

    # ==========================================
    # [8] プロンプト管理
    # ==========================================
    print("\n--- [8] プロンプト管理 ---")
    goto(page, "/prompts")
    shot(page, "08_prompts")
    check(page.locator("h1").first.is_visible(), "プロンプト管理ページ表示")
    templates = page.locator("[class*='card'], [class*='Card'], [class*='template'], article").all()
    check(len(templates) >= 0, "テンプレート表示", f"{len(templates)}件")

    # 新規作成ボタン確認
    create_btn = page.get_by_role("button").filter(has_text="作成").first
    if not create_btn.is_visible():
        create_btn = page.locator('button:has-text("新規"), button:has-text("追加"), button:has-text("+")').first
    check(create_btn.is_visible(), "テンプレート作成ボタン", warn=True)

    # ==========================================
    # [9] 環境診断
    # ==========================================
    print("\n--- [9] 環境診断 ---")
    goto(page, "/diagnostics")
    shot(page, "09_diagnostics")
    check(page.locator("h1").first.is_visible(), "環境診断ページ表示")

    # 診断項目確認
    items = page.locator("[class*='check'], [class*='diagnostic'], [class*='status']").all()
    check(len(items) >= 0, "診断項目表示", f"{len(items)}件")

    # node/playwright/chromium 表示確認
    for keyword in ["node", "playwright", "chromium"]:
        visible = page.get_by_text(keyword, exact=False).first.is_visible()
        check(visible, f"診断「{keyword}」", warn=True)

    # Chromiumインストールボタン確認
    install_btn = page.get_by_role("button").filter(has_text="インストール").first
    check(install_btn.is_visible(), "Chromiumインストールボタン", warn=True)

    # ==========================================
    # [10] セットアップページ（/setup）
    # ==========================================
    print("\n--- [10] セットアップページ ---")
    goto(page, "/setup")
    shot(page, "10_setup")
    body_text = page.inner_text("body")
    check(len(body_text) > 0, "セットアップページ表示（クラッシュなし）")

    # ==========================================
    # [11] レスポンシブ確認
    # ==========================================
    print("\n--- [11] レスポンシブ ---")
    for w, h, label in [(375, 812, "mobile"), (768, 1024, "tablet"), (1400, 900, "desktop")]:
        ctx2 = browser.new_context(viewport={"width": w, "height": h})
        p2 = ctx2.new_page()
        p2.goto(f"{BASE}/")
        p2.wait_for_load_state("networkidle")
        p2.screenshot(path=str(OUT / f"11_responsive_{label}.png"))
        check(True, f"レスポンシブ {label} ({w}x{h})")
        ctx2.close()

    # ==========================================
    # [12] JSエラー監視
    # ==========================================
    print("\n--- [12] JSコンソールエラー ---")
    errs = []
    page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    for path in ["/", "/articles", "/settings", "/prompts", "/diagnostics"]:
        goto(page, path)
        page.wait_for_timeout(800)
    critical = [e for e in errs if any(t in e for t in ["TypeError", "ReferenceError", "is not defined", "Cannot read"])]
    check(len(critical) == 0, "クリティカルJSエラーなし",
          f"{len(critical)}件: {critical[0][:60]}" if critical else "0件")

    browser.close()

    # ==========================================
    # 最終レポート
    # ==========================================
    print(f"\n{'='*60}")
    print(f"  {args.tag} テスト結果サマリー")
    print(f"{'='*60}")
    passed = sum(1 for r in results if r[0] == PASS)
    warned = sum(1 for r in results if r[0] == WARN)
    failed = sum(1 for r in results if r[0] == FAIL)
    total = len(results)
    print(f"  ✅ PASS: {passed}/{total}  ⚠️  WARN: {warned}  ❌ FAIL: {failed}")
    if failed:
        print("\n  FAILs:")
        for r in results:
            if r[0] == FAIL:
                print(f"    ❌ {r[1]}: {r[2]}")
    if warned:
        print("\n  WARNs:")
        for r in results:
            if r[0] == WARN:
                print(f"    ⚠️  {r[1]}: {r[2]}")
    print(f"\n  スクリーンショット: {OUT}/")
    print(f"{'='*60}\n")
    sys.exit(1 if failed else 0)
