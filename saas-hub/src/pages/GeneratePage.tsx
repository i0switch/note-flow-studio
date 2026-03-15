import { PageWrapper } from "@/components/PageWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAppData } from "@/context/AppDataContext";
import { providerLabels, type ProviderId } from "@/lib/app-data";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarClock, CalendarIcon, Globe, Save } from "lucide-react";
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function GeneratePage() {
  const navigate = useNavigate();
  const { state, createGeneratedArticle, publishArticle, saveDraft } = useAppData();
  const [keyword, setKeyword] = useState("");
  const [genre, setGenre] = useState("テクノロジー");
  const [selectedAccount, setSelectedAccount] = useState(state.accounts[0]?.id ?? "");
  const [selectedPrompt, setSelectedPrompt] = useState(state.prompts[0]?.id ?? "");
  const [saleMode, setSaleMode] = useState<"paid" | "free">("paid");
  const [price, setPrice] = useState("500");
  const [instruction, setInstruction] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date>();
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [submittingAction, setSubmittingAction] = useState<"publish" | "draft" | "schedule" | null>(null);
  const [useDefaultProvider, setUseDefaultProvider] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>(state.settings.defaultProvider);

  const selectedAccountName = state.accounts.find((account) => account.id === selectedAccount)?.name ?? "未選択";
  const selectedPromptName = state.prompts.find((prompt) => prompt.id === selectedPrompt)?.title ?? "未選択";
  const scheduledAt =
    showSchedule && scheduleDate ? `${format(scheduleDate, "yyyy-MM-dd")} ${scheduleTime}` : null;

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
      toast.error("キーワードを入れてから実行して");
      return;
    }

    if (action === "schedule" && !scheduledAt) {
      toast.error("予約投稿するなら日時を選んで");
      return;
    }

    setSubmittingAction(action);
    try {
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
      });
      const resolvedArticle = await article;

      navigate(`/articles/${resolvedArticle.id}`);

      if (action === "publish") {
        const result = await publishArticle(resolvedArticle.id);
        toast.success(result?.noteUrl ? "記事を生成して note 公開した" : "記事を生成して公開キューに回した");
        return;
      }

      if (action === "draft") {
        const result = await saveDraft(resolvedArticle.id);
        toast.success(result?.noteUrl ? "記事を生成して note 下書き保存した" : "記事を生成して下書き保存を開始した");
        return;
      }

      toast.success("記事を生成して予約投稿設定に回した");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "note 投稿に失敗した");
    } finally {
      setSubmittingAction(null);
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
                    <SelectItem value="テクノロジー">テクノロジー</SelectItem>
                    <SelectItem value="ビジネス">ビジネス</SelectItem>
                    <SelectItem value="ライフスタイル">ライフスタイル</SelectItem>
                    <SelectItem value="金融">金融</SelectItem>
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
          <div className="card-elevated sticky top-18 space-y-4">
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
        </div>
      </div>
    </PageWrapper>
  );
}
