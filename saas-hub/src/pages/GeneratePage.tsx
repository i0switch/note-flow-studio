import { ArticlePreviewDialog } from "@/components/ArticlePreviewDialog";
import { PageWrapper } from "@/components/PageWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAppData } from "@/context/AppDataContext";
import { providerLabels, type ArticleRecord, type ProviderId } from "@/lib/app-data";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarClock, CalendarIcon, Globe, Paperclip, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const toFriendlyError = (error: unknown): string => {
  const msg = error instanceof Error ? error.message : String(error);
  const map: Record<string, string> = {
    ALL_SAVE_METHODS_FAILED: "note への保存に失敗しました。設定ページで Playwright セッションを取得するか、非公式 API URL を設定してください。",
    NOTE_UNOFFICIAL_API_NOT_CONFIGURED: "note 非公式 API URL が設定されていません。設定ページで入力してください。",
    ACCOUNT_NOT_FOUND: "note アカウントが見つかりません。設定ページでアカウントを追加してください。",
    JOB_NOT_FOUND: "生成ジョブが見つかりません。もう一度生成してください。",
    ARTICLE_NOT_READY: "記事データがまだ準備できていません。しばらく待ってから再試行してください。",
  };
  if (map[msg]) return map[msg];
  if (msg.includes("NOTE_SESSION") || msg.includes("NOTE_LOGIN"))
    return "note への保存に失敗しました。設定ページで Playwright セッションを取得するか、非公式 API URL を設定してください。";
  return msg;
};

export default function GeneratePage() {
  const navigate = useNavigate();
  const { state, createReferenceMaterial, createGeneratedArticle, publishArticle, saveDraft, regenerateAssets, updateArticle } = useAppData();
  const genres = state.settings.genres?.length ? state.settings.genres : ["テクノロジー", "ビジネス", "ライフスタイル", "金融"];
  const [keyword, setKeyword] = useState("");
  const [genre, setGenre] = useState(() => genres[0] ?? "テクノロジー");
  const [selectedAccount, setSelectedAccount] = useState(state.accounts[0]?.id ?? "");
  const [selectedPrompt, setSelectedPrompt] = useState(state.prompts[0]?.id ?? "");
  const [saleMode, setSaleMode] = useState<"paid" | "free">("paid");
  const [price, setPrice] = useState("500");
  const [instruction, setInstruction] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date>();
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [submittingAction, setSubmittingAction] = useState<"publish" | "draft" | "schedule" | null>(null);
  const [generationStep, setGenerationStep] = useState<string>("準備中...");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [hideProgress, setHideProgress] = useState(false);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [useDefaultProvider, setUseDefaultProvider] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>(state.settings.defaultProvider);
  const [urlInput, setUrlInput] = useState("");
  const [referenceUrls, setReferenceUrls] = useState<string[]>([]);
  const [referenceFiles, setReferenceFiles] = useState<{ name: string; content: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // プレビュー機能
  const [showPreviewOnComplete, setShowPreviewOnComplete] = useState(false);
  const [previewArticle, setPreviewArticle] = useState<Partial<ArticleRecord> | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"publish" | "draft" | "schedule" | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // タイマークリーンアップ
  useEffect(() => () => { if (progressTimerRef.current) clearInterval(progressTimerRef.current); }, []);

  // マウント時に preview_pending の記事があればプレビューダイアログを自動で開く
  useEffect(() => {
    const pendingArticle = [...(state.articles ?? [])]
      .filter((a) => a.status === "preview_pending")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    if (pendingArticle) {
      setPreviewArticle(pendingArticle);
      setPendingAction(pendingArticle.pendingNoteAction ?? null);
      setIsPreviewOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedAccountName = state.accounts.find((account) => account.id === selectedAccount)?.name ?? "未選択";
  const selectedPromptName = state.prompts.find((prompt) => prompt.id === selectedPrompt)?.title ?? "未選択";
  const scheduledAt =
    showSchedule && scheduleDate ? `${format(scheduleDate, "yyyy-MM-dd")} ${scheduleTime}` : null;

  const addUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    try { new URL(url); } catch { toast.error("正しいURLを入力してください"); return; }
    if (referenceUrls.includes(url)) { toast.error("同じURLはすでに追加されています"); return; }
    setReferenceUrls((prev) => [...prev, url]);
    setUrlInput("");
  };

  const removeUrl = (url: string) => setReferenceUrls((prev) => prev.filter((u) => u !== url));

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["txt", "md"].includes(ext ?? "")) {
        toast.error(`.txt と .md ファイルのみ対応しています（${file.name}）`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setReferenceFiles((prev) => {
          if (prev.some((f) => f.name === file.name)) return prev;
          return [...prev, { name: file.name, content }];
        });
      };
      reader.readAsText(file);
    }
    event.target.value = "";
  };

  const removeFile = (name: string) => setReferenceFiles((prev) => prev.filter((f) => f.name !== name));

  const toggleSchedule = () => {
    setShowSchedule((current) => {
      const next = !current;
      if (next && !scheduleDate) {
        setScheduleDate(new Date());
      }
      return next;
    });
  };

  const handleGenerate = async (action: "publish" | "draft" | "schedule") => {
    if (!keyword.trim()) {
      toast.error("キーワードを入力してください");
      return;
    }

    if (action === "schedule" && !scheduledAt) {
      toast.error("予約投稿の日時を選択してください");
      return;
    }

    setSubmittingAction(action);
    setGenerationProgress(0);
    setGenerationStep("準備中...");
    setHideProgress(false);
    try {
      // 参考資料を先に登録してIDを取得
      const refIds: number[] = [];
      const hasRefs = referenceUrls.length > 0 || referenceFiles.length > 0;
      if (hasRefs) {
        setGenerationStep("参考資料を取得中...");
        setGenerationProgress(5);
      }
      for (const url of referenceUrls) {
        try {
          const result = await createReferenceMaterial({ type: "url", url });
          refIds.push(result.id);
        } catch {
          toast.error(`URL取得に失敗しましたが続行します: ${url}`);
        }
      }
      for (const file of referenceFiles) {
        try {
          const result = await createReferenceMaterial({ type: "file", filename: file.name, content: file.content });
          refIds.push(result.id);
        } catch {
          toast.error(`ファイル登録に失敗しましたが続行します: ${file.name}`);
        }
      }

      // AI 生成フェーズ: 偽プログレスでじわじわ動かす
      setGenerationStep("AI が記事を執筆中...");
      setGenerationProgress(hasRefs ? 15 : 8);
      let fakeProgress = hasRefs ? 15 : 8;
      progressTimerRef.current = setInterval(() => {
        fakeProgress += Math.random() * 1.5 + 0.5;
        if (fakeProgress < 78) setGenerationProgress(Math.round(fakeProgress));
      }, 600);

      const article = createGeneratedArticle({
        keyword: keyword.trim(),
        genre,
        accountId: selectedAccount,
        promptId: selectedPrompt,
        saleMode,
        price: saleMode === "paid" ? Number(price || 0) : null,
        instruction,
        scheduledAt,
        action,
        providerId: useDefaultProvider ? undefined : selectedProvider,
        referenceMaterialIds: refIds,
      });
      const resolvedArticle = await article;

      // 生成完了
      if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
      setGenerationProgress(82);
      setGenerationStep("note に保存中...");

      // プレビューONなら確認待ちへ（note 保存はプレビュー完了ボタン後）
      if (showPreviewOnComplete) {
        if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
        setGenerationProgress(100);
        setHideProgress(true);
        updateArticle(resolvedArticle.id, { status: "preview_pending", pendingNoteAction: action });
        setPreviewArticle({ ...resolvedArticle, status: "preview_pending", pendingNoteAction: action });
        setPendingAction(action);
        setIsPreviewOpen(true);
        return;
      }

      if (action === "publish") {
        const result = await publishArticle(resolvedArticle.id);
        setGenerationProgress(100);
        setGenerationStep("完了！");
        navigate(`/articles/${resolvedArticle.id}`);
        if (result?.noteUrl) {
          window.open(result.noteUrl, "_blank", "noopener,noreferrer");
          toast.success("note 公開が完了しました");
        } else {
          toast.success("記事を生成して公開処理を開始しました");
        }
        return;
      }

      if (action === "draft") {
        const result = await saveDraft(resolvedArticle.id);
        setGenerationProgress(100);
        setGenerationStep("完了！");
        navigate(`/articles/${resolvedArticle.id}`);
        if (result?.noteUrl) {
          window.open(result.noteUrl, "_blank", "noopener,noreferrer");
          toast.success("下書き保存が完了しました");
        } else {
          toast.success("記事を生成して下書き保存を開始しました");
        }
        return;
      }

      setGenerationProgress(100);
      setGenerationStep("完了！");
      navigate(`/articles/${resolvedArticle.id}`);
      toast.success("記事を生成して予約投稿を設定しました");
    } catch (error) {
      if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
      setGenerationProgress(0);
      toast.error(toFriendlyError(error));
    } finally {
      setSubmittingAction(null);
    }
  };

  // プレビュー完了 → note 保存フェーズへ進む
  const handlePreviewConfirm = async () => {
    if (!previewArticle?.id || !pendingAction) return;
    setIsPreviewOpen(false);
    setSubmittingAction(pendingAction);
    setGenerationProgress(82);
    setGenerationStep("note に保存中...");
    const targetId = previewArticle.id;
    try {
      if (pendingAction === "publish") {
        const result = await publishArticle(targetId);
        setGenerationProgress(100);
        setGenerationStep("完了！");
        updateArticle(targetId, { pendingNoteAction: null, status: "completed" });
        navigate(`/articles/${targetId}`);
        if (result?.noteUrl) {
          window.open(result.noteUrl, "_blank", "noopener,noreferrer");
          toast.success("note 公開が完了しました");
        } else {
          toast.success("記事を生成して公開処理を開始しました");
        }
      } else if (pendingAction === "draft") {
        const result = await saveDraft(targetId);
        setGenerationProgress(100);
        setGenerationStep("完了！");
        updateArticle(targetId, { pendingNoteAction: null, status: "completed" });
        navigate(`/articles/${targetId}`);
        if (result?.noteUrl) {
          window.open(result.noteUrl, "_blank", "noopener,noreferrer");
          toast.success("下書き保存が完了しました");
        } else {
          toast.success("記事を生成して下書き保存を開始しました");
        }
      } else {
        setGenerationProgress(100);
        setGenerationStep("完了！");
        updateArticle(targetId, { pendingNoteAction: null, status: "completed" });
        navigate(`/articles/${targetId}`);
        toast.success("記事を生成して予約投稿を設定しました");
      }
    } catch (error) {
      setGenerationProgress(0);
      toast.error(toFriendlyError(error));
    } finally {
      setSubmittingAction(null);
      setPreviewArticle(null);
      setPendingAction(null);
    }
  };

  // AIに再生成させる
  const handlePreviewRegenerate = async (additionalPrompt: string) => {
    if (!previewArticle?.id) return;
    setIsRegenerating(true);
    try {
      if (additionalPrompt.trim()) {
        const current = previewArticle.instruction ?? "";
        updateArticle(previewArticle.id, {
          instruction: current ? `${current}\n\n追加指示: ${additionalPrompt}` : additionalPrompt,
        });
      }
      const updated = await regenerateAssets(previewArticle.id, useDefaultProvider ? undefined : selectedProvider);
      if (updated) setPreviewArticle(updated);
    } catch (error) {
      toast.error(toFriendlyError(error));
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <PageWrapper title="生成" description="新規記事を作成します。">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="card-elevated space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="inline-block h-4 w-1 rounded-full bg-primary" />
              基本条件
            </h2>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">キーワード</Label>
              <Input placeholder="例: AI副業の始め方" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">ジャンル</Label>
                <Select value={genre} onValueChange={setGenre}>
                  <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                  <SelectContent>
                    {genres.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">使用アカウント</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                  <SelectContent>
                    {state.accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="card-elevated space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="inline-block h-4 w-1 rounded-full bg-primary" />
              生成オプション
            </h2>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">プロンプト</Label>
              <Select value={selectedPrompt} onValueChange={setSelectedPrompt}>
                <SelectTrigger><SelectValue placeholder="テンプレート選択" /></SelectTrigger>
                <SelectContent>
                  {state.prompts.map((prompt) => (
                    <SelectItem key={prompt.id} value={prompt.id}>{prompt.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">想定価格</Label>
                <Input type="number" placeholder="500" value={price} onChange={(event) => setPrice(event.target.value)} disabled={saleMode === "free"} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">販売モード</Label>
                <Select value={saleMode} onValueChange={(value) => setSaleMode(value as "paid" | "free")}>
                  <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">有料</SelectItem>
                    <SelectItem value="free">無料</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">AI provider</Label>
                <Select value={selectedProvider} onValueChange={(value) => setSelectedProvider(value as ProviderId)} disabled={useDefaultProvider}>
                  <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(state.settings.providerSummaries).map(([providerId, provider]) => (
                      <SelectItem key={providerId} value={providerId}>
                        {provider.label} {provider.usable ? "" : "(未準備)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end justify-between rounded-xl border border-border/60 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">既定 provider を使う</p>
                  <p className="text-xs text-muted-foreground">{providerLabels[state.settings.defaultProvider]}</p>
                </div>
                <Switch checked={useDefaultProvider} onCheckedChange={setUseDefaultProvider} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">補足指示</Label>
              <Textarea placeholder="追加の指示があれば入力..." rows={3} value={instruction} onChange={(event) => setInstruction(event.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium">生成完了後プレビューを表示する</p>
                <p className="text-xs text-muted-foreground">公開処理の前に内容を確認・修正できる</p>
              </div>
              <Switch
                data-testid="preview-toggle"
                checked={showPreviewOnComplete}
                onCheckedChange={setShowPreviewOnComplete}
              />
            </div>
          </div>

          <div className="card-elevated space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="inline-block h-4 w-1 rounded-full bg-primary" />
              参考資料（任意）
            </h2>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">URLを追加</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://example.com/article"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }}
                />
                <Button type="button" variant="outline" size="icon" onClick={addUrl}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {referenceUrls.length > 0 && (
                <ul className="space-y-1">
                  {referenceUrls.map((url) => (
                    <li key={url} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-1.5 text-xs">
                      <span className="truncate text-muted-foreground max-w-[90%]">{url}</span>
                      <button type="button" onClick={() => removeUrl(url)} className="ml-2 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">ファイルを追加（.txt / .md）</Label>
              <input ref={fileInputRef} type="file" accept=".txt,.md" multiple className="hidden" onChange={handleFileSelect} />
              <Button type="button" variant="outline" className="gap-2 w-full" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="h-4 w-4" />
                ファイルを選択
              </Button>
              {referenceFiles.length > 0 && (
                <ul className="space-y-1">
                  {referenceFiles.map((file) => (
                    <li key={file.name} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-1.5 text-xs">
                      <span className="text-muted-foreground">{file.name}</span>
                      <button type="button" onClick={() => removeFile(file.name)} className="ml-2 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {showSchedule && (
            <div className="card-elevated space-y-4 border-primary/30">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CalendarClock className="h-4 w-4 text-primary" />
                予約投稿の日時設定
              </h2>
              <p className="text-xs text-muted-foreground">
                アプリを起動している間は、この日時にあわせて自動で note 公開まで進む。
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">投稿日</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !scheduleDate && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduleDate ? format(scheduleDate, "yyyy/MM/dd") : "日付を選択"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={scheduleDate} onSelect={setScheduleDate} initialFocus className={cn("pointer-events-auto p-3")} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">投稿時刻</Label>
                  <Input type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} />
                </div>
              </div>
              <Button className="w-full gap-2 btn-gradient" onClick={() => void handleGenerate("schedule")} disabled={submittingAction !== null}>
                <CalendarClock className="h-4 w-4" />
                予約投稿で作成
              </Button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Button className="gap-2 btn-gradient" size="lg" onClick={() => void handleGenerate("publish")} disabled={submittingAction !== null}>
              <Globe className="h-4 w-4" />
              生成後即公開
            </Button>
            <Button variant="outline" className="gap-2 shadow-sm transition-shadow hover:shadow-md" size="lg" onClick={() => void handleGenerate("draft")} disabled={submittingAction !== null}>
              <Save className="h-4 w-4" />
              生成後下書き
            </Button>
            <Button
              variant={showSchedule ? "default" : "outline"}
              className={cn("gap-2 transition-shadow", showSchedule ? "btn-gradient" : "shadow-sm hover:shadow-md")}
              size="lg"
              onClick={toggleSchedule}
              disabled={submittingAction !== null}
            >
              <CalendarClock className="h-4 w-4" />
              生成後予約投稿
            </Button>
          </div>

        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-18 space-y-4">
          <div className="card-elevated space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="inline-block h-4 w-1 rounded-full bg-primary" />
              生成条件サマリー
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">アカウント</span>
                <span className="font-medium">{selectedAccountName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">プロンプト</span>
                <span className="font-medium">{selectedPromptName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">販売モード</span>
                <span className="font-medium">{saleMode === "paid" ? "有料" : "無料"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">AI provider</span>
                <span className="font-medium">
                  {useDefaultProvider ? providerLabels[state.settings.defaultProvider] : providerLabels[selectedProvider]}
                </span>
              </div>
              {showSchedule && scheduledAt && (
                <div className="border-t border-border/60 pt-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">予約日時</span>
                    <span className="font-medium text-primary">{scheduledAt}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {submittingAction !== null && !hideProgress && (
            <div className="card-elevated space-y-3 border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{generationStep}</span>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums text-muted-foreground">{generationProgress}%</span>
                  <button
                    type="button"
                    onClick={() => setHideProgress(true)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    バックグラウンドで待機
                  </button>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-700 ease-out"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {generationProgress < 80
                  ? "AI が記事を生成しています。2〜3 分ほどかかる場合があります..."
                  : generationProgress < 100
                  ? "note に保存中..."
                  : "完了しました。画面が切り替わります。"}
              </p>
            </div>
          )}
          </div>
        </div>
      </div>
      {previewArticle && pendingAction && (
        <ArticlePreviewDialog
          open={isPreviewOpen}
          article={previewArticle}
          action={pendingAction}
          isRegenerating={isRegenerating}
          onConfirm={() => void handlePreviewConfirm()}
          onRegenerate={handlePreviewRegenerate}
          onEdit={(patch) => {
            if (previewArticle?.id) updateArticle(previewArticle.id, patch);
            setPreviewArticle((prev) => prev ? { ...prev, ...patch } : prev);
          }}
          onClose={() => {
            setIsPreviewOpen(false);
          }}
        />
      )}
    </PageWrapper>
  );
}
