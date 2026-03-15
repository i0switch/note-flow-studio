import type {
  ApplySaleSettingsInput,
  GenerationJobDetail,
  GenerationJobCreateInput,
  GenerationJobSummary,
  NoteAccountInput,
  PromptTemplateInput,
  ReferenceMaterialImportInput,
  SaveNoteRequest,
  SetupSaveInput,
  SetupStatus,
  SettingsInput
} from "@note-local/shared";

export type AccountRecord = NoteAccountInput & { id: number };
export type PromptTemplateRecord = PromptTemplateInput & { id: number };
export type ReferenceRecord = {
  id: number;
  title: string;
  summaryText: string;
  sourceType: "url" | "text" | "file";
};
export type DiagnosticRecord = {
  name: string;
  status: "ok" | "warn" | "error";
  detail: string;
};
export type SetupInstallResponse = {
  result: "success";
  output: string;
};

const apiFetch = async <T>(path: string, init?: RequestInit) => {
  const response = await fetch(`/api${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error?.message ?? "API request failed");
  }
  return (await response.json()) as T;
};

export const api = {
  getSetupStatus: () => apiFetch<SetupStatus>("/setup/status"),
  getSetupDependencies: () => apiFetch<DiagnosticRecord[]>("/setup/dependencies"),
  saveSetup: (input: SetupSaveInput) =>
    apiFetch<SetupStatus>("/setup/save", { method: "POST", body: JSON.stringify(input) }),
  installPlaywright: () =>
    apiFetch<SetupInstallResponse>("/setup/install-playwright", {
      method: "POST",
      body: JSON.stringify({ browser: "chromium" })
    }),
  repairEnvironment: () =>
    apiFetch<SetupInstallResponse>("/setup/repair", { method: "POST", body: JSON.stringify({}) }),
  captureSession: () =>
    apiFetch<any>("/setup/capture-session", { method: "POST", body: JSON.stringify({}) }),
  getSettings: () => apiFetch<SettingsInput>("/settings"),
  updateSettings: (input: SettingsInput) =>
    apiFetch<SettingsInput>("/settings", { method: "PUT", body: JSON.stringify(input) }),
  getAccounts: () => apiFetch<AccountRecord[]>("/note-accounts"),
  createAccount: (input: NoteAccountInput) =>
    apiFetch<AccountRecord>("/note-accounts", { method: "POST", body: JSON.stringify(input) }),
  updateAccount: (id: number, input: NoteAccountInput) =>
    apiFetch<AccountRecord>(`/note-accounts/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  getPromptTemplates: () => apiFetch<PromptTemplateRecord[]>("/prompt-templates"),
  createPromptTemplate: (input: PromptTemplateInput) =>
    apiFetch<PromptTemplateRecord>("/prompt-templates", { method: "POST", body: JSON.stringify(input) }),
  getSalesProfiles: () => apiFetch("/sales-profiles"),
  importReference: (input: ReferenceMaterialImportInput) =>
    apiFetch<ReferenceRecord>("/reference-materials/import", { method: "POST", body: JSON.stringify(input) }),
  getReferences: () => apiFetch<ReferenceRecord[]>("/reference-materials"),
  createJob: (input: GenerationJobCreateInput) =>
    apiFetch<{ id: number }>("/generation-jobs", { method: "POST", body: JSON.stringify(input) }),
  listJobs: () => apiFetch<GenerationJobSummary[]>("/generation-jobs"),
  getJob: (id: number) => apiFetch<GenerationJobDetail>(`/generation-jobs/${id}`),
  saveJob: (id: number, input: SaveNoteRequest) =>
    apiFetch(`/generation-jobs/${id}/save-note`, { method: "POST", body: JSON.stringify(input) }),
  publishJob: (id: number, input: SaveNoteRequest) =>
    apiFetch(`/generation-jobs/${id}/publish-note`, { method: "POST", body: JSON.stringify(input) }),
  regenerateGraphs: (id: number) =>
    apiFetch(`/generation-jobs/${id}/generate-graphs`, { method: "POST" }),
  applySaleSettings: (id: number, input: ApplySaleSettingsInput) =>
    apiFetch(`/generation-jobs/${id}/apply-note-sale-settings`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  runDiagnostics: () => apiFetch<DiagnosticRecord[]>("/diagnostics/run"),
  verifyPinchTab: () =>
    apiFetch("/browser-automation/pinchtab/verify", { method: "POST", body: JSON.stringify({}) })
};
