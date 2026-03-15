import { expect, test } from "@playwright/test";

test("記事生成から詳細確認までできる", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("キーワード").fill("Codex note自動化");
  await page.getByRole("button", { name: "生成開始" }).click();
  await page.waitForURL(/\/jobs\//);
  await expect(page.getByText("無料部分")).toBeVisible();
  await expect(page.getByText("有料部分")).toBeVisible();
});

test("参考資料を追加して保存経路の結果を表示できる", async ({ page }) => {
  await page.goto("/references");
  await page.getByLabel("タイトル").fill("E2E参考資料");
  await page.getByLabel("本文 / URL / ファイルパス").fill("これはE2Eテスト用の参考資料本文");
  await page.getByRole("button", { name: "取り込む" }).click();
  await expect(page.getByText("E2E参考資料").first()).toBeVisible();

  await page.goto("/");
  await page.getByLabel("キーワード").fill("E2E保存確認");
  await page.getByText("E2E参考資料").first().click();
  await page.getByRole("button", { name: "生成開始" }).click();
  await page.waitForURL(/\/jobs\//);

  await page.getByRole("button", { name: "noteへ下書き保存" }).click();
  await expect(page.getByText(/unofficial_api \/ success/)).toBeVisible({ timeout: 10000 });
});

test("公開ボタンから公開経路の結果を表示できる", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("キーワード").fill("E2E公開確認");
  await page.getByRole("button", { name: "生成開始" }).click();
  await page.waitForURL(/\/jobs\//);

  await page.getByRole("button", { name: "noteへ公開" }).click();
  await expect(page.getByText(/playwright \/ success/)).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/mock\/playwright\/published/)).toBeVisible({ timeout: 10000 });
});
