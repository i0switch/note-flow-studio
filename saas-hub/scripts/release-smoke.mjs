import { chromium } from "playwright";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:4173";
const realNote = process.env.RUN_REAL_NOTE === "1";

const realNoteConfig = {
  geminiApiKey: process.env.GEMINI_API_KEY ?? "smoke-gemini-key",
  noteLoginId: process.env.NOTE_LOGIN_ID ?? "",
  noteLoginPassword: process.env.NOTE_LOGIN_PASSWORD ?? "",
  pinchTabUrl: process.env.PINCHTAB_BASE_URL ?? "http://localhost",
  pinchTabPort: process.env.PINCHTAB_PORT ?? "9222",
  pinchTabToken: process.env.PINCHTAB_TOKEN ?? "",
  pinchTabProfileName: process.env.PINCHTAB_PROFILE_NAME ?? "",
};

const ensure = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const logStep = (message) => {
  console.log(`[smoke] ${message}`);
};

const extractNoteUrl = async (page, expectedPrefix) => {
  const text = await page.evaluate(() => document.body.innerText);
  const matched = text.match(/note URL:\s+(https:\/\/\S+)/);
  ensure(Boolean(matched?.[1]), "note URL が画面から取得できなかった");
  ensure(matched[1].startsWith(expectedPrefix), `note URL の形式が想定外: ${matched[1]}`);
  return matched[1];
};

const uniqueText = (prefix) => `${prefix} ${new Date().toISOString().replace(/[:.]/g, "-")}`;

const currentTimeForSchedule = () => {
  const now = new Date();
  return {
    hour: String(now.getHours()).padStart(2, "0"),
    minute: String(now.getMinutes()).padStart(2, "0"),
  };
};

const waitForUrlText = async (page, expected) => {
  await page.waitForFunction(
    (target) => document.body.innerText.includes(target),
    expected,
    { timeout: 60_000 },
  );
};

const clickButtonByText = async (page, text) => {
  await page.evaluate((target) => {
    const button = [...document.querySelectorAll("button")].find((element) =>
      element.textContent?.includes(target),
    );
    if (!button) {
      throw new Error(`button not found: ${target}`);
    }
    button.click();
  }, text);
};

const saveSettings = async (page) => {
  logStep("settings: open");
  await page.goto(`${baseUrl}/settings`, { waitUntil: "networkidle" });

  const basicSaveButton = page.getByRole("button", { name: "基本設定を保存" });
  await basicSaveButton.click();
  await waitForUrlText(page, "基本設定を保存した");

  await page.getByRole("tab", { name: "note" }).click();
  await page.getByPlaceholder("メールアドレス or ID").fill(realNote ? realNoteConfig.noteLoginId : "");
  await page.getByPlaceholder("note パスワード").fill(realNote ? realNoteConfig.noteLoginPassword : "");
  await page.getByPlaceholder("未設定なら空でOK").fill("");
  await page.getByRole("button", { name: "note 設定を保存" }).click();
  await page.waitForTimeout(1000);

  await page.getByRole("tab", { name: "AI provider" }).click();
  await waitForUrlText(page, "provider 一覧");
  await page.getByRole("button", { name: /Gemini/ }).click();
  await page.locator('input[value="gemini-2.0-flash"]').fill("gemini-2.0-flash");
  const apiKeyInputs = page.locator('input[type="password"]');
  if (await apiKeyInputs.count()) {
    await apiKeyInputs.first().fill(realNote ? realNoteConfig.geminiApiKey : "");
  }
  await page.getByRole("button", { name: "設定保存" }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "接続テスト" }).click();
  await page.waitForTimeout(1000);

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "note" }).click();
  await expectValue(page.getByPlaceholder("メールアドレス or ID"), realNote ? realNoteConfig.noteLoginId : "");
};

const expectValue = async (locator, value) => {
  const current = await locator.inputValue();
  ensure(current === value, `値が期待と違う: expected=${value} actual=${current}`);
};

const runDiagnostics = async (page) => {
  logStep("diagnostics: rerun");
  await page.goto(`${baseUrl}/diagnostics`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "再診断" }).click();
  await page.waitForTimeout(2500);
  await waitForUrlText(page, "Playwright");
};

const runPromptAudit = async (page) => {
  logStep("prompts: add");
  const promptTitle = uniqueText("smoke prompt");
  await page.goto(`${baseUrl}/prompts`, { waitUntil: "networkidle" });
  await waitForUrlText(page, "プロンプト管理");
  await page.getByRole("button", { name: "追加" }).click();
  await page.getByPlaceholder("テンプレート名").fill(promptTitle);
  await page.getByPlaceholder("このプロンプトの用途").fill("smoke test");
  await page.getByPlaceholder("プロンプトの本文を入力...").fill("smoke prompt body");
  await page.getByRole("button", { name: "保存" }).click();
  await waitForUrlText(page, "プロンプトを追加した");
  await waitForUrlText(page, promptTitle);
};

const runAccountAudit = async (page) => {
  logStep("accounts: add");
  const accountName = uniqueText("smoke account");
  await page.goto(`${baseUrl}/settings`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "アカウント" }).click();
  await page.getByPlaceholder("例: 運用アカウント").fill(accountName);
  await page.getByRole("button", { name: "追加" }).click();
  await page.waitForTimeout(1500);
};

const openScheduleAndSave = async (page) => {
  logStep("generate: schedule");
  const scheduleKeyword = uniqueText("schedule smoke");
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "例: AI副業の始め方" }).fill(scheduleKeyword);
  await clickButtonByText(page, "生成後予約投稿");
  await waitForUrlText(page, "予約投稿の日時設定");
  const { hour, minute } = currentTimeForSchedule();
  await page.locator('input[type="time"]').fill(`${hour}:${minute}`);
  await page.getByRole("button", { name: "予約投稿で作成" }).click();
  await page.waitForURL(/\/articles\//, { timeout: 30_000 });
  await waitForUrlText(page, scheduleKeyword);
  return scheduleKeyword;
};

const waitForScheduledPublication = async (page) => {
  if (!realNote) return "";
  logStep("schedule: auto publish");
  await page.waitForFunction(
    () => document.body.innerText.includes("公開済み"),
    { timeout: 120_000 },
  );
  await page.waitForFunction(
    () => document.body.innerText.includes("note URL: https://note.com/"),
    { timeout: 120_000 },
  );
  return extractNoteUrl(page, "https://note.com/");
};

const verifyPersistedArticle = async (browser, articleUrl, expectedText) => {
  logStep("detail: persisted reload");
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  try {
    await page.goto(articleUrl, { waitUntil: "networkidle" });
    await waitForUrlText(page, expectedText);
  } finally {
    await context.close();
  }
};

const runGenerateAndPublish = async (page) => {
  if (!realNote) return;
  logStep("generate: publish");
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "例: AI副業の始め方" }).fill(uniqueText("generate publish"));
  await page.getByRole("textbox", { name: "追加の指示があれば入力..." }).fill("release smoke publish");
  await page.getByRole("button", { name: "生成後即公開" }).click();
  await page.waitForURL(/\/articles\//, { timeout: 30_000 });
  await waitForUrlText(page, "公開済み");
  await page.waitForFunction(
    () => document.body.innerText.includes("note URL: https://note.com/"),
    { timeout: 90_000 },
  );
  return extractNoteUrl(page, "https://note.com/");
};

const runManualDraft = async (page) => {
  if (!realNote) return;
  logStep("manual: draft");
  await page.goto(`${baseUrl}/articles/new`, { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "記事タイトルを入力" }).fill(uniqueText("manual draft"));
  await page.getByRole("textbox", { name: "例: AI副業" }).fill("manual smoke");
  await page.getByRole("textbox", { name: "無料で公開する部分を入力..." }).fill("manual free");
  await page.getByRole("textbox", { name: "有料部分への導線テキスト..." }).fill("manual guidance");
  await page.getByRole("textbox", { name: "有料コンテンツを入力..." }).fill("manual paid");
  await page.getByRole("button", { name: "下書き保存" }).click();
  await page.waitForURL(/\/articles\//, { timeout: 30_000 });
  await waitForUrlText(page, "保存済み");
  await page.waitForFunction(
    () => document.body.innerText.includes("note URL: https://editor.note.com/"),
    { timeout: 90_000 },
  );
  return extractNoteUrl(page, "https://editor.note.com/");
};

const runDetailLocalActions = async (page) => {
  logStep("detail: local actions");
  await page.getByRole("button", { name: "編集" }).click();
  const titleBox = page.locator("textarea").first();
  await titleBox.fill(`${uniqueText("detail edit")} title`);
  await page.getByRole("button", { name: /^保存$/ }).click();
  await waitForUrlText(page, "記事内容を保存した");

  await page.getByRole("tab", { name: "素材" }).click();
  await waitForUrlText(page, "アイキャッチ案");
  await page.getByRole("button", { name: "素材案を更新" }).click();
  await waitForUrlText(page, "素材案を更新した");
};

const validateUiLabels = async (page) => {
  logStep("ui labels: validate");
  await page.goto(`${baseUrl}/diagnostics`, { waitUntil: "networkidle" });
  await waitForUrlText(page, "依存チェック");
  await page.goto(`${baseUrl}/articles/new`, { waitUntil: "networkidle" });
  await waitForUrlText(page, "記事を手動追加");
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "生成後予約投稿" }).click();
  await waitForUrlText(page, "自動で note 公開まで進む");
  const bodyText = await page.evaluate(() => document.body.innerText);
  ensure(!bodyText.includes("順次追加"), "未実装表示が残っている");
  ensure(!bodyText.includes("PC保存"), "PC保存ラベルが残っている");
  ensure(!bodyText.includes("管理用メモ"), "管理用メモ表示が残っている");
  ensure(!bodyText.includes("real"), "real 表示が残っている");
};

const main = async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  try {
    const results = {
      scheduleArticleUrl: "",
      schedulePublishedNoteUrl: "",
      publishedNoteUrl: "",
      manualDraftUrl: "",
    };

    logStep("open app");
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await saveSettings(page);
    await runDiagnostics(page);
    await runPromptAudit(page);
    await runAccountAudit(page);
    const scheduleKeyword = await openScheduleAndSave(page);
    results.scheduleArticleUrl = page.url();
    await verifyPersistedArticle(browser, results.scheduleArticleUrl, scheduleKeyword);
    const scheduledPublishedNoteUrl = await waitForScheduledPublication(page);
    if (scheduledPublishedNoteUrl) {
      results.schedulePublishedNoteUrl = scheduledPublishedNoteUrl;
    }
    const publishedNoteUrl = await runGenerateAndPublish(page);
    if (publishedNoteUrl) {
      results.publishedNoteUrl = publishedNoteUrl;
    }
    await runDetailLocalActions(page);
    const manualDraftUrl = await runManualDraft(page);
    if (manualDraftUrl) {
      results.manualDraftUrl = manualDraftUrl;
    }
    await validateUiLabels(page);
    console.log(JSON.stringify({ result: "ok", realNote, results }, null, 2));
  } finally {
    await browser.close();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
