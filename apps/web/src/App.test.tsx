import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

const baseResponses: Record<string, unknown> = {
  "/api/setup/status": {
    isConfigured: true,
    distributionMode: "development",
    envFilePath: ".env",
    appDataDir: "./apps/server/data",
    fields: {
      hasGeminiApiKey: true,
      hasNoteLoginId: true,
      hasNoteLoginPassword: true,
      pinchtabBaseUrl: "http://localhost:9867",
      pinchtabProfileName: "note-live",
      playwrightHeadless: false
    }
  },
  "/api/setup/dependencies": [],
  "/api/note-accounts": [
    {
      id: 1,
      displayName: "main",
      saveModePriority: "api_first",
      browserAdapterPriority: "auto",
      fallbackEnabled: true,
      isActive: true
    }
  ],
  "/api/prompt-templates": [
    {
      id: 1,
      name: "標準note記事",
      purpose: "note向け販売記事",
      targetMedia: "note",
      genreScope: "all",
      articleSystemPrompt: "",
      articleUserPromptTemplate: "",
      referencePromptTemplate: "",
      salesTransitionTemplate: "",
      graphPromptTemplate: "",
      imagePromptTemplate: ""
    }
  ],
  "/api/reference-materials": [],
  "/api/generation-jobs": [],
  "/api/settings": {
    localhostPort: 3001,
    defaultAiProvider: "gemini",
    geminiModel: "gemini-2.0-flash",
    pinchtabBaseUrl: "http://localhost:9867",
    debugMode: false,
    logRetentionDays: 14,
    enableGenreAutoDetection: true,
    defaultTimeoutSec: 60
  },
  "/api/diagnostics/run": []
};

describe("App", () => {
  it("ダッシュボードを表示する", async () => {
    const responses = { ...baseResponses };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const key = typeof input === "string" ? input : input.toString();
        return new Response(JSON.stringify(responses[key] ?? {}), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      })
    );

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("記事生成")).toBeInTheDocument();
    });
    expect(screen.getByText("実行履歴")).toBeInTheDocument();
  });

  it("未設定ならセットアップ画面を表示する", async () => {
    const responses: Record<string, unknown> = {
      ...baseResponses,
      "/api/setup/status": {
        ...(baseResponses["/api/setup/status"] as Record<string, unknown>),
        isConfigured: false
      }
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const key = typeof input === "string" ? input : input.toString();
        return new Response(JSON.stringify(responses[key] ?? {}), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      })
    );

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("購入者PCでそのまま動かす配布版セットアップ")).toBeInTheDocument();
    });
  });
});
