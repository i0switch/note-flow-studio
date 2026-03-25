import { PageWrapper } from "@/components/PageWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppData } from "@/context/AppDataContext";
import { providerLabels, type ProviderId } from "@/lib/app-data";
import {
  disconnectGitHubCopilot,
  fetchCodexCliStatus,
  fetchGitHubCopilotStatus,
  getNoteSessionStatus,
  pollGitHubCopilotDeviceFlow,
  startGitHubCopilotDeviceFlow,
} from "@/lib/note-api";
import { Eye, EyeOff, Globe, Key, Plus, RefreshCw, Save, Tag, Trash2, UserPlus, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DEFAULT_GENRES } from "@/lib/app-data";

const providerOrder: ProviderId[] = [
  "gemini",
  "claude",
  "openai",
  "codex_cli",
  "github_copilot",
  "alibaba_model_studio",
  "openrouter",
  "groq",
  "deepseek",
  "xai",
  "custom_openai_compatible",
];

type ProviderDraft = {
  apiKey: string;
  model: string;
  baseUrl: string;
  authPath: string;
  enabled: boolean;
  configuredClientId: string;
  workspace: string;
};

const createDraft = (providerId: ProviderId, settings: ReturnType<typeof useAppData>["state"]["settings"]): ProviderDraft => {
  const provider = settings.providerSummaries[providerId];
  return {
    apiKey: "",
    model: provider?.model ?? "",
    baseUrl: provider?.baseUrl ?? "",
    authPath: providerId === "codex_cli" ? "C:\\Users\\i0swi\\.codex\\auth.json" : "",
    enabled: provider?.enabled ?? true,
    configuredClientId: provider?.configuredClientId ?? "",
    workspace: "",
  };
};

export default function SettingsPage() {
  const {
    state,
    addAccount,
    deleteAccount,
    captureAccountSession,
    refreshProviders,
    saveProviderConfig,
    saveSettings,
    testProviderConnection,
  } = useAppData();
  const [capturingSessionId, setCapturingSessionId] = useState<string | null>(null);
  const [newAccountName, setNewAccountName] = useState("");
  const [localhostPort, setLocalhostPort] = useState(String(state.settings.localhostPort));
  const [playwrightHeadless, setPlaywrightHeadless] = useState(state.settings.playwrightHeadless);
  const [pinchTabUrl, setPinchTabUrl] = useState(state.settings.pinchTabUrl);
  const [pinchTabPort, setPinchTabPort] = useState(String(state.settings.pinchTabPort));
  const [pinchTabToken, setPinchTabToken] = useState(state.settings.pinchTabToken);
  const [pinchTabProfileName, setPinchTabProfileName] = useState(state.settings.pinchTabProfileName);
  const [noteUnofficialApiUrl, setNoteUnofficialApiUrl] = useState(state.settings.noteUnofficialApiUrl);
  const [noteUnofficialApiToken, setNoteUnofficialApiToken] = useState(state.settings.noteUnofficialApiToken);
  const [preferPinchTab, setPreferPinchTab] = useState(state.settings.preferPinchTab);
  const [defaultProvider, setDefaultProvider] = useState<ProviderId>(state.settings.defaultProvider);
  const [fallbackProviders, setFallbackProviders] = useState(state.settings.fallbackProviders.join(","));
  const [strictProviderMode, setStrictProviderMode] = useState(state.settings.strictProviderMode);
  const [generationTimeoutMs, setGenerationTimeoutMs] = useState(String(state.settings.generationTimeoutMs));
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>(state.settings.defaultProvider);
  const [providerDrafts, setProviderDrafts] = useState<Record<ProviderId, ProviderDraft>>(() =>
    Object.fromEntries(providerOrder.map((providerId) => [providerId, createDraft(providerId, state.settings)])) as Record<ProviderId, ProviderDraft>,
  );
  const [showApiKey, setShowApiKey] = useState(false);
  const [copilotFlow, setCopilotFlow] = useState<{
    deviceCode: string;
    userCode: string;
    verificationUri: string;
  } | null>(null);
  const [copilotStatusText, setCopilotStatusText] = useState("未確認");
  const [codexStatusText, setCodexStatusText] = useState("未確認");
  const [savingProvider, setSavingProvider] = useState<ProviderId | null>(null);
  const [testingProvider, setTestingProvider] = useState<ProviderId | null>(null);
  const [genres, setGenres] = useState<string[]>(state.settings.genres?.length ? state.settings.genres : DEFAULT_GENRES);
  const [newGenreInput, setNewGenreInput] = useState("");

  useEffect(() => {
    setLocalhostPort(String(state.settings.localhostPort));
    setPlaywrightHeadless(state.settings.playwrightHeadless);
    setPinchTabUrl(state.settings.pinchTabUrl);
    setPinchTabPort(String(state.settings.pinchTabPort));
    setPinchTabToken(state.settings.pinchTabToken);
    setPinchTabProfileName(state.settings.pinchTabProfileName);
    setNoteUnofficialApiUrl(state.settings.noteUnofficialApiUrl);
    setNoteUnofficialApiToken(state.settings.noteUnofficialApiToken);
    setPreferPinchTab(state.settings.preferPinchTab);
    setDefaultProvider(state.settings.defaultProvider);
    setFallbackProviders(state.settings.fallbackProviders.join(","));
    setStrictProviderMode(state.settings.strictProviderMode);
    setGenerationTimeoutMs(String(state.settings.generationTimeoutMs));
    setProviderDrafts(
      Object.fromEntries(providerOrder.map((providerId) => [providerId, createDraft(providerId, state.settings)])) as Record<ProviderId, ProviderDraft>,
    );
    setGenres(state.settings.genres?.length ? state.settings.genres : DEFAULT_GENRES);
  }, [state.settings]);

  const selectedProviderSummary = state.settings.providerSummaries[selectedProvider];
  const selectedDraft = providerDrafts[selectedProvider];
  const supportsApiKey = !["codex_cli", "github_copilot"].includes(selectedProvider);
  const supportsBaseUrl = ["openai", "alibaba_model_studio", "openrouter", "groq", "deepseek", "xai", "custom_openai_compatible", "github_copilot"].includes(selectedProvider);

  const fallbackOptions = useMemo(
    () =>
      fallbackProviders
        .split(",")
        .map((value) => value.trim() as ProviderId)
        .filter((value): value is ProviderId => providerOrder.includes(value))
        .filter((value, index, array) => array.indexOf(value) === index && value !== defaultProvider),
    [defaultProvider, fallbackProviders],
  );

  const patchDraft = (providerId: ProviderId, patch: Partial<ProviderDraft>) => {
    setProviderDrafts((current) => ({
      ...current,
      [providerId]: {
        ...current[providerId],
        ...patch,
      },
    }));
  };

  const handleAddGenre = () => {
    const trimmed = newGenreInput.trim();
    if (!trimmed) return;
    if (genres.includes(trimmed)) { toast.error("同じジャンルがすでに登録されています"); return; }
    setGenres((prev) => [...prev, trimmed]);
    setNewGenreInput("");
  };

  const handleRemoveGenre = (genre: string) => {
    if (genres.length <= 1) { toast.error("ジャンルは1つ以上必要です"); return; }
    setGenres((prev) => prev.filter((g) => g !== genre));
  };

  const handleSaveBasic = () => {
    saveSettings({
      localhostPort: Number(localhostPort),
      playwrightHeadless,
      pinchTabUrl,
      pinchTabPort: Number(pinchTabPort),
      pinchTabToken,
      pinchTabProfileName,
      preferPinchTab,
      defaultProvider,
      fallbackProviders: fallbackOptions,
      strictProviderMode,
      generationTimeoutMs: Number(generationTimeoutMs),
      genres,
    });
    toast.success("基本設定を保存しました");
  };

  const handleSaveNote = () => {
    saveSettings({
      noteUnofficialApiUrl,
      noteUnofficialApiToken,
    });
    toast.success("note設定を保存しました");
  };

  const handleSaveProvider = async () => {
    setSavingProvider(selectedProvider);
    try {
      const draft = providerDrafts[selectedProvider];
      await saveProviderConfig(selectedProvider, {
        apiKey: supportsApiKey ? draft.apiKey : undefined,
        model: draft.model,
        baseUrl: supportsBaseUrl ? draft.baseUrl : undefined,
        authPath: selectedProvider === "codex_cli" ? draft.authPath : undefined,
        enabled: draft.enabled,
        configuredClientId: selectedProvider === "github_copilot" ? draft.configuredClientId || null : undefined,
        workspace: selectedProvider === "alibaba_model_studio" ? draft.workspace || null : undefined,
      });
      await refreshProviders();
      toast.success(`${providerLabels[selectedProvider]} の設定を保存しました`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AIプロバイダ設定の保存に失敗しました");
    } finally {
      setSavingProvider(null);
    }
  };

  const handleTestProvider = async () => {
    setTestingProvider(selectedProvider);
    try {
      const provider = await testProviderConnection(selectedProvider);
      toast.success(
        provider.usable
          ? `${provider.label} の接続を確認しました`
          : `${provider.label} は設定済みですが、まだ利用準備が完了していません`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "接続テストに失敗しました");
    } finally {
      setTestingProvider(null);
    }
  };

  const handleAddAccount = () => {
    if (!newAccountName.trim()) {
      toast.error("アカウント名を入力してください");
      return;
    }
    addAccount(newAccountName.trim());
    setNewAccountName("");
    toast.success("アカウントを追加しました");
  };

  const handleRefreshCodex = async () => {
    try {
      const response = await fetchCodexCliStatus();
      setCodexStatusText(
        response.status.usable
          ? `利用可能 / ${response.status.model} / ${response.status.tokenKind ?? "token"}`
          : response.status.lastTestError ?? "未検出",
      );
      toast.success(response.status.usable ? "Codex CLI認証を検出しました" : "Codex CLI認証はまだ利用できません");
      await refreshProviders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Codex CLI検出に失敗しました");
    }
  };

  const handleStartCopilot = async () => {
    try {
      const response = await startGitHubCopilotDeviceFlow();
      setCopilotFlow({
        deviceCode: response.deviceCode,
        userCode: response.userCode,
        verificationUri: response.verificationUri,
      });
      setCopilotStatusText(`認証待ち / ${response.oauthClientSource}`);
      toast.success("GitHub Copilotのデバイス認証を開始しました");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "GitHub Copilot認証の開始に失敗しました");
    }
  };

  const handlePollCopilot = async () => {
    if (!copilotFlow) {
      toast.error("先にデバイス認証を開始してください");
      return;
    }
    try {
      const response = await pollGitHubCopilotDeviceFlow(copilotFlow.deviceCode);
      setCopilotStatusText(
        response.status === "completed"
          ? "Copilot token準備完了"
          : response.status === "pending"
            ? response.detail ?? "認証待ち"
            : response.lastExchangeError ?? "交換に失敗",
      );
      await refreshProviders();
      toast.success(response.status === "completed" ? "GitHub Copilot認証が完了しました" : "GitHub側の承認を待っています");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "GitHub Copilot認証確認に失敗しました");
    }
  };

  const handleCopilotStatus = async () => {
    try {
      const response = await fetchGitHubCopilotStatus();
      setCopilotStatusText(
        response.status.copilotTokenReady
          ? "Copilot token 準備完了"
          : response.status.lastExchangeError ?? "未接続",
      );
      await refreshProviders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "GitHub Copilot 状態取得に失敗しました");
    }
  };

  const handleCopilotDisconnect = async () => {
    try {
      await disconnectGitHubCopilot();
      setCopilotFlow(null);
      setCopilotStatusText("切断しました");
      await refreshProviders();
      toast.success("GitHub Copilotを切断しました");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "GitHub Copilotの切断に失敗しました");
    }
  };

  return (
    <PageWrapper title="設定" description="note と AI provider の運用設定をまとめて調整する。">
      <Tabs defaultValue="basic">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="basic">基本設定</TabsTrigger>
          <TabsTrigger value="accounts">アカウント</TabsTrigger>
          <TabsTrigger value="note">note</TabsTrigger>
          <TabsTrigger value="ai">AI provider</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-4 space-y-4">
          <div className="card-elevated max-w-2xl space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <span className="inline-block h-4 w-1 rounded-full bg-primary" />
              localhost / 実行設定
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">サーバーポート番号</Label>
                <Input type="number" value={localhostPort} onChange={(event) => setLocalhostPort(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">生成タイムアウト(ms)</Label>
                <Input type="number" value={generationTimeoutMs} onChange={(event) => setGenerationTimeoutMs(event.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">既定プロバイダ</Label>
                <Select value={defaultProvider} onValueChange={(value) => setDefaultProvider(value as ProviderId)}>
                  <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                  <SelectContent>
                    {providerOrder.map((providerId) => (
                      <SelectItem key={providerId} value={providerId}>{providerLabels[providerId]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">代替プロバイダ</Label>
                <Input
                  value={fallbackProviders}
                  onChange={(event) => setFallbackProviders(event.target.value)}
                  placeholder="openai,claude"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">厳格プロバイダモード</span>
              <Switch checked={strictProviderMode} onCheckedChange={setStrictProviderMode} />
            </div>
          </div>

          <div className="card-elevated max-w-2xl space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <span className="inline-block h-4 w-1 rounded-full bg-primary" />
              Playwright / PinchTab
            </h2>
            <div className="flex items-center justify-between">
              <span className="text-sm">バックグラウンドブラウザ</span>
              <Switch checked={playwrightHeadless} onCheckedChange={setPlaywrightHeadless} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">PinchTab URL</Label>
                <Input placeholder="https://..." value={pinchTabUrl} onChange={(event) => setPinchTabUrl(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">PinchTab Port</Label>
                <Input type="number" value={pinchTabPort} onChange={(event) => setPinchTabPort(event.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">PinchTab Token</Label>
                <Input value={pinchTabToken} onChange={(event) => setPinchTabToken(event.target.value)} placeholder="任意" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">PinchTab Profile</Label>
                <Input value={pinchTabProfileName} onChange={(event) => setPinchTabProfileName(event.target.value)} placeholder="note-live" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">PinchTab を Playwright より優先</span>
              <Switch checked={preferPinchTab} onCheckedChange={setPreferPinchTab} />
            </div>
          </div>

          <div className="card-elevated max-w-2xl space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <span className="inline-block h-4 w-1 rounded-full bg-primary" />
              記事ジャンル
            </h2>
            <p className="text-xs text-muted-foreground">
              生成画面のジャンル選択に表示される一覧を管理できます。
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="例: マーケティング"
                value={newGenreInput}
                onChange={(e) => setNewGenreInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddGenre(); } }}
                className="flex-1"
              />
              <Button type="button" size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={handleAddGenre}>
                <Plus className="h-3.5 w-3.5" />
                追加
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {genres.map((genre) => (
                <span
                  key={genre}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-sm"
                >
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  {genre}
                  <button
                    type="button"
                    onClick={() => handleRemoveGenre(genre)}
                    className="ml-0.5 text-muted-foreground transition-colors hover:text-destructive"
                    aria-label={`${genre}を削除`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <Button className="gap-2 btn-gradient" onClick={handleSaveBasic}>
            <Save className="h-4 w-4" />
            基本設定を保存
          </Button>
        </TabsContent>

        <TabsContent value="accounts" className="mt-4 space-y-4">
          <div className="card-elevated flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">新規アカウント名</Label>
              <Input value={newAccountName} onChange={(event) => setNewAccountName(event.target.value)} placeholder="例: 運用アカウント" />
            </div>
            <Button size="sm" className="gap-1.5 btn-gradient" onClick={handleAddAccount}>
              <UserPlus className="h-3.5 w-3.5" />
              追加
            </Button>
          </div>

          <div className="space-y-3">
            {state.accounts.map((account) => (
              <div key={account.id} className="card-elevated flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{account.name}</p>
                  <p className="text-xs text-muted-foreground">優先順位: {account.priority}</p>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => { deleteAccount(account.id); toast.success("アカウントを削除しました"); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="note" className="mt-4 space-y-4">
          <div className="card-elevated max-w-2xl space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <h2 className="text-sm font-semibold">noteセッション管理</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              ブラウザを起動してnoteにログインすると、セッションが保存されます。以降の投稿はこのセッションを使用します。
            </p>
            {state.accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">アカウントタブでアカウントを追加してください。</p>
            ) : (
              <div className="space-y-3">
                {state.accounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{account.name}</p>
                      <p className="text-xs text-muted-foreground">ID: {account.id}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={capturingSessionId !== null}
                      onClick={async () => {
                        setCapturingSessionId(account.id);
                        try {
                          const result = await captureAccountSession(account.id);
                          toast.info(result.message);
                          // Poll until session file is saved (browser closed after login)
                          const startedAt = Date.now();
                          const poll = async (): Promise<void> => {
                            if (Date.now() - startedAt > 10 * 60 * 1000) {
                              setCapturingSessionId(null);
                              return;
                            }
                            const status = await getNoteSessionStatus(account.id).catch(() => ({ hasSession: false }));
                            if (status.hasSession) {
                              toast.success("noteセッションを保存しました");
                              setCapturingSessionId(null);
                              return;
                            }
                            setTimeout(() => { void poll(); }, 3000);
                          };
                          void poll();
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "セッション取得に失敗しました");
                          setCapturingSessionId(null);
                        }
                      }}
                    >
                      {capturingSessionId === account.id ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Globe className="h-3.5 w-3.5" />
                      )}
                      ブラウザでnoteにログイン
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card-elevated max-w-2xl space-y-4">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              <h2 className="text-sm font-semibold">note 非公式API設定</h2>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">note 非公式API URL</Label>
              <Input value={noteUnofficialApiUrl} onChange={(event) => setNoteUnofficialApiUrl(event.target.value)} placeholder="未設定なら空でOK" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">note 非公式API Token</Label>
              <Input value={noteUnofficialApiToken} onChange={(event) => setNoteUnofficialApiToken(event.target.value)} placeholder="任意" />
            </div>
            <Button className="gap-2 btn-gradient" onClick={handleSaveNote}>
              <Save className="h-4 w-4" />
              note設定を保存
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
            <div className="card-elevated space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">AIプロバイダ一覧</h2>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void refreshProviders()}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  更新
                </Button>
              </div>
              <div className="space-y-2">
                {providerOrder.map((providerId) => {
                  const provider = state.settings.providerSummaries[providerId];
                  return (
                    <button
                      key={providerId}
                      type="button"
                      onClick={() => setSelectedProvider(providerId)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                        selectedProvider === providerId
                          ? "border-primary bg-primary/5"
                          : "border-border/60 bg-background hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{provider.label}</span>
                        <span className={`text-[11px] ${provider.usable ? "text-emerald-600" : provider.configured ? "text-amber-600" : "text-muted-foreground"}`}>
                          {provider.usable ? "利用可能" : provider.configured ? "設定済み" : "未設定"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{provider.model || "モデル未指定"}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="card-elevated space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">{selectedProviderSummary.label}</h2>
                  <p className="text-xs text-muted-foreground">
                    設定: {selectedProviderSummary.configured ? "済み" : "未設定"} / 接続: {selectedProviderSummary.reachable ? "可" : "未確認"} / 利用: {selectedProviderSummary.usable ? "可" : "未準備"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void handleTestProvider()} disabled={testingProvider !== null}>
                    <WandSparkles className="h-3.5 w-3.5" />
                    接続テスト
                  </Button>
                  <Button size="sm" className="gap-1.5 btn-gradient" onClick={() => void handleSaveProvider()} disabled={savingProvider !== null}>
                    <Save className="h-3.5 w-3.5" />
                    設定を保存
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">モデル</Label>
                  <Input value={selectedDraft.model} onChange={(event) => patchDraft(selectedProvider, { model: event.target.value })} />
                </div>
                {supportsBaseUrl ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Base URL</Label>
                    <Input value={selectedDraft.baseUrl} onChange={(event) => patchDraft(selectedProvider, { baseUrl: event.target.value })} placeholder="https://..." />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">認証方式</Label>
                    <Input value={selectedProviderSummary.authMode} disabled />
                  </div>
                )}
              </div>

              {supportsApiKey ? (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">API Key</Label>
                  <div className="relative">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      placeholder="sk-..."
                      value={selectedDraft.apiKey}
                      onChange={(event) => patchDraft(selectedProvider, { apiKey: event.target.value })}
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowApiKey((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground">
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ) : null}

              {selectedProvider === "codex_cli" ? (
                <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">auth.json の場所</Label>
                    <Input value={selectedDraft.authPath} onChange={(event) => patchDraft(selectedProvider, { authPath: event.target.value })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">有効化</span>
                    <Switch checked={selectedDraft.enabled} onCheckedChange={(value) => patchDraft(selectedProvider, { enabled: value })} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void handleRefreshCodex()}>
                      ローカル認証を検出
                    </Button>
                    <span className="text-xs text-muted-foreground">{codexStatusText}</span>
                  </div>
                </div>
              ) : null}

              {selectedProvider === "github_copilot" ? (
                <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">OAuth Client ID</Label>
                    <Input value={selectedDraft.configuredClientId} onChange={(event) => patchDraft(selectedProvider, { configuredClientId: event.target.value })} placeholder="未入力なら built-in を優先" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => void handleStartCopilot()}>Device Flow を開始</Button>
                    <Button variant="outline" size="sm" onClick={() => void handlePollCopilot()}>認証状態を確認</Button>
                    <Button variant="outline" size="sm" onClick={() => void handleCopilotStatus()}>状態取得</Button>
                    <Button variant="outline" size="sm" onClick={() => void handleCopilotDisconnect()}>切断</Button>
                  </div>
                  {copilotFlow ? (
                    <div className="rounded-lg border border-border/60 bg-background p-3 text-sm">
                      <p>コード: <span className="font-semibold">{copilotFlow.userCode}</span></p>
                      <a href={copilotFlow.verificationUri} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {copilotFlow.verificationUri}
                      </a>
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">{copilotStatusText}</p>
                </div>
              ) : null}

              {selectedProvider === "alibaba_model_studio" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Workspace</Label>
                  <Input value={selectedDraft.workspace} onChange={(event) => patchDraft(selectedProvider, { workspace: event.target.value })} placeholder="任意" />
                </div>
              ) : null}

              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                <p>最終テスト: {selectedProviderSummary.lastTestStatus}</p>
                <p>最終エラー: {selectedProviderSummary.lastTestError ?? "なし"}</p>
                <p>Base URL: {selectedProviderSummary.baseUrl ?? "未使用"}</p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </PageWrapper>
  );
}
