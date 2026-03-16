import { describe, expect, it } from "vitest";
import { createDatabase } from "../../db/client.js";
import { applyMigrations } from "../../db/migrate.js";
import { seedDatabase } from "../../db/seed.js";
import { generatedArticles, generationJobs, noteAccounts } from "../../db/schema.js";
import { NoteSaveService } from "../../services/note-save-service.js";
import type { SaveAdapter } from "../../adapters/note-save-adapters.js";

const now = () => new Date().toISOString();

describe("NoteSaveService", () => {
  it("失敗した保存経路から次の経路へフォールバックする", async () => {
    const db = createDatabase(":memory:");
    applyMigrations(db);
    await seedDatabase(db);
    const [account] = await db.select().from(noteAccounts).limit(1);
    const [job] = await db
      .insert(generationJobs)
      .values({
        keyword: "フォールバック",
        noteAccountId: account.id,
        promptTemplateId: 1,
        targetGenre: "business",
        monetizationEnabled: 1,
        salesMode: "free_paid",
        desiredPriceYen: 980,
        additionalInstruction: "",
        status: "succeeded",
        createdAt: now(),
        updatedAt: now()
      })
      .returning();
    await db.insert(generatedArticles).values({
      generationJobId: job.id,
      title: "テスト記事",
      genreLabel: "business",
      leadText: "lead",
      freePreviewMarkdown: "free",
      paidContentMarkdown: "paid",
      transitionCtaText: "cta",
      salesHookText: "hook",
      recommendedPriceYen: 980,
      bodyMarkdown: "body",
      noteRenderedBody: "body",
      status: "generated",
      createdAt: now(),
      updatedAt: now()
    });

    const adapters: SaveAdapter[] = [
      {
        method: "unofficial_api",
        async save() {
          throw new Error("API failed");
        },
        async verify() {
          return { status: "ok", detail: "ok" };
        }
      },
      {
        method: "playwright",
        async save(context) {
          return {
            method: "playwright",
            draftUrl:
              context.targetState === "published"
                ? "https://note.com/mock/published"
                : "https://note.com/mock/fallback",
            saleSettingStatus: "applied"
          };
        },
        async verify() {
          return { status: "ok", detail: "ok" };
        }
      }
    ];

    const service = new NoteSaveService(db, adapters);
    const result = await service.saveJob(job.id, {
      forceMethod: null,
      noteAccountId: account.id,
      applySaleSettings: true
    });

    expect(result.methodUsed).toBe("playwright");
    expect(result.saleSettingStatus).toBe("applied");
  });

  it("公開でも保存経路を使ってURLを返せる", async () => {
    const db = createDatabase(":memory:");
    applyMigrations(db);
    await seedDatabase(db);
    const [account] = await db.select().from(noteAccounts).limit(1);
    const [job] = await db
      .insert(generationJobs)
      .values({
        keyword: "公開",
        noteAccountId: account.id,
        promptTemplateId: 1,
        targetGenre: "business",
        monetizationEnabled: 0,
        salesMode: "normal",
        desiredPriceYen: null,
        additionalInstruction: "",
        status: "succeeded",
        createdAt: now(),
        updatedAt: now()
      })
      .returning();
    await db.insert(generatedArticles).values({
      generationJobId: job.id,
      title: "公開テスト記事",
      genreLabel: "business",
      leadText: "lead",
      freePreviewMarkdown: "free",
      paidContentMarkdown: "",
      transitionCtaText: "",
      salesHookText: "",
      recommendedPriceYen: null,
      bodyMarkdown: "body",
      noteRenderedBody: "body",
      status: "generated",
      createdAt: now(),
      updatedAt: now()
    });

    const service = new NoteSaveService(db, [
      {
        method: "playwright",
        async save(context) {
          return {
            method: "playwright",
            draftUrl:
              context.targetState === "published"
                ? "https://note.com/tester/n/npublished"
                : "https://note.com/tester/draft",
            saleSettingStatus: "not_required"
          };
        },
        async verify() {
          return { status: "ok", detail: "ok" };
        }
      }
    ]);

    const result = await service.publishJob(job.id, {
      forceMethod: "playwright",
      noteAccountId: account.id,
      applySaleSettings: false
    });

    expect(result.draftUrl).toContain("/n/npublished");
    expect(result.methodUsed).toBe("playwright");
  });

  it("forceMethod 指定時は他アダプターをスキップして指定経路だけ使う", async () => {
    const db = createDatabase(":memory:");
    applyMigrations(db);
    await seedDatabase(db);
    const [account] = await db.select().from(noteAccounts).limit(1);
    const [job] = await db
      .insert(generationJobs)
      .values({
        keyword: "強制経路",
        noteAccountId: account.id,
        promptTemplateId: 1,
        targetGenre: "business",
        monetizationEnabled: 0,
        salesMode: "normal",
        desiredPriceYen: null,
        additionalInstruction: "",
        status: "succeeded",
        createdAt: now(),
        updatedAt: now()
      })
      .returning();
    await db.insert(generatedArticles).values({
      generationJobId: job.id,
      title: "強制記事",
      genreLabel: "business",
      leadText: "lead",
      freePreviewMarkdown: "free",
      paidContentMarkdown: "",
      transitionCtaText: "",
      salesHookText: "",
      recommendedPriceYen: null,
      bodyMarkdown: "body",
      noteRenderedBody: "body",
      status: "generated",
      createdAt: now(),
      updatedAt: now()
    });

    let apiCalled = false;
    const service = new NoteSaveService(db, [
      {
        method: "unofficial_api",
        async save() {
          apiCalled = true;
          return { method: "unofficial_api", draftUrl: "https://note.com/api-draft", saleSettingStatus: "not_required" };
        },
        async verify() { return { status: "ok", detail: "ok" }; }
      },
      {
        method: "playwright",
        async save() {
          return { method: "playwright", draftUrl: "https://note.com/playwright-draft", saleSettingStatus: "not_required" };
        },
        async verify() { return { status: "ok", detail: "ok" }; }
      }
    ]);

    const result = await service.saveJob(job.id, {
      forceMethod: "playwright",
      noteAccountId: account.id,
      applySaleSettings: false
    });

    expect(result.methodUsed).toBe("playwright");
    expect(apiCalled).toBe(false); // unofficial_api はスキップされるべき
  });

  it("ARTICLE_NOT_READY: 記事が未生成のジョブへの保存は例外を投げる", async () => {
    const db = createDatabase(":memory:");
    applyMigrations(db);
    await seedDatabase(db);
    const [account] = await db.select().from(noteAccounts).limit(1);
    const [job] = await db
      .insert(generationJobs)
      .values({
        keyword: "未生成",
        noteAccountId: account.id,
        promptTemplateId: 1,
        targetGenre: "business",
        monetizationEnabled: 0,
        salesMode: "normal",
        desiredPriceYen: null,
        additionalInstruction: "",
        status: "running",
        createdAt: now(),
        updatedAt: now()
      })
      .returning();
    // generatedArticles には何も挿入しない

    const service = new NoteSaveService(db, [
      {
        method: "playwright",
        async save() {
          return { method: "playwright", draftUrl: "https://note.com/test", saleSettingStatus: "not_required" };
        },
        async verify() { return { status: "ok", detail: "ok" }; }
      }
    ]);

    await expect(
      service.saveJob(job.id, {
        forceMethod: null,
        noteAccountId: account.id,
        applySaleSettings: false
      })
    ).rejects.toThrow("ARTICLE_NOT_READY");
  });

  it("verifyAdapters で各アダプターの検証結果を名前付きで返す", async () => {
    const db = createDatabase(":memory:");
    applyMigrations(db);
    await seedDatabase(db);

    const service = new NoteSaveService(db, [
      {
        method: "unofficial_api",
        async save() {
          return { method: "unofficial_api", draftUrl: "", saleSettingStatus: "not_required" };
        },
        async verify() { return { status: "ok", detail: "API接続OK" }; }
      },
      {
        method: "playwright",
        async save() {
          return { method: "playwright", draftUrl: "", saleSettingStatus: "not_required" };
        },
        async verify() { return { status: "error", detail: "ブラウザ未起動" }; }
      }
    ]);

    const results = await service.verifyAdapters();

    expect(results).toHaveLength(2);
    const apiResult = results.find((r) => r.name === "unofficial_api");
    const pwResult = results.find((r) => r.name === "playwright");
    expect(apiResult?.status).toBe("ok");
    expect(apiResult?.detail).toBe("API接続OK");
    expect(pwResult?.status).toBe("error");
    expect(pwResult?.detail).toBe("ブラウザ未起動");
  });

  it("全経路失敗時は例外を返す", async () => {
    const db = createDatabase(":memory:");
    applyMigrations(db);
    await seedDatabase(db);
    const [account] = await db.select().from(noteAccounts).limit(1);
    const [job] = await db
      .insert(generationJobs)
      .values({
        keyword: "全失敗",
        noteAccountId: account.id,
        promptTemplateId: 1,
        targetGenre: "business",
        monetizationEnabled: 0,
        salesMode: "normal",
        desiredPriceYen: null,
        additionalInstruction: "",
        status: "succeeded",
        createdAt: now(),
        updatedAt: now()
      })
      .returning();
    await db.insert(generatedArticles).values({
      generationJobId: job.id,
      title: "失敗記事",
      genreLabel: "business",
      leadText: "lead",
      freePreviewMarkdown: "free",
      paidContentMarkdown: "",
      transitionCtaText: "",
      salesHookText: "",
      recommendedPriceYen: null,
      bodyMarkdown: "body",
      noteRenderedBody: "body",
      status: "generated",
      createdAt: now(),
      updatedAt: now()
    });

    const service = new NoteSaveService(db, [
      {
        method: "unofficial_api",
        async save() {
          throw new Error("api failed");
        },
        async verify() {
          return { status: "ok", detail: "ok" };
        }
      },
      {
        method: "playwright",
        async save() {
          throw new Error("playwright failed");
        },
        async verify() {
          return { status: "ok", detail: "ok" };
        }
      },
      {
        method: "pinchtab",
        async save() {
          throw new Error("pinchtab failed");
        },
        async verify() {
          return { status: "ok", detail: "ok" };
        }
      }
    ]);

    await expect(
      service.saveJob(job.id, {
        forceMethod: null,
        noteAccountId: account.id,
        applySaleSettings: false
      })
    ).rejects.toThrow("ALL_SAVE_METHODS_FAILED");
  });
});
