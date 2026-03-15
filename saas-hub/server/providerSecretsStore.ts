import fs from "node:fs/promises";
import path from "node:path";

export type ProviderId =
  | "gemini"
  | "claude"
  | "openai"
  | "codex_cli"
  | "github_copilot"
  | "alibaba_model_studio"
  | "openrouter"
  | "groq"
  | "deepseek"
  | "xai"
  | "custom_openai_compatible";

export type ProviderSecretRecord = {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  authPath?: string;
  enabled?: boolean;
  oauthClientSource?: "builtin" | "config" | "none";
  configuredClientId?: string | null;
  githubToken?: string | null;
  copilotToken?: string | null;
  copilotTokenExpiresAt?: string | null;
  lastExchangeStatus?: string | null;
  lastExchangeError?: string | null;
  workspace?: string | null;
};

export type ProviderSecretStore = Record<ProviderId, ProviderSecretRecord>;

const dataDir = path.resolve(process.cwd(), "server", "data");
const secretsFile = path.join(dataDir, "provider-secrets.json");

const defaultStore = (): ProviderSecretStore => ({
  gemini: { model: "gemini-2.0-flash" },
  claude: { model: "claude-3-7-sonnet-latest" },
  openai: { model: "gpt-4.1-mini", baseUrl: "https://api.openai.com/v1" },
  codex_cli: { model: "gpt-5-codex", authPath: "C:\\Users\\i0swi\\.codex\\auth.json", enabled: true },
  github_copilot: { model: "github-copilot/gpt-5.4", oauthClientSource: "none", configuredClientId: null },
  alibaba_model_studio: { model: "qwen-plus", baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1" },
  openrouter: { model: "openai/gpt-4.1-mini", baseUrl: "https://openrouter.ai/api/v1" },
  groq: { model: "llama-3.3-70b-versatile", baseUrl: "https://api.groq.com/openai/v1" },
  deepseek: { model: "deepseek-chat", baseUrl: "https://api.deepseek.com/v1" },
  xai: { model: "grok-3-mini", baseUrl: "https://api.x.ai/v1" },
  custom_openai_compatible: { model: "custom-model", baseUrl: "" },
});

export const loadProviderSecrets = async (): Promise<ProviderSecretStore> => {
  try {
    const raw = await fs.readFile(secretsFile, "utf8");
    return { ...defaultStore(), ...(JSON.parse(raw) as Partial<ProviderSecretStore>) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return defaultStore();
    }
    throw error;
  }
};

export const saveProviderSecrets = async (store: ProviderSecretStore) => {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(secretsFile, JSON.stringify(store, null, 2), "utf8");
};

export const updateProviderSecrets = async (providerId: ProviderId, patch: ProviderSecretRecord) => {
  const current = await loadProviderSecrets();
  current[providerId] = {
    ...current[providerId],
    ...patch,
  };
  await saveProviderSecrets(current);
  return current[providerId];
};
