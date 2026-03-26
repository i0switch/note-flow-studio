import { describe, it, expect, beforeEach } from "vitest";
import {
  MockImageGenerator,
  RealGeminiImageGenerator,
  type MockScenario,
} from "../imageGenerator";

describe("MockImageGenerator", () => {
  let mock: MockImageGenerator;

  beforeEach(() => {
    mock = new MockImageGenerator("success");
  });

  it("success: 固定PNGを返す", async () => {
    const result = await mock.generate("テストプロンプト");
    expect(result.mimeType).toBe("image/png");
    expect(result.base64).toBeTruthy();
    expect(result.base64.length).toBeGreaterThan(10);
    expect(result.prompt).toBe("テストプロンプト");
    expect(result.tokenInfo).toBeDefined();
    expect(result.tokenInfo!.inputTokens).toBeGreaterThan(0);
  });

  it("prompt_echo: プロンプトをBase64エンコードして返す", async () => {
    mock.setScenario("prompt_echo");
    const result = await mock.generate("ネコヤナギ画像");
    expect(result.mimeType).toBe("text/plain");
    const decoded = Buffer.from(result.base64, "base64").toString("utf8");
    expect(decoded).toBe("MOCK_IMAGE:ネコヤナギ画像");
  });

  it("rate_limit: 429エラーを投げる", async () => {
    mock.setScenario("rate_limit");
    try {
      await mock.generate("テスト");
      expect.fail("Should have thrown");
    } catch (err) {
      const e = err as Error & { code: string; status: number };
      expect(e.code).toBe("RATE_LIMIT");
      expect(e.status).toBe(429);
      expect(e.message).toContain("レート制限");
    }
  });

  it("server_error: 500エラーを投げる", async () => {
    mock.setScenario("server_error");
    try {
      await mock.generate("テスト");
      expect.fail("Should have thrown");
    } catch (err) {
      const e = err as Error & { code: string; status: number };
      expect(e.code).toBe("SERVER_ERROR");
      expect(e.status).toBe(500);
    }
  });

  it("safety_block: safetyエラーを投げる", async () => {
    mock.setScenario("safety_block");
    try {
      await mock.generate("テスト");
      expect.fail("Should have thrown");
    } catch (err) {
      const e = err as Error & { code: string; status: number };
      expect(e.code).toBe("SAFETY_BLOCK");
      expect(e.status).toBe(400);
    }
  });

  it("timeout: タイムアウトエラーを投げる", async () => {
    mock.setScenario("timeout");
    try {
      await mock.generate("テスト");
      expect.fail("Should have thrown");
    } catch (err) {
      const e = err as Error & { code: string; status: number };
      expect(e.code).toBe("TIMEOUT");
      expect(e.status).toBe(408);
    }
  });

  it("countTokens: トークン数を推定する", async () => {
    const result = await mock.countTokens("テスト文字列");
    expect(result.totalTokens).toBeGreaterThan(0);
    // 6文字 * 1.5 = 9
    expect(result.totalTokens).toBe(9);
  });

  it("callCount: 呼び出し回数を追跡する", async () => {
    expect(mock.getCallCount()).toBe(0);
    await mock.generate("1回目");
    expect(mock.getCallCount()).toBe(1);
    await mock.generate("2回目");
    expect(mock.getCallCount()).toBe(2);
  });

  it("シナリオを動的に切り替えられる", async () => {
    // まず成功
    const r1 = await mock.generate("テスト");
    expect(r1.mimeType).toBe("image/png");

    // エラーに切り替え
    mock.setScenario("rate_limit");
    try {
      await mock.generate("テスト");
      expect.fail("Should have thrown");
    } catch (err) {
      expect((err as { code: string }).code).toBe("RATE_LIMIT");
    }

    // また成功に戻す
    mock.setScenario("success");
    const r3 = await mock.generate("テスト");
    expect(r3.mimeType).toBe("image/png");
  });
});

describe("RealGeminiImageGenerator", () => {
  it("APIキーなしでインスタンス化できる", () => {
    const real = new RealGeminiImageGenerator("dummy-key");
    expect(real).toBeDefined();
  });

  // 実際のAPI呼び出しテストはCI/CDでは実行しない
  // 手動テスト時は GEMINI_API_KEY 環境変数を設定して以下を有効化:
  //
  // it.skip("実際のGemini APIでcount_tokensが動く", async () => {
  //   const real = new RealGeminiImageGenerator(process.env.GEMINI_API_KEY!);
  //   const result = await real.countTokens("テストプロンプト");
  //   expect(result.totalTokens).toBeGreaterThan(0);
  //   console.log("Token count:", result.totalTokens);
  // });
});
