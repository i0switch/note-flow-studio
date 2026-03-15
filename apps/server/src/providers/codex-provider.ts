import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { buildArticle, type BuiltArticle } from "../services/content-builder.js";
import type { AiProvider, ArticleGenerationRequest } from "./ai-provider.js";

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const MODELS_URL = "https://api.openai.com/v1/models";

/** Read API key from ~/.codex/auth.json (chatgpt auth mode) */
export async function readLocalCodexToken(): Promise<string | null> {
  try {
    const authPath = path.join(os.homedir(), ".codex", "auth.json");
    const raw = await fs.readFile(authPath, "utf8");
    const data = JSON.parse(raw) as {
      OPENAI_API_KEY?: string | null;
      tokens?: { access_token?: string };
    };
    if (data.OPENAI_API_KEY) return data.OPENAI_API_KEY;
    return data.tokens?.access_token ?? null;
  } catch {
    return null;
  }
}

const buildPrompt = (input: ArticleGenerationRequest): string =>
  [
    "あなたはnote向けの販売記事生成アシスタント。",
    `キーワード: ${input.keyword}`,
    `ジャンル: ${input.targetGenre ?? "auto"}`,
    `補足指示: ${input.additionalInstruction || "なし"}`,
    `販売モード: ${input.salesMode}`,
    `参考資料: ${input.referenceSummaries.join("\n") || "なし"}`,
    "JSON形式で title, genreLabel, leadText, freePreviewMarkdown, paidContentMarkdown, transitionCtaText, salesHookText, recommendedPriceYen, bodyMarkdown, noteRenderedBody を返す。",
  ].join("\n");

/**
 * OpenAI Codex provider using the Responses API (/v1/responses).
 * Supports models like codex-mini-latest.
 */
export class CodexProvider implements AiProvider {
  readonly providerName = "codex_cli";

  constructor(
    private readonly options: {
      apiKey: string;
      model: string;
    }
  ) {}

  private async resolveApiKey(): Promise<string> {
    return this.options.apiKey || (await readLocalCodexToken()) || "";
  }

  async generateArticle(input: ArticleGenerationRequest): Promise<BuiltArticle> {
    const apiKey = await this.resolveApiKey();
    if (!apiKey) return buildArticle(input);

    try {
      const response = await fetch(RESPONSES_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.options.model,
          input: buildPrompt(input),
          max_output_tokens: 4000,
        }),
      });

      if (!response.ok) return buildArticle(input);

      const data = (await response.json()) as {
        output?: { type?: string; content?: { type?: string; text?: string }[] }[];
      };

      const text =
        data.output
          ?.find((o) => o.type === "message")
          ?.content?.find((c) => c.type === "output_text")
          ?.text ?? "";

      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return buildArticle(input);

      try {
        return { ...buildArticle(input), ...(JSON.parse(match[0]) as Partial<BuiltArticle>) };
      } catch {
        return buildArticle(input);
      }
    } catch {
      return buildArticle(input);
    }
  }

  async healthCheck(): Promise<{ status: "ok" | "warn" | "error"; detail: string }> {
    const apiKey = await this.resolveApiKey();
    if (!apiKey) {
      return { status: "warn", detail: "APIキー未設定 (~/.codex/auth.json も見つからない)" };
    }
    try {
      const response = await fetch(MODELS_URL, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (response.ok) {
        return { status: "ok", detail: `Codex (${this.options.model}) 接続OK` };
      }
      if (response.status === 401 || response.status === 403) {
        return { status: "error", detail: `Codex 認証失敗 (HTTP ${response.status}) — トークンの期限切れの可能性` };
      }
      return { status: "warn", detail: `Codex 接続確認失敗: HTTP ${response.status}` };
    } catch {
      return { status: "error", detail: "Codex 接続エラー" };
    }
  }
}
