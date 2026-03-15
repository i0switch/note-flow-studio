import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NoteAccountInput, SettingsInput } from "@note-local/shared";
import { useState } from "react";
import type { AccountRecord, DiagnosticRecord } from "../api";
import { api } from "../api";
import { Field } from "../components/ui";

const SettingsPage = () => {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery<SettingsInput>({ queryKey: ["settings"], queryFn: api.getSettings });
  const { data: accounts = [] } = useQuery<AccountRecord[]>({ queryKey: ["accounts"], queryFn: api.getAccounts });
  const { data: diagnostics = [] } = useQuery<DiagnosticRecord[]>({
    queryKey: ["diagnostics"],
    queryFn: api.runDiagnostics
  });
  const { data: setupDependencies = [] } = useQuery<DiagnosticRecord[]>({
    queryKey: ["setup-dependencies"],
    queryFn: api.getSetupDependencies
  });
  const [settingsForm, setSettingsForm] = useState<SettingsInput | null>(null);
  const [accountForm, setAccountForm] = useState<NoteAccountInput>({
    displayName: "",
    saveModePriority: "api_first",
    browserAdapterPriority: "auto",
    fallbackEnabled: true,
    isActive: true
  });
  const settingsMutation = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["settings"] })
  });
  const accountMutation = useMutation({
    mutationFn: api.createAccount,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setAccountForm({
        displayName: "",
        saveModePriority: "api_first",
        browserAdapterPriority: "auto",
        fallbackEnabled: true,
        isActive: true
      });
    }
  });

  if (!settings) return <div className="card p-6">読み込み中...</div>;
  const currentSettings = settingsForm ?? settings;

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">SCR-010 / SCR-011</p>
        <h2 className="mb-4 text-2xl font-black text-ink">設定 / 診断</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="localhost Port"><input className="field" type="number" value={currentSettings.localhostPort} onChange={(event) => setSettingsForm({ ...currentSettings, localhostPort: Number(event.target.value) })} /></Field>
          <Field label="Gemini API Key">
            <input 
              className="field" 
              type="password" 
              placeholder="AI生成に使用するキー"
              value={currentSettings.geminiApiKey ?? ""} 
              onChange={(event) => setSettingsForm({ ...currentSettings, geminiApiKey: event.target.value })} 
            />
          </Field>
          <Field label="Gemini Model"><input className="field" value={currentSettings.geminiModel} onChange={(event) => setSettingsForm({ ...currentSettings, geminiModel: event.target.value })} /></Field>
          <Field label="PinchTab URL"><input className="field" value={currentSettings.pinchtabBaseUrl} onChange={(event) => setSettingsForm({ ...currentSettings, pinchtabBaseUrl: event.target.value })} /></Field>
        </div>
        <div className="mt-4 flex gap-3"><button className="button-primary" onClick={() => settingsMutation.mutate(currentSettings)}>設定を保存</button></div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[...diagnostics, ...setupDependencies].map((item, index) => <div key={`${item.name}-${index}`} className="rounded-2xl border border-stone-200 bg-stone-50 p-4"><div className="font-semibold">{item.name}</div><div className="text-sm uppercase tracking-[0.2em] text-gold">{item.status}</div><div className="mt-1 text-sm text-stone-600">{item.detail}</div></div>)}
        </div>
      </section>
      <section className="card p-6">
        <h3 className="mb-4 text-xl font-black text-ink">noteアカウント</h3>
        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <Field label="表示名"><input className="field" value={accountForm.displayName} onChange={(event) => setAccountForm({ ...accountForm, displayName: event.target.value })} /></Field>
          <Field label="保存優先順位">
            <select className="field" value={accountForm.saveModePriority} onChange={(event) => setAccountForm({ ...accountForm, saveModePriority: event.target.value as "api_first" | "browser_first" })}>
              <option value="api_first">api_first</option>
              <option value="browser_first">browser_first</option>
            </select>
          </Field>
        </div>
        <button className="button-primary" onClick={() => accountMutation.mutate(accountForm)}>アカウント追加</button>
        <div className="mt-4 space-y-2">
          {accounts.map((account) => <div key={account.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm">{account.displayName} / {account.saveModePriority} / {account.browserAdapterPriority}</div>)}
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;
