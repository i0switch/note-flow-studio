import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { env } from "../../config.js";
import { buildApp } from "../../app.js";
import { createDatabase } from "../../db/client.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("API integration", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    env.MOCK_AI_MODE = true;
    env.MOCK_NOTE_API_RESULT = "success";
    env.MOCK_PLAYWRIGHT_RESULT = "success";
    env.MOCK_PINCHTAB_RESULT = "success";
    env.ENABLE_REAL_NOTE_AUTOMATION = false;
    app = await buildApp({ db: createDatabase(":memory:") });
  });

  afterEach(async () => {
    await app.close();
  });

  const waitForJob = async (jobId: number) => {
    let detail;
    for (let index = 0; index < 20; index += 1) {
      await sleep(30);
      const response = await app.inject({ method: "GET", url: `/api/generation-jobs/${jobId}` });
      detail = response.json();
      if (detail.status === "succeeded" || detail.status === "failed") break;
    }
    return detail;
  };

  it("参考資料を取り込み、記事生成から詳細取得までできる", async () => {
    const reference = await app.inject({
      method: "POST",
      url: "/api/reference-materials/import",
      payload: {
        sourceType: "text",
        sourceValue: "note販売の参考本文",
        title: "参考資料A",
        genreLabel: "business",
        tags: ["note"]
      }
    });
    expect(reference.statusCode).toBe(201);
    const refData = reference.json();

    const create = await app.inject({
      method: "POST",
      url: "/api/generation-jobs",
      payload: {
        keyword: "note販売",
        noteAccountId: 1,
        promptTemplateId: 1,
        targetGenre: "business",
        referenceMaterialIds: [refData.id],
        monetizationEnabled: true,
        salesMode: "free_paid",
        desiredPriceYen: 980,
        additionalInstruction: "初心者向け"
      }
    });
    expect(create.statusCode).toBe(201);

    const detail = await waitForJob(create.json().id);
    expect(detail.article.title).toContain("note販売");
  });

  it("通常モード記事を生成できる", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/generation-jobs",
      payload: {
        keyword: "通常記事",
        noteAccountId: 1,
        promptTemplateId: 1,
        referenceMaterialIds: [],
        monetizationEnabled: false,
        salesMode: "normal",
        desiredPriceYen: null,
        additionalInstruction: ""
      }
    });

    const detail = await waitForJob(create.json().id);
    expect(detail.article.transitionCtaText).toBe("");
  });

  it("file ソースの参考資料を取り込める", async () => {
    const filePath = path.join(os.tmpdir(), `note-local-ref-${Date.now()}.txt`);
    await fs.writeFile(filePath, "ローカルファイルの参考資料本文", "utf8");

    const response = await app.inject({
      method: "POST",
      url: "/api/reference-materials/import",
      payload: {
        sourceType: "file",
        sourceValue: filePath,
        title: "ファイル参考資料",
        tags: ["file"]
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().summaryText).toContain("ローカルファイル");
    await fs.unlink(filePath);
  });

  it("url ソースの参考資料から script/style を除去して取り込める", async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <html>
          <head>
            <style>.hidden { color: red; }</style>
            <script>console.log("ignore me")</script>
          </head>
          <body>
            <h1>重要な本文</h1>
            <p>このテキストだけ残したい</p>
          </body>
        </html>
      `);
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    const response = await app.inject({
      method: "POST",
      url: "/api/reference-materials/import",
      payload: {
        sourceType: "url",
        sourceValue: `http://127.0.0.1:${port}/`,
        title: "URL参考資料",
        tags: ["url"]
      }
    });

    server.close();
    expect(response.statusCode).toBe(201);
    expect(response.json().summaryText).toContain("重要な本文");
    expect(response.json().summaryText).not.toContain("ignore me");
    expect(response.json().summaryText).not.toContain("hidden");
  });

  it("設定更新と note アカウント追加/更新ができる", async () => {
    const settings = await app.inject({ method: "GET", url: "/api/settings" });
    expect(settings.statusCode).toBe(200);
    const currentSettings = settings.json() as Record<string, unknown>;

    const updated = await app.inject({
      method: "PUT",
      url: "/api/settings",
      payload: {
        ...currentSettings,
        localhostPort: 3999,
        geminiModel: "gemini-test"
      }
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().localhostPort).toBe(3999);

    const createdAccount = await app.inject({
      method: "POST",
      url: "/api/note-accounts",
      payload: {
        displayName: "sub",
        saveModePriority: "browser_first",
        browserAdapterPriority: "pinchtab_first",
        fallbackEnabled: true,
        isActive: true
      }
    });
    expect(createdAccount.statusCode).toBe(201);

    const updatedAccount = await app.inject({
      method: "PUT",
      url: `/api/note-accounts/${createdAccount.json().id}`,
      payload: {
        displayName: "sub-updated",
        saveModePriority: "api_first",
        browserAdapterPriority: "auto",
        fallbackEnabled: false,
        isActive: true
      }
    });
    expect(updatedAccount.statusCode).toBe(200);
    expect(updatedAccount.json().displayName).toBe("sub-updated");
  });

  it("プロンプトテンプレート追加と診断取得ができる", async () => {
    const template = await app.inject({
      method: "POST",
      url: "/api/prompt-templates",
      payload: {
        name: "追加テンプレ",
        purpose: "QA用",
        targetMedia: "note",
        genreScope: "all",
        articleSystemPrompt: "system",
        articleUserPromptTemplate: "user",
        referencePromptTemplate: "ref",
        salesTransitionTemplate: "sales"
      }
    });
    expect(template.statusCode).toBe(201);

    const diagnostics = await app.inject({
      method: "POST",
      url: "/api/diagnostics/run"
    });
    expect(diagnostics.statusCode).toBe(200);
    expect(diagnostics.json().diagnostics.some((item: { name: string }) => item.name === "AI Provider (Gemini)")).toBe(true);
    expect(diagnostics.json().diagnostics.some((item: { name: string }) => item.name === "pinchtab")).toBe(true);
  });

  it("セットアップ保存と依存チェックを返せる", async () => {
    const originalEnvFile = env.ENV_FILE_PATH;
    const tempEnvFile = path.join(os.tmpdir(), `note-local-setup-${Date.now()}.env`);
    env.ENV_FILE_PATH = tempEnvFile;

    const dependencies = await app.inject({ method: "GET", url: "/api/setup/dependencies" });
    expect(dependencies.statusCode).toBe(200);

    const save = await app.inject({
      method: "POST",
      url: "/api/setup/save",
      payload: {
        geminiApiKey: "test-key",
        geminiModel: "gemini-2.0-flash",
        noteLoginId: "demo-note",
        noteLoginPassword: "demo-password",
        pinchtabBaseUrl: "http://localhost:9867",
        pinchtabProfileName: "note-live",
        pinchtabLaunchPort: 9870,
        playwrightHeadless: false,
        localhostPort: 3555
      }
    });

    env.ENV_FILE_PATH = originalEnvFile;
    expect(save.statusCode).toBe(200);
    expect(save.json().isConfigured).toBe(true);
    expect((await fs.readFile(tempEnvFile, "utf8")).includes("GEMINI_API_KEY")).toBe(true);
    await fs.unlink(tempEnvFile);
  });

  it("API失敗時にPlaywrightへフォールバックする", async () => {
    env.MOCK_NOTE_API_RESULT = "fail";
    const create = await app.inject({
      method: "POST",
      url: "/api/generation-jobs",
      payload: {
        keyword: "保存テスト",
        noteAccountId: 1,
        promptTemplateId: 1,
        referenceMaterialIds: [],
        monetizationEnabled: true,
        salesMode: "free_paid",
        desiredPriceYen: 980,
        additionalInstruction: ""
      }
    });
    const job = create.json();
    await sleep(80);

    const save = await app.inject({
      method: "POST",
      url: `/api/generation-jobs/${job.id}/save-note`,
      payload: {
        forceMethod: null,
        noteAccountId: 1,
        applySaleSettings: true
      }
    });

    expect(save.statusCode).toBe(200);
    expect(save.json().methodUsed).toBe("playwright");
  });

  it("APIとPlaywrightが失敗したら PinchTab へフォールバックする", async () => {
    env.MOCK_NOTE_API_RESULT = "fail";
    env.MOCK_PLAYWRIGHT_RESULT = "fail";
    const create = await app.inject({
      method: "POST",
      url: "/api/generation-jobs",
      payload: {
        keyword: "pinchtab fallback",
        noteAccountId: 1,
        promptTemplateId: 1,
        referenceMaterialIds: [],
        monetizationEnabled: false,
        salesMode: "normal",
        desiredPriceYen: null,
        additionalInstruction: ""
      }
    });
    const job = create.json();
    await sleep(80);

    const save = await app.inject({
      method: "POST",
      url: `/api/generation-jobs/${job.id}/save-note`,
      payload: {
        forceMethod: null,
        noteAccountId: 1,
        applySaleSettings: false
      }
    });

    expect(save.statusCode).toBe(200);
    expect(save.json().methodUsed).toBe("pinchtab");
  });

  it("全保存経路が失敗した場合は 400 を返す", async () => {
    env.MOCK_NOTE_API_RESULT = "fail";
    env.MOCK_PLAYWRIGHT_RESULT = "fail";
    env.MOCK_PINCHTAB_RESULT = "fail";
    const create = await app.inject({
      method: "POST",
      url: "/api/generation-jobs",
      payload: {
        keyword: "save failure",
        noteAccountId: 1,
        promptTemplateId: 1,
        referenceMaterialIds: [],
        monetizationEnabled: false,
        salesMode: "normal",
        desiredPriceYen: null,
        additionalInstruction: ""
      }
    });
    const job = create.json();
    await sleep(80);

    const save = await app.inject({
      method: "POST",
      url: `/api/generation-jobs/${job.id}/save-note`,
      payload: {
        forceMethod: null,
        noteAccountId: 1,
        applySaleSettings: false
      }
    });

    expect(save.statusCode).toBe(400);
    expect(save.json().error.message).toBe("ALL_SAVE_METHODS_FAILED");
  });

  it("公開APIでPlaywright経由の公開結果を返せる", async () => {
    env.MOCK_NOTE_API_RESULT = "fail";
    const create = await app.inject({
      method: "POST",
      url: "/api/generation-jobs",
      payload: {
        keyword: "公開テスト",
        noteAccountId: 1,
        promptTemplateId: 1,
        referenceMaterialIds: [],
        monetizationEnabled: false,
        salesMode: "normal",
        desiredPriceYen: null,
        additionalInstruction: ""
      }
    });
    const job = create.json();
    await sleep(80);

    const publish = await app.inject({
      method: "POST",
      url: `/api/generation-jobs/${job.id}/publish-note`,
      payload: {
        forceMethod: "playwright",
        noteAccountId: 1,
        applySaleSettings: false
      }
    });

    expect(publish.statusCode).toBe(200);
    expect(publish.json().methodUsed).toBe("playwright");
    expect(publish.json().draftUrl).toContain("/mock/playwright/published/");
  });

  it("有料モードの販売設定反映リクエストを受け付ける", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/generation-jobs",
      payload: {
        keyword: "有料設定テスト",
        noteAccountId: 1,
        promptTemplateId: 1,
        referenceMaterialIds: [],
        monetizationEnabled: true,
        salesMode: "free_paid",
        desiredPriceYen: 1980,
        additionalInstruction: ""
      }
    });
    const job = create.json();
    await sleep(80);

    const apply = await app.inject({
      method: "POST",
      url: `/api/generation-jobs/${job.id}/apply-note-sale-settings`,
      payload: {
        priceYen: 1980,
        freePreviewRatio: 0.4,
        transitionCtaText: "ここから先は有料です"
      }
    });

    expect(apply.statusCode).toBe(200);
    expect(apply.json().requested.priceYen).toBe(1980);
  });

  it("数値IDの記事をdeletedJobIdsに追加できる", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/generation-jobs",
      payload: {
        keyword: "削除テスト記事",
        noteAccountId: 1,
        promptTemplateId: 1,
        referenceMaterialIds: [],
        monetizationEnabled: false,
        salesMode: "normal",
        desiredPriceYen: null,
        additionalInstruction: ""
      }
    });
    expect(create.statusCode).toBe(201);
    const jobId = create.json().id;
    await waitForJob(jobId);

    const del = await app.inject({ method: "DELETE", url: `/api/articles/${jobId}` });
    expect(del.statusCode).toBe(200);
    expect(del.json().result).toBe("success");

    const state = await app.inject({ method: "GET", url: "/api/state" });
    const ids = state.json().state.articles.map((a: { id: unknown }) => a.id);
    expect(ids).not.toContain(String(jobId));
  });

  it("UUID IDの記事削除は即座にsuccessを返す", async () => {
    const del = await app.inject({
      method: "DELETE",
      url: "/api/articles/550e8400-e29b-41d4-a716-446655440000"
    });
    expect(del.statusCode).toBe(200);
    expect(del.json().result).toBe("success");
  });

  it("セッションファイルがない場合はhasSession=falseを返す", async () => {
    const status = await app.inject({
      method: "GET",
      url: "/api/note-accounts/99999/session-status"
    });
    expect(status.statusCode).toBe(200);
    expect(status.json().hasSession).toBe(false);
  });

  it("PUT /api/state でアカウントを除外するとDBから削除される", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/note-accounts",
      payload: {
        displayName: "削除テスト",
        saveModePriority: "browser_first",
        browserAdapterPriority: "auto",
        fallbackEnabled: false,
        isActive: true
      }
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;

    const currentState = await app.inject({ method: "GET", url: "/api/state" });
    const stateBody = currentState.json();

    await app.inject({
      method: "PUT",
      url: "/api/state",
      payload: {
        state: {
          ...stateBody,
          accounts: []
        }
      }
    });

    const list = await app.inject({ method: "GET", url: "/api/note-accounts" });
    expect(list.json().find((a: { id: number }) => a.id === id)).toBeUndefined();
  });

  it("diagnostics/run が playwright-browser と node を含む", async () => {
    const result = await app.inject({ method: "POST", url: "/api/diagnostics/run" });
    expect(result.statusCode).toBe(200);
    const names = result.json().diagnostics.map((item: { name: string }) => item.name);
    expect(names).toContain("node");
    expect(names).toContain("playwright-browser");
    expect(names).toContain("pinchtab");
  });

  it("存在しないジョブへの保存と公開は 400 を返す", async () => {
    const save = await app.inject({
      method: "POST",
      url: "/api/generation-jobs/9999/save-note",
      payload: {
        forceMethod: "playwright",
        noteAccountId: 1,
        applySaleSettings: false
      }
    });
    const publish = await app.inject({
      method: "POST",
      url: "/api/generation-jobs/9999/publish-note",
      payload: {
        forceMethod: "playwright",
        noteAccountId: 1,
        applySaleSettings: false
      }
    });

    expect(save.statusCode).toBe(400);
    expect(publish.statusCode).toBe(400);
  });
});
