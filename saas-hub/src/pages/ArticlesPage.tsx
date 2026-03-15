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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppData } from "@/context/AppDataContext";
import { ExternalLink, PenLine, Search, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";

export default function ArticlesPage() {
  const navigate = useNavigate();
  const { state, deleteArticle } = useAppData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [genreFilter, setGenreFilter] = useState("all");
  const [noteFilter, setNoteFilter] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const filtered = state.articles.filter((article) => {
    if (search && !article.title.includes(search) && !article.keyword.includes(search)) return false;
    if (statusFilter !== "all" && article.status !== statusFilter) return false;
    if (genreFilter !== "all" && article.genre !== genreFilter) return false;
    if (noteFilter !== "all" && article.noteStatus !== noteFilter) return false;
    return true;
  });

  const genres = Array.from(new Set(state.articles.map((article) => article.genre)));

  const handleDeleteConfirm = async () => {
    if (!confirmId) return;
    setDeletingId(confirmId);
    setConfirmId(null);
    try {
      await deleteArticle(confirmId);
      toast.success("記事を削除しました");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "削除に失敗しました");
    } finally {
      setDeletingId(null);
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

      <div className="card-elevated overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
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
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  該当する記事がありません
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((article) => (
                <TableRow key={article.id} className="cursor-pointer transition-colors hover:bg-muted/30" onClick={() => navigate(`/articles/${article.id}`)}>
                  <TableCell className="max-w-[300px] truncate text-sm font-medium">{article.title}</TableCell>
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
    </PageWrapper>
  );
}
