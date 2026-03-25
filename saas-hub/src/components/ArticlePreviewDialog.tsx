import { CheckCircle, Eye, Pencil, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ArticleRecord } from "@/lib/app-data";

export type PreviewAction = "publish" | "draft" | "schedule";

type EditDraft = {
  title: string;
  freeContent: string;
  paidContent: string;
};

type Props = {
  open: boolean;
  article: Partial<ArticleRecord>;
  action: PreviewAction;
  isRegenerating: boolean;
  onConfirm: () => void;
  onRegenerate: (additionalPrompt: string) => Promise<void>;
  onEdit?: (patch: Partial<ArticleRecord>) => void;
  onClose: () => void;
};

const ACTION_LABEL: Record<PreviewAction, string> = {
  publish: "公開する",
  draft: "下書き保存",
  schedule: "予約投稿に設定",
};

export function ArticlePreviewDialog({
  open,
  article,
  action,
  isRegenerating,
  onConfirm,
  onRegenerate,
  onEdit,
  onClose,
}: Props) {
  const [additionalPrompt, setAdditionalPrompt] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<EditDraft>({
    title: article.title ?? "",
    freeContent: article.freeContent ?? article.body ?? "",
    paidContent: article.paidContent ?? "",
  });

  // article prop が更新されたとき（再生成後など）editDraft を同期（編集中でない場合のみ）
  useEffect(() => {
    if (!isEditMode) {
      setEditDraft({
        title: article.title ?? "",
        freeContent: article.freeContent?.trim() || article.body?.trim() || "",
        paidContent: article.paidContent ?? "",
      });
    }
  // article が参照変わりするたびに同期
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.title, article.freeContent, article.body, article.paidContent]);

  const syncedTitle = isEditMode ? editDraft.title : (article.title ?? "");
  const syncedFree = isEditMode ? editDraft.freeContent : (article.freeContent?.trim() || article.body?.trim() || "");
  const syncedPaid = isEditMode ? editDraft.paidContent : (article.paidContent ?? "");

  const hasPaidContent = article.saleMode === "paid" && Boolean((isEditMode ? editDraft.paidContent : article.paidContent)?.trim());

  const handleRegenerate = async () => {
    // 再生成前に編集内容を反映してから編集モード終了
    if (isEditMode && onEdit) onEdit(editDraft);
    setIsEditMode(false);
    await onRegenerate(additionalPrompt);
    setAdditionalPrompt("");
    // useEffect が article prop の変更を検知して editDraft を自動同期する
  };

  const applyEdits = () => {
    if (onEdit) onEdit(editDraft);
    setIsEditMode(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isRegenerating) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-6 py-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4 text-primary" />
              生成プレビュー
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => {
                if (isEditMode) {
                  applyEdits();
                } else {
                  setEditDraft({
                    title: article.title ?? "",
                    freeContent: article.freeContent?.trim() || article.body?.trim() || "",
                    paidContent: article.paidContent ?? "",
                  });
                  setIsEditMode(true);
                }
              }}
              disabled={isRegenerating}
              data-testid="edit-toggle"
            >
              {isEditMode ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5" />
                  編集を適用
                </>
              ) : (
                <>
                  <Pencil className="h-3.5 w-3.5" />
                  直接編集
                </>
              )}
            </Button>
          </div>
          <DialogDescription className="sr-only">
            生成された記事を確認し、公開処理を進めるか再生成するか選んでください。
          </DialogDescription>
        </DialogHeader>

        {/* スクロール対象エリア */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* タイトル */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">タイトル</Label>
            {isEditMode ? (
              <Textarea
                data-testid="edit-title"
                rows={2}
                className="resize-none text-sm font-semibold"
                value={editDraft.title}
                onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
              />
            ) : (
              <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm font-semibold leading-snug">
                {syncedTitle || "（タイトルなし）"}
              </div>
            )}
          </div>

          {/* 無料パート / 全文 */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {hasPaidContent ? "無料パート" : "本文"}
            </Label>
            {isEditMode ? (
              <Textarea
                data-testid="edit-free-content"
                rows={8}
                className="resize-y text-sm leading-relaxed"
                value={editDraft.freeContent}
                onChange={(e) => setEditDraft((d) => ({ ...d, freeContent: e.target.value }))}
              />
            ) : (
              <div className="min-h-[120px] rounded-lg border border-border/60 bg-background px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                {syncedFree || "（内容なし）"}
              </div>
            )}
          </div>

          {/* 有料パート */}
          {(hasPaidContent || (isEditMode && article.saleMode === "paid")) && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">有料パート</Label>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  有料
                </span>
              </div>
              {isEditMode ? (
                <Textarea
                  data-testid="edit-paid-content"
                  rows={8}
                  className="resize-y border-primary/30 text-sm leading-relaxed"
                  value={editDraft.paidContent}
                  onChange={(e) => setEditDraft((d) => ({ ...d, paidContent: e.target.value }))}
                />
              ) : (
                <div className="min-h-[120px] rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {syncedPaid}
                </div>
              )}
            </div>
          )}
        </div>

        {/* フッター（固定） */}
        <div className="border-t border-border/60 px-6 py-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              AIへの追加指示（任意） — 入力して再生成できます
            </Label>
            <Textarea
              data-testid="additional-prompt"
              placeholder="例: もっと具体的なステップを増やして。冒頭をインパクトのある一文に変えて。"
              rows={2}
              value={additionalPrompt}
              onChange={(e) => setAdditionalPrompt(e.target.value)}
              disabled={isRegenerating}
              className="resize-none text-sm"
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => void handleRegenerate()}
              disabled={isRegenerating}
              data-testid="regenerate-button"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRegenerating ? "animate-spin" : ""}`}
              />
              {isRegenerating ? "再生成中..." : "AIに再生成させる"}
            </Button>
            <Button
              className="flex-1 gap-2 btn-gradient"
              onClick={() => {
                if (isEditMode && onEdit) onEdit(editDraft);
                onConfirm();
              }}
              disabled={isRegenerating}
              data-testid="confirm-button"
            >
              <CheckCircle className="h-4 w-4" />
              プレビュー完了 → {ACTION_LABEL[action]}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
