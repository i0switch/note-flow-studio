import { ArticlePreviewDialog } from "@/components/ArticlePreviewDialog";
import { PageWrapper } from "@/components/PageWrapper";
import { StatusBadge, type StatusType } from "@/components/StatusBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppData } from "@/context/AppDataContext";
import type { ArticleRecord } from "@/lib/app-data";
import { Eye, ExternalLink, PenLine, Search, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";

export default function ArticlesPage() {
  const navigate = useNavigate();
  const { state, deleteArticle, deleteArticles, publishArticle, saveDraft, regenerateAssets, updateArticle } = useAppData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [genreFilter, setGenreFilter] = useState("all");
  const [noteFilter, setNoteFilter] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // プレビュー待機ダイアログ
  const [previewingArticle, setPreviewingArticle] = useState<ArticleRecord | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRowClick = (article: ArticleRecord) => {
    if (article.status === "preview_pending") {
      setPreviewingArticle(article);
    } else {
      navigate(`/articles/${article.id}`);
    }
  };

  const handlePreviewConfirm = async () => {
    if (!previewingArticle) return;
    const action = previewingArticle.pendingNoteAction ?? "draft";
    setPreviewingArticle(null);
    try {
      navigate(`/articles/${previewingArticle.id}`);
      if (action === "publish") {
        const result = await publishArticle(previewingArticle.id);
        toast.success(result?.noteUrl ? "note 公開した" : "公開キューに回した");
      } else if (action === "draft") {
        const result = await saveDraft(previewingArticle.id);
        toast.success(result?.noteUrl ? "note 下書き保存した" : "下書き保存を開始した");
      } else {
        toast.success("予約投稿設定に回した");
      }
      updateArticle(previewingArticle.id, { pendingNoteAction: null });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "note 投稿に失敗した");
    }
  };

  const handlePreviewRegenerate = async (additionalPrompt: string) => {
    if (!previewingArticle) return;
    setIsRegenerating(true);
    try {
      if (additionalPrompt.trim()) {
        const current = previewingArticle.instruction ?? "";
        updateArticle(previewingArticle.id, {
          instruction: current ? `${current}\n\n追加指示: ${additionalPrompt}` : additionalPrompt,
        });
      }
      const updated = await regenerateAssets(previewingArticle.id);
      if (updated) setPreviewingArticle(updated);
    } finally {
      setIsRegenerating(false);
    }
  };

  const filtered = state.articles.filter((article) => {
    if (search && !article.title.includes(search) && !article.keyword.includes(search)) return false;
    if (statusFilter !== "all" && article.status !== statusFilter) return false;
    if (genreFilter !== "all" && article.genre !== genreFilter) return false;
    if (noteFilter !== "all" && article.noteStatus !== noteFilter) return false;
    return true;
  });

  const genres = Array.from(new Set(state.articles.map((article) => article.genre)));

  const allFilteredSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.id));
  const someSelected = selected.size > 0;

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const next = new Set(selected);
      for (const a of filtered) next.delete(a.id);
      setSelected(next);
    } else {
      const next = new Set(selected);
      for (const a of filtered) next.add(a.id);
      setSelected(next);
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmId) return;
    setDeletingId(confirmId);
    setConfirmId(null);
    try {
      await deleteArticle(confirmId);
      setSelected((prev) => { const next = new Set(prev); next.delete(confirmId); return next; });
      toast.success("記事を削除しました");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDeleteConfirm = async () => {
    const ids = Array.from(selected);
    setBulkDeleting(true);
    setConfirmBulk(false);
    try {
      await deleteArticles(ids);
      setSelected(new Set());
      toast.success(`${ids.length}件の記事を削除しました`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "一括削除に失敗しました");
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <PageWrapper
      title="投稿管理"
      description="生成された記事の一覧と管理。"
      actions={
        <Link to="/articles/new">
          <Button size="sm" className="gap-1.5 btn-gradient">
            <PenLine className="h-3.5 w-3.5" />
            手動で記事を追加
          </Button>
        </Link>
      }
    >
      <div className="card-elevated space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="タイトル・キーワードで検索..." value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="状態" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべての状態</SelectItem>
              <SelectItem value="generating">執筆中</SelectItem>
              <SelectItem value="completed">完了</SelectItem>
              <SelectItem value="preview_pending">プレビュー待機</SelectItem>
              <SelectItem value="error">エラー</SelectItem>
            </SelectContent>
          </Select>
          <Select value={genreFilter} onValueChange={setGenreFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="ジャンル" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべてのジャンル</SelectItem>
              {genres.map((genre) => (
                <SelectItem key={genre} value={genre}>{genre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={noteFilter} onValueChange={setNoteFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="note投稿" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="pending">未投稿</SelectItem>
              <SelectItem value="saved">保存済み</SelectItem>
              <SelectItem value="published">公開済み</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {someSelected && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5">
          <span className="text-sm text-muted-foreground">{selected.size}件選択中</span>
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5 ml-auto"
            disabled={bulkDeleting}
            onClick={() => setConfirmBulk(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {bulkDeleting ? "削除中..." : `${selected.size}件を削除`}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            選択解除
          </Button>
        </div>
      )}

      <div className="card-elevated overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pl-4">
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="すべて選択"
                />
              </TableHead>
              <TableHead className="text-xs">タイトル</TableHead>
              <TableHead className="text-xs">キーワード</TableHead>
              <TableHead className="text-xs">状態</TableHead>
              <TableHead className="text-xs">note投稿</TableHead>
              <TableHead className="text-xs">作成日</TableHead>
              <TableHead className="text-xs">投稿予定日</TableHead>
              <TableHead className="text-xs w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  該当する記事がありません
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((article) => (
                <TableRow
                  key={article.id}
                  className="cursor-pointer transition-colors hover:bg-muted/30"
                  data-selected={selected.has(article.id)}
                  onClick={() => handleRowClick(article)}
                >
                  <TableCell className="pl-4" onClick={(e) => { e.stopPropagation(); toggleOne(article.id); }}>
                    <Checkbox checked={selected.has(article.id)} aria-label="選択" />
                  </TableCell>
                  <TableCell className="max-w-[300px] text-sm font-medium">
                    <span className="flex items-center gap-1.5 truncate">
                      {article.status === "preview_pending" && (
                        <Eye className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      )}
                      <span className="truncate">{article.title}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{article.keyword}</TableCell>
                  <TableCell><StatusBadge status={article.status as StatusType} /></TableCell>
                  <TableCell><StatusBadge status={article.noteStatus as StatusType} /></TableCell>
                  <TableCell className="tabular-nums text-sm text-muted-foreground">{article.createdAt}</TableCell>
                  <TableCell className="tabular-nums text-sm text-muted-foreground">{article.scheduledAt ?? "—"}</TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()} className="flex items-center gap-1">
                    {article.noteUrl ? (
                      <a href={article.noteUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-primary hover:text-primary/80">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      disabled={deletingId === article.id}
                      onClick={() => setConfirmId(article.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* プレビュー待機ダイアログ */}
      {previewingArticle && (
        <ArticlePreviewDialog
          open={true}
          article={previewingArticle}
          action={previewingArticle.pendingNoteAction ?? "draft"}
          isRegenerating={isRegenerating}
          onConfirm={() => void handlePreviewConfirm()}
          onRegenerate={handlePreviewRegenerate}
          onEdit={(patch) => {
            updateArticle(previewingArticle.id, patch);
            setPreviewingArticle((prev) => prev ? { ...prev, ...patch } : prev);
          }}
          onClose={() => setPreviewingArticle(null)}
        />
      )}

      {/* 単体削除 */}
      <AlertDialog open={confirmId !== null} onOpenChange={(open) => { if (!open) setConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>記事を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。記事は一覧から削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteConfirm()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 一括削除 */}
      <AlertDialog open={confirmBulk} onOpenChange={(open) => { if (!open) setConfirmBulk(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selected.size}件の記事を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。選択した{selected.size}件の記事がすべて削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleBulkDeleteConfirm()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {selected.size}件を削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageWrapper>
  );
}
