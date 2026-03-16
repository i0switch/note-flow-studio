import { env } from "../config.js";
import { GeminiProvider, type AiProvider } from "../providers/ai-provider.js";
import { ClaudeProvider } from "../providers/claude-provider.js";
import { OpenAICompatibleProvider } from "../providers/openai-compatible-provider.js";
import { GitHubCopilotProvider } from "../providers/github-copilot-provider.js";
import { CodexProvider, readLocalCodexToken } from "../providers/codex-provider.js";
import type { SaasHubStateService } from "./saas-hub-state-service.js";

export type ProviderId =
  | "gemini"
  | "claude"
  | "openai"
  | "codex_cli"
  | "github_copilot"
  | "alibaba_model_studio"
  | "alibaba_coding"
  | "openrouter"
  | "groq"
  | "deepseek"
  | "xai"
  | "custom_openai_compatible";

export type ProviderAuthMode = "api_key" | "oauth" | "local_auth";
export type ProviderTestStatus = "completed" | "pending" | "error";

export type ProviderSummary = {
  id: ProviderId;
  label: string;
  authMode: ProviderAuthMode;
  configured: boolean;
  reachable: boolean;
  usable: boolean;
  enabled: boolean;
  model: string;
  baseUrl: string | null;
  lastTestStatus: ProviderTestStatus;
  lastTestError: string | null;
  lastTestAt: string | null;
  oauthClientSource?: "builtin" | "config" | "none";
  configuredClientId?: string | null;
};

const PROVIDER_LABELS: Record<ProviderId, string> = {
  gemini: "Gemini",
  claude: "Claude",
  openai: "OpenAI",
  codex_cli: "Codex CLI",
  github_copilot: "GitHub Copilot",
  alibaba_model_studio: "Alibaba Model Studio",
  alibaba_coding: "Alibaba CodingPlan",
  openrouter: "OpenRouter",
  groq: "Groq",
  deepseek: "DeepSeek",
  xai: "xAI",
  custom_openai_compatible: "Custom OpenAI互換",
};

const PROVIDER_MODELS: Record<ProviderId, string> = {
  gemini: "gemini-2.0-flash",
  claude: "claude-3-7-sonnet-latest",
  openai: "gpt-4.1-mini",
  codex_cli: "codex-mini-latest",
  github_copilot: "github-copilot/gpt-5.4",
  alibaba_model_studio: "qwen-plus",
  alibaba_coding: "qwen-coder-plus",
  openrouter: "openai/gpt-4.1-mini",
  groq: "llama-3.3-70b-versatile",
  deepseek: "deepseek-chat",
  xai: "grok-3-mini",
  custom_openai_compatible: "custom-model",
};

const PROVIDER_BASE_URLS: Partial<Record<ProviderId, string>> = {
  openai: "https://api.openai.com/v1",
  alibaba_model_studio: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  alibaba_coding: "https://coding-intl.dashscope.aliyuncs.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
  deepseek: "https://api.deepseek.com/v1",
  xai: "https://api.x.ai/v1",
  custom_openai_compatible: "",
};

const ALL_PROVIDER_IDS: ProviderId[] = [
  "gemini",
  "claude",
  "openai",
  "codex_cli",
  "github_copilot",
  "alibaba_model_studio",
  "alibaba_coding",
  "openrouter",
  "groq",
  "deepseek",
  "xai",
  "custom_openai_compatible",
];

function makeDefault(id: ProviderId): ProviderSummary {
  return {
    id,
    label: PROVIDER_LABELS[id],
    authMode: id === "github_copilot" ? "oauth" : "api_key",
    configured: false,
    reachable: false,
    usable: false,
    enabled: id !== "xai" && id !== "groq",
    model: PROVIDER_MODELS[id],
    baseUrl: PROVIDER_BASE_URLS[id] ?? null,
    lastTestStatus: "pending",
    lastTestError: null,
    lastTestAt: null,
    ...(id === "github_copilot" ? { oauthClientSource: "none" as const, configuredClientId: null } : {}),
    ...(id === "codex_cli" ? { authMode: "local_auth" as const } : {}),
  };
}

type ProviderConfig = {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  authPath?: string;
};

export class ProviderRegistry {
  private summaries: Record<ProviderId, ProviderSummary>;
  private providerConfigs: Partial<Record<ProviderId, ProviderConfig>> = {};

  constructor(
    private readonly aiProvider: AiProvider,
    private readonly stateService: SaasHubStateService
  ) {
    this.summaries = Object.fromEntries(
      ALL_PROVIDER_IDS.map((id) => [id, makeDefault(id)])
    ) as Record<ProviderId, ProviderSummary>;

    // Mark Gemini as configured/usable if API key is present
    if (env.GEMINI_API_KEY) {
      this.summaries.gemini = {
        ...this.summaries.gemini,
        configured: true,
        reachable: true,
        usable: true,
        model: env.GEMINI_MODEL,
      };
    }
  }

  /** Merge persisted summaries from sidecar JSON */
  async hydrate(): Promise<void> {
    const state = await this.stateService.load();
    if (!state) return;
    const persisted = (state as Record<string, unknown>).providerSummaries as
      | Record<string, ProviderSummary>
      | undefined;
    if (persisted) {
      for (const id of ALL_PROVIDER_IDS) {
        if (persisted[id]) {
          this.summaries[id] = { ...this.summaries[id], ...persisted[id] };
        }
      }
    }
    const configs = (state as Record<string, unknown>).providerConfigs as
      | Partial<Record<ProviderId, ProviderConfig>>
      | undefined;
    if (configs) {
      this.providerConfigs = { ...this.providerConfigs, ...configs };
    }
    // Always keep Gemini in sync with env
    if (env.GEMINI_API_KEY) {
      this.summaries.gemini.configured = true;
      this.summaries.gemini.reachable = true;
      this.summaries.gemini.usable = true;
      this.summaries.gemini.model = env.GEMINI_MODEL;
    }

    // Auto-restore GitHub Copilot usable state if auth tokens are present in sidecar
    const copilotAuth = (state as Record<string, unknown>).githubCopilotAuth as
      | { githubToken?: string }
      | undefined;
    if (copilotAuth?.githubToken) {
      this.summaries.github_copilot.configured = true;
      this.summaries.github_copilot.usable = true;
      this.summaries.github_copilot.reachable = true;
    }

    // Auto-detect Codex CLI local auth (~/.codex/auth.json)
    const codexToken = await readLocalCodexToken().catch(() => null);
    if (codexToken) {
      this.summaries.codex_cli.configured = true;
      this.summaries.codex_cli.usable = true;
    }

    // Always enforce disabled state for xAI and Groq unless explicitly enabled via persisted config
    if (!persisted?.xai?.enabled) this.summaries.xai.enabled = false;
    if (!persisted?.groq?.enabled) this.summaries.groq.enabled = false;
  }

  getAll(): Record<ProviderId, ProviderSummary> {
    return { ...this.summaries };
  }

  getOne(id: ProviderId): ProviderSummary | undefined {
    return this.summaries[id];
  }

  async updateOne(
    id: ProviderId,
    patch: Partial<Pick<ProviderSummary, "configured" | "usable" | "reachable" | "enabled" | "model" | "baseUrl" | "configuredClientId">>,
    apiKey?: string,
  ): Promise<ProviderSummary> {
    this.summaries[id] = { ...this.summaries[id], ...patch };
    if (apiKey !== undefined) {
      this.providerConfigs[id] = {
        ...(this.providerConfigs[id] ?? {}),
        apiKey,
        model: patch.model ?? this.summaries[id].model,
        baseUrl: patch.baseUrl ?? this.summaries[id].baseUrl ?? undefined,
      };
    }
    await this.persistSummaries();
    return this.summaries[id];
  }

  /** Create a live AiProvider instance for the given id */
  createProvider(id: ProviderId): AiProvider | null {
    const summary = this.summaries[id];
    if (!summary?.usable) return null;
    const config = this.providerConfigs[id] ?? {};
    const apiKey = config.apiKey ?? "";
    const model = config.model ?? summary.model;
    const baseUrl = config.baseUrl ?? summary.baseUrl ?? "";

    switch (id) {
      case "gemini":
        return new GeminiProvider({ getApiKey: () => env.GEMINI_API_KEY, model: env.GEMINI_MODEL, mockMode: false });
      case "claude":
        return new ClaudeProvider({ apiKey, model });
      case "openai":
        return new OpenAICompatibleProvider({ providerName: "OpenAI", apiKey, model, baseUrl: baseUrl || "https://api.openai.com/v1" });
      case "openrouter":
        return new OpenAICompatibleProvider({ providerName: "OpenRouter", apiKey, model, baseUrl: baseUrl || "https://openrouter.ai/api/v1" });
      case "groq":
        return new OpenAICompatibleProvider({ providerName: "Groq", apiKey, model, baseUrl: baseUrl || "https://api.groq.com/openai/v1" });
      case "deepseek":
        return new OpenAICompatibleProvider({ providerName: "DeepSeek", apiKey, model, baseUrl: baseUrl || "https://api.deepseek.com/v1" });
      case "xai":
        return new OpenAICompatibleProvider({ providerName: "xAI", apiKey, model, baseUrl: baseUrl || "https://api.x.ai/v1" });
      case "alibaba_model_studio":
        return new OpenAICompatibleProvider({ providerName: "Alibaba Model Studio", apiKey, model, baseUrl: baseUrl || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1" });
      case "alibaba_coding":
        return new OpenAICompatibleProvider({ providerName: "Alibaba CodingPlan", apiKey, model, baseUrl: baseUrl || "https://coding-intl.dashscope.aliyuncs.com/v1" });
      case "custom_openai_compatible":
        return new OpenAICompatibleProvider({ providerName: "Custom OpenAI互換", apiKey, model, baseUrl });
      case "github_copilot":
        return new GitHubCopilotProvider({ stateService: this.stateService, model, configuredClientId: summary.configuredClientId });
      case "codex_cli":
        return new CodexProvider({ apiKey, model });
      default:
        return null;
    }
  }

  async testOne(id: ProviderId): Promise<ProviderSummary> {
    const now = new Date().toISOString();
    const provider = id === "gemini" ? this.aiProvider : this.createProvider(id);

    if (!provider) {
      this.summaries[id] = {
        ...this.summaries[id],
        lastTestStatus: "error",
        lastTestError: "APIキーが設定されていません",
        lastTestAt: now,
      };
    } else {
      const health = await provider.healthCheck();
      this.summaries[id] = {
        ...this.summaries[id],
        lastTestStatus: health.status === "ok" ? "completed" : "error",
        lastTestError: health.status !== "ok" ? health.detail : null,
        lastTestAt: now,
        ...(health.status === "ok" ? { configured: true, reachable: true, usable: true } : {}),
      };
    }
    await this.persistSummaries();
    return this.summaries[id];
  }

  private async persistSummaries(): Promise<void> {
    const state = (await this.stateService.load()) ?? {};
    await this.stateService.save({
      ...state,
      providerSummaries: this.summaries,
      providerConfigs: this.providerConfigs,
    });
  }
}
