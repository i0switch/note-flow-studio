/**
 * 画像生成の抽象レイヤー
 * RealGeminiImageGenerator と MockImageGenerator を切り替え可能
 */

export type ImageGenerationResult = {
  base64: string;
  mimeType: string;
  prompt: string;
  tokenInfo?: {
    inputTokens: number;
    outputTokens?: number;
    thinkingTokens?: number;
  };
};

export type ImageGenerationError = {
  code: "RATE_LIMIT" | "SAFETY_BLOCK" | "SERVER_ERROR" | "TIMEOUT" | "NO_IMAGE" | "UNKNOWN";
  status: number;
  message: string;
};

export interface ImageGenerator {
  /** 画像生成前にトークン数をチェック（実API のみ） */
  countTokens(prompt: string): Promise<{ totalTokens: number }>;
  /** ヘッダー画像を生成 */
  generate(prompt: string, options?: { aspectRatio?: string; imageSize?: string }): Promise<ImageGenerationResult>;
}

// ---- Real Gemini Implementation ----

const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export class RealGeminiImageGenerator implements ImageGenerator {
  constructor(private readonly apiKey: string) {}

  async countTokens(prompt: string): Promise<{ totalTokens: number }> {
    const res = await fetch(
      `${GEMINI_BASE}/${GEMINI_IMAGE_MODEL}:countTokens?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw Object.assign(new Error(`countTokens failed: ${res.status} ${text.slice(0, 200)}`), {
        code: "UNKNOWN" as const,
        status: res.status,
      });
    }
    const data = await res.json() as { totalTokens?: number };
    return { totalTokens: data.totalTokens ?? 0 };
  }

  async generate(
    prompt: string,
    options?: { aspectRatio?: string; imageSize?: string },
  ): Promise<ImageGenerationResult> {
    const aspectRatio = options?.aspectRatio ?? "16:9";
    const imageSize = options?.imageSize ?? "1K";

    const res = await fetch(
      `${GEMINI_BASE}/${GEMINI_IMAGE_MODEL}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig: { aspectRatio, imageSize },
          },
        }),
        signal: AbortSignal.timeout(120_000),
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      const errObj: ImageGenerationError = {
        code: res.status === 429 ? "RATE_LIMIT"
          : res.status === 400 && errText.includes("SAFETY") ? "SAFETY_BLOCK"
          : res.status >= 500 ? "SERVER_ERROR"
          : "UNKNOWN",
        status: res.status,
        message: `Gemini API error ${res.status}: ${errText.slice(0, 200)}`,
      };
      throw Object.assign(new Error(errObj.message), errObj);
    }

    const data = await res.json() as {
      candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string }; text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    };

    const imagePart = data.candidates?.[0]?.content?.parts?.find(
      (p) => (p as { inlineData?: { data: string } }).inlineData?.data,
    );

    if (!imagePart?.inlineData?.data) {
      const errObj: ImageGenerationError = {
        code: "NO_IMAGE",
        status: 200,
        message: "Gemini API から画像データが返されませんでした",
      };
      throw Object.assign(new Error(errObj.message), errObj);
    }

    return {
      base64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || "image/png",
      prompt,
      tokenInfo: data.usageMetadata ? {
        inputTokens: data.usageMetadata.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata.candidatesTokenCount ?? 0,
      } : undefined,
    };
  }
}

// ---- Mock Implementation ----

/** 1x1 赤い PNG (67 bytes) — テスト用最小画像 */
const TINY_RED_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

export type MockScenario = "success" | "rate_limit" | "server_error" | "safety_block" | "timeout" | "prompt_echo";

/**
 * テスト用のモック画像ジェネレーター
 *
 * - "success": 固定の赤い1x1 PNG を返す
 * - "prompt_echo": プロンプト文字列を画像データとして返す（テスト確認用）
 * - "rate_limit": 429 エラーを投げる
 * - "server_error": 500 エラーを投げる
 * - "safety_block": safety block エラーを投げる
 * - "timeout": タイムアウトエラーを投げる
 */
export class MockImageGenerator implements ImageGenerator {
  private callCount = 0;

  constructor(private scenario: MockScenario = "success") {}

  setScenario(scenario: MockScenario): void {
    this.scenario = scenario;
  }

  getCallCount(): number {
    return this.callCount;
  }

  async countTokens(prompt: string): Promise<{ totalTokens: number }> {
    // 簡易推定: 日本語1文字=2トークン, 英語1単語=1トークン
    const estimatedTokens = Math.ceil(prompt.length * 1.5);
    return { totalTokens: estimatedTokens };
  }

  async generate(
    prompt: string,
    _options?: { aspectRatio?: string; imageSize?: string },
  ): Promise<ImageGenerationResult> {
    this.callCount++;

    switch (this.scenario) {
      case "rate_limit":
        throw Object.assign(
          new Error("429 Too Many Requests — レート制限に達しました。しばらく待ってから再試行してください。"),
          { code: "RATE_LIMIT" as const, status: 429 },
        );

      case "server_error":
        throw Object.assign(
          new Error("500 Internal Server Error — Gemini API でサーバーエラーが発生しました。"),
          { code: "SERVER_ERROR" as const, status: 500 },
        );

      case "safety_block":
        throw Object.assign(
          new Error("400 SAFETY — コンテンツが安全性ポリシーに違反しているため画像を生成できませんでした。"),
          { code: "SAFETY_BLOCK" as const, status: 400 },
        );

      case "timeout":
        throw Object.assign(
          new Error("画像生成がタイムアウトしました（120秒）。"),
          { code: "TIMEOUT" as const, status: 408 },
        );

      case "prompt_echo": {
        // プロンプトをBase64エンコードして返す（テストでプロンプトが正しく渡ったか確認用）
        const encoded = Buffer.from(`MOCK_IMAGE:${prompt}`, "utf8").toString("base64");
        return {
          base64: encoded,
          mimeType: "text/plain",
          prompt,
          tokenInfo: { inputTokens: Math.ceil(prompt.length * 1.5), outputTokens: 100 },
        };
      }

      case "success":
      default:
        // 固定の赤い 1x1 PNG を返す
        return {
          base64: TINY_RED_PNG,
          mimeType: "image/png",
          prompt,
          tokenInfo: { inputTokens: Math.ceil(prompt.length * 1.5), outputTokens: 500 },
        };
    }
  }
}

// ---- Factory ----

let currentGenerator: ImageGenerator | null = null;

export function getImageGenerator(apiKey?: string): ImageGenerator {
  if (currentGenerator) return currentGenerator;
  if (process.env.IMAGE_GENERATOR_MOCK === "true") {
    const scenario = (process.env.IMAGE_GENERATOR_MOCK_SCENARIO ?? "success") as MockScenario;
    return new MockImageGenerator(scenario);
  }
  if (!apiKey) throw new Error("Gemini API キーが設定されていません");
  return new RealGeminiImageGenerator(apiKey);
}

export function setImageGenerator(generator: ImageGenerator): void {
  currentGenerator = generator;
}

export function resetImageGenerator(): void {
  currentGenerator = null;
}
