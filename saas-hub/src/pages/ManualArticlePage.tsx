import { PageWrapper } from "@/components/PageWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAppData } from "@/context/AppDataContext";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ArrowLeft, CalendarClock, CalendarIcon, Globe, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";

export default function ManualArticlePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const { state, publishArticle, saveDraft, saveManualArticle } = useAppData();
  const editingArticle = state.articles.find((article) => article.id === editId);
  const [title, setTitle] = useState("");
  const [keyword, setKeyword] = useState("");
  const [genre, setGenre] = useState("テクノロジー");
  const [accountId, setAccountId] = useState(state.accounts[0]?.id ?? "");
  const [freeContent, setFreeContent] = useState("");
  const [paidGuidance, setPaidGuidance] = useState("");
  const [paidContent, setPaidContent] = useState("");
  const [saleMode, setSaleMode] = useState<"paid" | "free">("paid");
  const [price, setPrice] = useState("500");
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date>();
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [submittingAction, setSubmittingAction] = useState<"publish" | "draft" | "schedule" | null>(null);

  useEffect(() => {
    if (!editingArticle) return;
    setTitle(editingArticle.title);
    setKeyword(editingArticle.keyword);
    setGenre(editingArticle.genre);
    setAccountId(editingArticle.accountId);
    setFreeContent(editingArticle.freeContent);
    setPaidGuidance(editingArticle.paidGuidance);
    setPaidContent(editingArticle.paidContent);
    setSaleMode(editingArticle.saleMode);
    setPrice(String(editingArticle.price ?? 500));
    if (editingArticle.scheduledAt) {
      const [datePart, timePart] = editingArticle.scheduledAt.split(" ");
      setScheduleDate(new Date(datePart));
      setScheduleTime(timePart ?? "09:00");
      setShowSchedule(true);
    }
  }, [editingArticle]);

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

  const handleSave = async (action: "publish" | "draft" | "schedule") => {
    if (!title.trim() || !keyword.trim()) {
      toast.error("タイトルとキーワードは入れて");
      return;
    }

    if (action === "schedule" && !scheduledAt) {
      toast.error("予約投稿するなら日時を選んで");
      return;
    }

    setSubmittingAction(action);
    try {
      const article = saveManualArticle({
        id: editingArticle?.id,
        title: title.trim(),
        keyword: keyword.trim(),
        genre,
        accountId,
        freeContent,
        paidGuidance,
        paidContent,
        saleMode,
        price: saleMode === "paid" ? Number(price || 0) : null,
        scheduledAt,
        action
      });

      navigate(`/articles/${article.id}`);

      if (action === "publish") {
        await publishArticle(article.id);
        toast.success("手動記事を note 公開した");
        return;
      }

      if (action === "draft") {
        await saveDraft(article.id);
        toast.success("手動記事を note 下書き保存した");
        return;
      }

      toast.success("手動記事を予約投稿設定で保存した");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "note 投稿に失敗した");
    } finally {
      setSubmittingAction(null);
    }
  };

  return (
    <PageWrapper title={editingArticle ? "記事を編集" : "記事を手動追加"} description="記事の内容を直接入力して登録します。">
      <Link to="/articles" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        記事管理に戻る
      </Link>

      <div className="max-w-3xl space-y-5">
        <div className="card-elevated space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="inline-block h-4 w-1 rounded-full bg-primary" />
            基本情報
          </h2>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">タイトル</Label>
            <Input placeholder="記事タイトルを入力" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">キーワード</Label>
              <Input placeholder="例: AI副業" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            </div>
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
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">使用アカウント</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
              <SelectContent>
                {state.accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="card-elevated space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="inline-block h-4 w-1 rounded-full bg-primary" />
            本文
          </h2>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">無料部分</Label>
            <Textarea placeholder="無料で公開する部分を入力..." rows={6} value={freeContent} onChange={(event) => setFreeContent(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">有料導線</Label>
            <Textarea placeholder="有料部分への導線テキスト..." rows={2} value={paidGuidance} onChange={(event) => setPaidGuidance(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">有料部分</Label>
            <Textarea placeholder="有料コンテンツを入力..." rows={8} value={paidContent} onChange={(event) => setPaidContent(event.target.value)} />
          </div>
        </div>

        <div className="card-elevated space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="inline-block h-4 w-1 rounded-full bg-primary" />
            販売設定
          </h2>
          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">価格</Label>
              <Input type="number" placeholder="500" value={price} onChange={(event) => setPrice(event.target.value)} disabled={saleMode === "free"} />
            </div>
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
            <Button className="w-full gap-2 btn-gradient" onClick={() => void handleSave("schedule")} disabled={submittingAction !== null}>
              <CalendarClock className="h-4 w-4" />
              予約投稿で保存
            </Button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Button className="gap-2 btn-gradient" size="lg" onClick={() => void handleSave("publish")} disabled={submittingAction !== null}>
            <Globe className="h-4 w-4" />
            即公開
          </Button>
          <Button variant="outline" className="gap-2 shadow-sm transition-shadow hover:shadow-md" size="lg" onClick={() => void handleSave("draft")} disabled={submittingAction !== null}>
            <Save className="h-4 w-4" />
            下書き保存
          </Button>
          <Button
            variant={showSchedule ? "default" : "outline"}
            className={cn("gap-2 transition-shadow", showSchedule ? "btn-gradient" : "shadow-sm hover:shadow-md")}
            size="lg"
            onClick={toggleSchedule}
            disabled={submittingAction !== null}
          >
            <CalendarClock className="h-4 w-4" />
            予約投稿
          </Button>
        </div>
      </div>
    </PageWrapper>
  );
}
