import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  buildDiagnostics,
  createGeneratedArticle,
  createId,
  defaultState,
  providerLabels,
  type AccountRecord,
  type AppDataState,
  type AppSettings,
  type ArticleRecord,
  type DiagnosticsRecord,
  type NoteMethod,
  type PromptRecord,
  type ProviderId,
  type ProviderSummary,
  type SaleMode,
  type SaleSettingStatus,
} from "@/lib/app-data";
import {
  captureNoteSession as captureNoteSessionApi,
  createReferenceMaterial as createReferenceMaterialApi,
  deleteArticle as deleteArticleApi,
  fetchAiProviders,
  fetchRemoteState,
  generateArticle as generateArticleApi,
  installPlaywrightChromium,
  persistRemoteState,
  publishToNote as publishToNoteApi,
  regenerateArticleAssets as regenerateArticleAssetsApi,
  runRemoteDiagnostics,
  saveAiProvider,
  saveDraftToNote as saveDraftToNoteApi,
  testAiProvider,
} from "@/lib/note-api";

type ManualArticleInput = {
  id?: string;
  title: string;
  keyword: string;
  genre: string;
  accountId: string;
  freeContent: string;
  paidGuidance: string;
  paidContent: string;
  saleMode: SaleMode;
  price: number | null;
  scheduledAt?: string | null;
  action: "publish" | "draft" | "schedule";
};

type GeneratedArticleInput = {
  keyword: string;
  genre: string;
  accountId: string;
  promptId?: string;
  saleMode: SaleMode;
  price: number | null;
  instruction?: string;
  scheduledAt?: string | null;
  action: "publish" | "draft" | "schedule";
  providerId?: ProviderId;
  referenceMaterialIds?: number[];
};

type ProviderConfigPatch = {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  authPath?: string;
  enabled?: boolean;
  configuredClientId?: string | null;
  workspace?: string | null;
};

type GenerateArticleApiResponse = Awaited<ReturnType<typeof generateArticleApi>>;

type AppDataContextValue = {
  state: AppDataState;
  diagnostics: DiagnosticsRecord[];
  isHydrating: boolean;
  createReferenceMaterial: typeof createReferenceMaterialApi;
  createGeneratedArticle: (input: GeneratedArticleInput) => Promise<ArticleRecord>;
  saveManualArticle: (input: ManualArticleInput) => ArticleRecord;
  updateArticle: (id: string, patch: Partial<ArticleRecord>) => ArticleRecord | undefined;
  deleteArticle: (id: string) => Promise<void>;
  deleteArticles: (ids: string[]) => Promise<void>;
  saveDraft: (id: string) => Promise<ArticleRecord | undefined>;
  publishArticle: (id: string) => Promise<ArticleRecord | undefined>;
  regenerateAssets: (id: string, providerId?: ProviderId) => Promise<ArticleRecord | undefined>;
  addPrompt: (input: Omit<PromptRecord, "id">) => PromptRecord;
  updatePrompt: (id: string, patch: Omit<PromptRecord, "id">) => PromptRecord | undefined;
  deletePrompt: (id: string) => void;
  addAccount: (name: string) => AccountRecord;
  deleteAccount: (id: string) => void;
  saveSettings: (patch: Partial<AppSettings>) => void;
  rerunDiagnostics: () => Promise<void>;
  installChromium: () => Promise<void>;
  captureAccountSession: (accountId?: string) => Promise<{ success: boolean; message: string }>;
  refreshProviders: () => Promise<Record<ProviderId, ProviderSummary>>;
  saveProviderConfig: (providerId: ProviderId, patch: ProviderConfigPatch) => Promise<ProviderSummary>;
  testProviderConnection: (providerId: ProviderId) => Promise<ProviderSummary>;
};

const STORAGE_KEY = "note-flow-studio-state";
const AppDataContext = createContext<AppDataContextValue | null>(null);

const mergeProviderSummaries = (
  current: AppSettings["providerSummaries"],
  incoming?: Partial<Record<ProviderId, ProviderSummary>>,
) => ({
  ...current,
  ...(incoming ?? {}),
});

const normalizeState = (input?: Partial<AppDataState> | null): AppDataState => {
  if (!input) {
    return {
      ...defaultState,
      diagnostics: buildDiagnostics(defaultState.settings, defaultState.accounts),
    };
  }

  const parsed = { ...defaultState, ...input } as AppDataState;
  const settings = {
    ...defaultState.settings,
    ...parsed.settings,
    providerSummaries: mergeProviderSummaries(
      defaultState.settings.providerSummaries,
      parsed.settings?.providerSummaries,
    ),
  };

  return {
    ...parsed,
    settings,
    diagnostics:
      parsed.diagnostics?.length > 0
        ? parsed.diagnostics
        : buildDiagnostics(settings, parsed.accounts ?? defaultState.accounts),
  };
};

const loadState = (): AppDataState => {
  if (typeof window === "undefined") return normalizeState();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return normalizeState();
  }

  try {
    return normalizeState(JSON.parse(raw) as Partial<AppDataState>);
  } catch {
    return normalizeState();
  }
};

const createBaseArticle = (input: ManualArticleInput): ArticleRecord => {
  const articleId = input.id ?? createId();
  const body = [input.freeContent, input.paidGuidance, input.paidContent].filter(Boolean).join("\n\n");
  const scheduledAt = input.action === "schedule" ? input.scheduledAt ?? null : null;
  const noteStatus =
    input.action === "schedule"
      ? "pending"
      : input.action === "publish" || input.action === "draft"
        ? "running"
        : "pending";

  const timeline: ArticleRecord["timeline"] = [
    {
      label: input.id ? "手動記事を更新" : "手動記事を作成",
      time: new Date().toLocaleTimeString("ja-JP"),
      status: "success",
    },
  ];

  if (input.action === "draft") {
    timeline.push({
      label: "note 下書き保存を開始",
      time: new Date().toLocaleTimeString("ja-JP"),
      status: "info",
    });
  }

  if (input.action === "publish") {
    timeline.push({
      label: "note 公開を開始",
      time: new Date().toLocaleTimeString("ja-JP"),
      status: "info",
    });
  }

  if (input.action === "schedule") {
    timeline.push({
      label: "予約投稿を設定",
      time: new Date().toLocaleTimeString("ja-JP"),
      status: input.scheduledAt ? "success" : "error",
      detail: input.scheduledAt ?? "予約日時未設定",
    });
  }

  return {
    id: articleId,
    title: input.title,
    keyword: input.keyword,
    genre: input.genre,
    status: "completed",
    noteStatus,
    createdAt: new Date().toISOString().slice(0, 10),
    scheduledAt,
    noteUrl: null,
    freeContent: input.freeContent,
    paidGuidance: input.paidGuidance,
    paidContent: input.paidContent,
    body,
    references: [],
    timeline,
    saleMode: input.saleMode,
    price: input.price,
    accountId: input.accountId,
    lastNoteMethod: null,
    saleSettingStatus: null,
    lastError: null,
    providerId: undefined,
  };
};

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppDataState>(loadState);
  const [isHydrating, setIsHydrating] = useState(true);
  const stateRef = useRef(state);
  const remoteReadyRef = useRef(false);

  const updateState = (nextState: AppDataState) => {
    stateRef.current = nextState;
    setState(nextState);
  };

  const refreshProviders = async () => {
    const response = await fetchAiProviders();
    const nextState = {
      ...stateRef.current,
      settings: {
        ...stateRef.current.settings,
        providerSummaries: mergeProviderSummaries(
          stateRef.current.settings.providerSummaries,
          response.providers,
        ),
      },
    };
    updateState(nextState);
    return nextState.settings.providerSummaries;
  };

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        const response = await fetchRemoteState();
        if (cancelled) return;

        if (response.state) {
          const normalized = normalizeState(response.state);
          normalized.settings.providerSummaries = mergeProviderSummaries(
            normalized.settings.providerSummaries,
            response.providers,
          );
          updateState(normalized);
        } else {
          const providers = response.providers;
          const nextState = normalizeState();
          nextState.settings.providerSummaries = mergeProviderSummaries(
            nextState.settings.providerSummaries,
            providers,
          );
          updateState(nextState);
        }
      } catch {
        // 初回起動や API 未接続時はローカル保存分をそのまま使う
      } finally {
        remoteReadyRef.current = true;
        if (!cancelled) {
          setIsHydrating(false);
        }
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;

      void fetchRemoteState()
        .then((response) => {
          if (!response.state) return;

          const normalized = normalizeState(response.state);
          normalized.settings.providerSummaries = mergeProviderSummaries(
            normalized.settings.providerSummaries,
            response.providers,
          );
          if (JSON.stringify(normalized) === JSON.stringify(stateRef.current)) {
            return;
          }

          updateState(normalized);
        })
        .catch(() => {
          // ローカル優先のため同期失敗では止めない
        });
    }, 10_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    stateRef.current = state;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (!remoteReadyRef.current) return;
    void persistRemoteState(state)
      .then((response) => {
        if (!response.providers) return;
        const merged = mergeProviderSummaries(stateRef.current.settings.providerSummaries, response.providers);
        if (JSON.stringify(merged) === JSON.stringify(stateRef.current.settings.providerSummaries)) return;
        updateState({
          ...stateRef.current,
          settings: {
            ...stateRef.current.settings,
            providerSummaries: merged,
          },
        });
      })
      .catch(() => {
        // ローカル利用優先なので同期失敗では止めない
      });
  }, [state]);

  const diagnostics = useMemo(
    () =>
      state.diagnostics.length > 0
        ? state.diagnostics
        : buildDiagnostics(state.settings, state.accounts),
    [state.accounts, state.diagnostics, state.settings],
  );

  const updateArticle = (id: string, patch: Partial<ArticleRecord>) => {
    let updated: ArticleRecord | undefined;
    const nextState = {
      ...stateRef.current,
      articles: stateRef.current.articles.map((article) => {
        if (article.id !== id) return article;
        updated = { ...article, ...patch };
        return updated;
      }),
    };
    updateState(nextState);
    return updated;
  };

  const replaceArticle = (article: ArticleRecord) => {
    const nextState = {
      ...stateRef.current,
      articles: stateRef.current.articles.map((item) => (item.id === article.id ? article : item)),
    };
    updateState(nextState);
    return article;
  };

  const stampNoteResult = (
    article: ArticleRecord,
    targetState: "draft" | "published",
    payload: {
      noteUrl: string;
      method: NoteMethod;
      saleSettingStatus: SaleSettingStatus;
    },
  ) => {
    const label = targetState === "published" ? "note 公開" : "note 下書き保存";
    return replaceArticle({
      ...article,
      noteStatus: targetState === "published" ? "published" : "saved",
      noteUrl: payload.noteUrl,
      lastNoteMethod: payload.method,
      saleSettingStatus: payload.saleSettingStatus,
      lastError: null,
      timeline: [
        ...article.timeline,
        {
          label,
          time: new Date().toLocaleTimeString("ja-JP"),
          status: "success",
          detail: `${payload.method} / sale=${payload.saleSettingStatus}`,
        },
      ],
    });
  };

  const stampNoteError = (article: ArticleRecord, targetState: "draft" | "published", message: string) =>
    replaceArticle({
      ...article,
      noteStatus: "error",
      lastError: message,
      timeline: [
        ...article.timeline,
        {
          label: targetState === "published" ? "note 公開失敗" : "note 下書き保存失敗",
          time: new Date().toLocaleTimeString("ja-JP"),
          status: "error",
          detail: message,
        },
      ],
    });

  const submitNoteAction = async (id: string, targetState: "draft" | "published") => {
    const target = stateRef.current.articles.find((article) => article.id === id);
    if (!target) return undefined;

    const pending = replaceArticle({
      ...target,
      noteStatus: "running",
      lastError: null,
      timeline: [
        ...target.timeline,
        {
          label: targetState === "published" ? "note 公開を開始" : "note 下書き保存を開始",
          time: new Date().toLocaleTimeString("ja-JP"),
          status: "info",
        },
      ],
    });

    try {
      const result =
        targetState === "published"
          ? await publishToNoteApi(pending, stateRef.current.settings)
          : await saveDraftToNoteApi(pending, stateRef.current.settings);

      return stampNoteResult(pending, targetState, {
        noteUrl: result.draftUrl,
        method: result.method,
        saleSettingStatus: result.saleSettingStatus,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "note 投稿に失敗";
      stampNoteError(pending, targetState, message);
      throw error;
    }
  };

  const createGenerated = async (input: GeneratedArticleInput) => {
    const selectedProvider = input.providerId ?? stateRef.current.settings.defaultProvider;
    const fallbackArticle = createGeneratedArticle({
      keyword: input.keyword,
      genre: input.genre,
      accountId: input.accountId,
      promptId: input.promptId,
      saleMode: input.saleMode,
      price: input.price,
      instruction: input.instruction,
      providerId: selectedProvider,
      scheduleAt: input.scheduledAt,
      noteAction: input.action,
    });
    const selectedPrompt = stateRef.current.prompts.find((prompt) => prompt.id === input.promptId);
    const generated: GenerateArticleApiResponse = await generateArticleApi(
      {
        ...input,
        providerId: input.providerId,
        promptTitle: selectedPrompt?.title,
        promptContent: selectedPrompt?.content,
      },
      stateRef.current.settings,
    ).catch(() => ({
      article: {
        ...fallbackArticle,
        generationMode: "fallback" as const,
      },
    }));
    const generationMode = generated.article.generationMode ?? "fallback";
    const article = {
      ...fallbackArticle,
      ...generated.article,
      id: generated.article?.id != null ? String(generated.article.id) : fallbackArticle.id,
      keyword: input.keyword,
      genre: input.genre,
      accountId: input.accountId,
      promptId: input.promptId,
      instruction: input.instruction,
      saleMode: input.saleMode,
      price: input.price,
      scheduledAt: input.action === "schedule" ? input.scheduledAt ?? null : null,
      noteStatus: fallbackArticle.noteStatus,
      status: "completed" as const,
      createdAt: fallbackArticle.createdAt,
      noteUrl: null,
      lastNoteMethod: null,
      saleSettingStatus: null,
      lastError: null,
      providerId:
        generationMode === "fallback"
          ? selectedProvider
          : (generationMode as ProviderId),
      timeline: [
        {
          label:
            generationMode === "fallback"
              ? "標準テンプレート生成完了"
              : `${providerLabels[generationMode as ProviderId]} 生成完了`,
          time: new Date().toLocaleTimeString("ja-JP"),
          status: "success" as const,
        },
        ...fallbackArticle.timeline.filter((item) => item.label !== "本文生成完了"),
      ],
    };
    const nextState = {
      ...stateRef.current,
      articles: [article, ...stateRef.current.articles],
    };
    updateState(nextState);
    return article;
  };

  const saveManualArticle = (input: ManualArticleInput) => {
    const baseArticle = createBaseArticle(input);

    const exists = stateRef.current.articles.some((article) => article.id === baseArticle.id);
    const nextState = {
      ...stateRef.current,
      articles: exists
        ? stateRef.current.articles.map((article) =>
            article.id === baseArticle.id ? { ...article, ...baseArticle } : article,
          )
        : [baseArticle, ...stateRef.current.articles],
    };
    updateState(nextState);

    return baseArticle;
  };

  const saveDraft = async (id: string) => submitNoteAction(id, "draft");

  const publishArticle = async (id: string) => submitNoteAction(id, "published");

  const regenerateAssets = async (id: string, providerId?: ProviderId) => {
    const target = stateRef.current.articles.find((article) => article.id === id);
    if (!target) return undefined;
    const selectedProvider = providerId ?? target.providerId ?? stateRef.current.settings.defaultProvider;
    const generated = await regenerateArticleAssetsApi(
      target,
      stateRef.current.settings,
      providerId,
    ).catch(() => null);
    const updated = {
      ...target,
      providerId: selectedProvider,
      timeline: [
        ...target.timeline,
        {
          label: "素材を再生成",
          time: new Date().toLocaleTimeString("ja-JP"),
          status: "success" as const,
          detail:
            generated?.article
              ? `${providerLabels[selectedProvider]} で素材案を更新`
              : "既存データをもとに表示内容を更新",
        },
      ],
    };
    replaceArticle(updated);
    return updated;
  };

  const addPrompt = (input: Omit<PromptRecord, "id">) => {
    const prompt = { id: createId(), ...input };
    const nextState = {
      ...stateRef.current,
      prompts: [prompt, ...stateRef.current.prompts],
    };
    updateState(nextState);
    return prompt;
  };

  const updatePrompt = (id: string, patch: Omit<PromptRecord, "id">) => {
    let updated: PromptRecord | undefined;
    const nextState = {
      ...stateRef.current,
      prompts: stateRef.current.prompts.map((prompt) => {
        if (prompt.id !== id) return prompt;
        updated = { id, ...patch };
        return updated;
      }),
    };
    updateState(nextState);
    return updated;
  };

  const deletePrompt = (id: string) => {
    updateState({
      ...stateRef.current,
      prompts: stateRef.current.prompts.filter((prompt) => prompt.id !== id),
    });
  };

  const addAccount = (name: string) => {
    const account = { id: createId(), name, priority: stateRef.current.accounts.length + 1 };
    const accounts = [...stateRef.current.accounts, account];
    const nextState = {
      ...stateRef.current,
      accounts,
      diagnostics: buildDiagnostics(stateRef.current.settings, accounts),
    };
    updateState(nextState);
    return account;
  };

  const deleteAccount = (id: string) => {
    const accounts = stateRef.current.accounts
      .filter((account) => account.id !== id)
      .map((account, index) => ({
        ...account,
        priority: index + 1,
      }));
    const nextState = {
      ...stateRef.current,
      accounts,
      diagnostics: buildDiagnostics(stateRef.current.settings, accounts),
    };
    updateState(nextState);
  };

  const saveSettings = (patch: Partial<AppSettings>) => {
    const settings = {
      ...stateRef.current.settings,
      ...patch,
      providerSummaries: mergeProviderSummaries(
        stateRef.current.settings.providerSummaries,
        patch.providerSummaries,
      ),
    };
    const nextState = {
      ...stateRef.current,
      settings,
      diagnostics: buildDiagnostics(settings, stateRef.current.accounts),
    };
    updateState(nextState);
  };

  const rerunDiagnostics = async () => {
    const remote = await runRemoteDiagnostics(stateRef.current.settings);
    const nextState = {
      ...stateRef.current,
      diagnostics: remote.diagnostics,
      lastDiagnosticsRunAt: new Date().toISOString(),
      settings: {
        ...stateRef.current.settings,
        chromiumInstalled: remote.diagnostics.some(
          (item) => item.name === "Playwright" && item.status === "completed",
        ),
        providerSummaries: mergeProviderSummaries(
          stateRef.current.settings.providerSummaries,
          remote.providers,
        ),
      },
    };
    updateState(nextState);
  };

  const installChromium = async () => {
    await installPlaywrightChromium();
    await rerunDiagnostics();
  };

  const deleteArticle = async (id: string) => {
    await deleteArticleApi(id);
    updateState({
      ...stateRef.current,
      articles: stateRef.current.articles.filter((article) => article.id !== id),
    });
  };

  const deleteArticles = async (ids: string[]) => {
    for (const id of ids) {
      await deleteArticleApi(id);
    }
    const idSet = new Set(ids);
    updateState({
      ...stateRef.current,
      articles: stateRef.current.articles.filter((article) => !idSet.has(article.id)),
    });
  };

  const captureAccountSession = async (accountId?: string) => {
    return captureNoteSessionApi(accountId);
  };

  const saveProviderConfig = async (providerId: ProviderId, patch: ProviderConfigPatch) => {
    const response = await saveAiProvider(providerId, patch);
    const nextState = {
      ...stateRef.current,
      settings: {
        ...stateRef.current.settings,
        providerSummaries: {
          ...stateRef.current.settings.providerSummaries,
          [providerId]: response.provider,
        },
      },
    };
    updateState(nextState);
    return response.provider;
  };

  const testProviderConnection = async (providerId: ProviderId) => {
    const response = await testAiProvider(providerId);
    const nextState = {
      ...stateRef.current,
      settings: {
        ...stateRef.current.settings,
        providerSummaries: {
          ...stateRef.current.settings.providerSummaries,
          [providerId]: response.provider,
        },
      },
    };
    updateState(nextState);
    return response.provider;
  };

  const value: AppDataContextValue = {
    state,
    diagnostics,
    isHydrating,
    createReferenceMaterial: createReferenceMaterialApi,
    createGeneratedArticle: createGenerated,
    saveManualArticle,
    updateArticle,
    deleteArticle,
    deleteArticles,
    saveDraft,
    publishArticle,
    regenerateAssets,
    addPrompt,
    updatePrompt,
    deletePrompt,
    addAccount,
    deleteAccount,
    saveSettings,
    rerunDiagnostics,
    installChromium,
    captureAccountSession,
    refreshProviders,
    saveProviderConfig,
    testProviderConnection,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export const useAppData = () => {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return context;
};
