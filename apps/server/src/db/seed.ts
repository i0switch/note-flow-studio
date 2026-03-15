import { eq } from "drizzle-orm";
import { env } from "../config.js";
import type { AppDatabase } from "./client.js";
import { appSettings, noteAccounts, promptTemplates, salesProfiles } from "./schema.js";

const now = () => new Date().toISOString();

export const seedDatabase = async (db: AppDatabase) => {
  const [settings] = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  if (!settings) {
    await db.insert(appSettings).values({
      id: 1,
      localhostPort: env.APP_PORT,
      defaultAiProvider: env.DEFAULT_AI_PROVIDER,
      geminiModel: env.GEMINI_MODEL,
      pinchtabBaseUrl: env.PINCHTAB_BASE_URL,
      debugMode: 0,
      logRetentionDays: 14,
      enableGenreAutoDetection: 1,
      defaultTimeoutSec: 60,
      createdAt: now(),
      updatedAt: now()
    });
  }

  const [salesProfile] = await db.select().from(salesProfiles).limit(1);
  if (!salesProfile) {
    await db.insert(salesProfiles).values({
      profileName: "標準販売",
      salesMode: "free_paid",
      defaultPriceYen: 980,
      freePreviewRatio: 0.35,
      introCtaTemplate: "無料部分で全体像をつかみ、有料部分で実装と運用の細部まで理解できる構成",
      paidTransitionTemplate: "ここから先で、売れる導線と運用の具体策を一気に深掘りする",
      bonusTextTemplate: "テンプレートと実践手順を含む",
      createdAt: now(),
      updatedAt: now()
    });
  }

  const [template] = await db.select().from(promptTemplates).limit(1);
  if (!template) {
    await db.insert(promptTemplates).values({
      name: "標準note記事",
      purpose: "note向け販売記事",
      targetMedia: "note",
      genreScope: "all",
      articleSystemPrompt: "読者が行動しやすい構造で記事を生成する",
      articleUserPromptTemplate: "キーワード、参考資料、対象ジャンルからnote記事を生成する",
      referencePromptTemplate: "参考資料を要約し、本文に自然に反映する",
      salesTransitionTemplate: "無料部分から有料部分への導線を作る",
      createdAt: now(),
      updatedAt: now()
    });
  }

  const [account] = await db.select().from(noteAccounts).limit(1);
  if (!account) {
    const [defaultSales] = await db.select().from(salesProfiles).limit(1);
    const [defaultPrompt] = await db.select().from(promptTemplates).limit(1);
    await db.insert(noteAccounts).values({
      displayName: "main",
      saveModePriority: "api_first",
      browserAdapterPriority: "auto",
      fallbackEnabled: 1,
      isActive: 1,
      defaultSalesProfileId: defaultSales?.id ?? null,
      defaultPromptTemplateId: defaultPrompt?.id ?? null,
      createdAt: now(),
      updatedAt: now()
    });
  }
};
