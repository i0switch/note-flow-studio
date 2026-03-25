import { ExecutionTimeline } from "@/components/ExecutionTimeline";
import { PageWrapper } from "@/components/PageWrapper";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAppData } from "@/context/AppDataContext";
import { ArrowLeft, ExternalLink, Globe, Pencil, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

export default function ArticleDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { state, isHydrating, publishArticle, saveDraft, updateArticle, deleteArticle } = useAppData();
  const article = state.articles.find((item) => item.id === id);
  const [noteSubmitting, setNoteSubmitting] = useState<"draft" | "publish" | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    freeContent: "",
    paidGuidance: "",
    paidContent: "",
    body: ""
  });

  useEffect(() => {
    if (!article) return;
    setDraft({
      title: article.title,
      freeContent: article.freeContent,
      paidGuidance: article.paidGuidance,
      paidContent: article.paidContent,
      body: article.body
    });
  }, [article]);

  if (!article && isHydrating) {
    return (
      <PageWrapper title="記事を読み込み中" description="保存済みデータを確認しています。">
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          記事データを読み込んでいます。しばらくお待ちください。
        </div>
      </PageWrapper>
    );
  }

  if (!article) {
    return (
      <PageWrapper title="記事が見つかりません" description="記事一覧から開き直すと表示できる場合があります。">
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          この記事はまだ読み込まれていないか、すでに削除されている可能性があります。
        </div>
        <Button onClick={() => navigate("/articles")}>記事一覧へ戻る</Button>
      </PageWrapper>
    );
  }

  const handleSave = () => {
    updateArticle(article.id, draft);
    setIsEditing(false);
    toast.success("記事内容を保存しました");
  };

  const handleDelete = async () => {
    if (!confirm("この記事を削除しますか？この操作は元に戻せません。")) return;
    setIsDeleting(true);
    try {
      await deleteArticle(article.id);
      toast.success("記事を削除しました");
      navigate("/articles");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "削除に失敗しました");
      setIsDeleting(false);
    }
  };

  const handleNoteAction = async (action: "draft" | "publish") => {
    setNoteSubmitting(action);
    try {
      if (action === "draft") {
        await saveDraft(article.id);
        toast.success("note 下書き保存が完了しました");
        return;
      }

      await publishArticle(article.id);
      toast.success("note 公開が完了しました");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "note 投稿に失敗しました");
    } finally {
      setNoteSubmitting(null);
    }
  };

  const isNoteCompleted = article.noteStatus === "published" || article.noteStatus === "saved";
  const isNoteRunning = article.noteStatus === "running";

  return (
    <PageWrapper title="" description="">
      <div className="space-y-3">
        <Link to="/articles" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          記事管理に戻る
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <h1 className="page-header leading-snug">{article.title}</h1>
            <div className="flex items-center gap-2">
              <StatusBadge status={article.status} />
              <StatusBadge status={article.noteStatus} />
            </div>
            {(article.lastError || article.noteUrl) && (
              <div className="space-y-1 text-xs text-muted-foreground">
                {article.noteUrl ? (
                  <a href={article.noteUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />
                    noteで確認する
                  </a>
                ) : null}
                {article.lastError && article.noteStatus !== "running" && article.noteStatus !== "pending" ? (
                  <p className="text-destructive">直近エラー: {article.lastError}</p>
                ) : article.noteStatus === "running" ? (
                  <p className="text-muted-foreground">処理中...</p>
                ) : null}
              </div>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            {isNoteCompleted ? (
              article.noteUrl ? (
                <a href={article.noteUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    noteで確認する
                  </Button>
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {article.noteStatus === "published" ? "note公開済み" : "note下書き保存済み"}
                </span>
              )
            ) : (
              <>
                <Button variant={isEditing ? "default" : "outline"} size="sm" className="gap-1.5" onClick={() => setIsEditing((value) => !value)}>
                  <Pencil className="h-3.5 w-3.5" />
                  {isEditing ? "編集中" : "編集"}
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSave} disabled={noteSubmitting !== null || isDeleting || isNoteRunning}>
                  <Save className="h-3.5 w-3.5" />
                  保存
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void handleNoteAction("draft")} disabled={noteSubmitting !== null || isDeleting || isNoteRunning}>
                  <Save className="h-3.5 w-3.5" />
                  NOTE保存
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => void handleNoteAction("publish")} disabled={noteSubmitting !== null || isDeleting || isNoteRunning}>
                  <Globe className="h-3.5 w-3.5" />
                  NOTE公開
                </Button>
                <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => void handleDelete()} disabled={noteSubmitting !== null || isDeleting || isNoteRunning}>
                  <Trash2 className="h-3.5 w-3.5" />
                  削除
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="content">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="content">本文</TabsTrigger>
          <TabsTrigger value="references">参考資料</TabsTrigger>
          <TabsTrigger value="history">実行履歴</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="mt-4 space-y-4">
          <div className="space-y-2 rounded-lg border border-border bg-card p-5">
            <span className="section-label">タイトル</span>
            {isEditing ? <Textarea value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /> : <p className="text-base font-semibold">{article.title}</p>}
          </div>
          <div className="space-y-2 rounded-lg border border-border bg-card p-5">
            <span className="section-label">無料部分</span>
            {isEditing ? <Textarea rows={6} value={draft.freeContent} onChange={(event) => setDraft((current) => ({ ...current, freeContent: event.target.value }))} /> : <p className="whitespace-pre-wrap text-sm leading-relaxed">{article.freeContent}</p>}
          </div>
          <div className="space-y-2 rounded-lg border border-primary/30 bg-card p-5">
            <span className="section-label text-primary">有料導線</span>
            {isEditing ? <Textarea rows={3} value={draft.paidGuidance} onChange={(event) => setDraft((current) => ({ ...current, paidGuidance: event.target.value }))} /> : <p className="text-sm leading-relaxed">{article.paidGuidance}</p>}
          </div>
          <div className="space-y-2 rounded-lg border border-border bg-card p-5">
            <span className="section-label">有料部分</span>
            {isEditing ? <Textarea rows={8} value={draft.paidContent} onChange={(event) => setDraft((current) => ({ ...current, paidContent: event.target.value }))} /> : <p className="whitespace-pre-wrap text-sm leading-relaxed">{article.paidContent}</p>}
          </div>
        </TabsContent>

        <TabsContent value="references" className="mt-4 space-y-3">
          {article.references.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">参考資料はまだ紐づいていません。</div>
          ) : (
            article.references.map((reference, index) => (
              <div key={`${reference.title}-${index}`} className="space-y-1 rounded-lg border border-border bg-card p-5">
                <h3 className="text-sm font-semibold">{reference.title}</h3>
                <p className="text-xs text-muted-foreground">{reference.summary}</p>
                <a href={reference.link} className="text-xs text-primary hover:underline">リンクを開く</a>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <span className="section-label mb-4 block">タイムライン</span>
            <ExecutionTimeline items={article.timeline} />
          </div>
        </TabsContent>
      </Tabs>
    </PageWrapper>
  );
}
