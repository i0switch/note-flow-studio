import { PageWrapper } from "@/components/PageWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppData } from "@/context/AppDataContext";
import { FileText, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function PromptsPage() {
  const { state, addPrompt, deletePrompt, updatePrompt } = useAppData();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(state.prompts[0]?.id ?? null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", content: "" });

  const filtered = state.prompts.filter((prompt) => {
    if (search && !prompt.title.includes(search) && !prompt.description.includes(search)) return false;
    return true;
  });

  const selectedPrompt = state.prompts.find((prompt) => prompt.id === selected);

  useEffect(() => {
    if (!selected && state.prompts[0]) {
      setSelected(state.prompts[0].id);
    }
  }, [selected, state.prompts]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ title: "", description: "", content: "" });
    setShowForm(true);
  };

  const openEdit = () => {
    if (!selectedPrompt) return;
    setEditingId(selectedPrompt.id);
    setForm({
      title: selectedPrompt.title,
      description: selectedPrompt.description,
      content: selectedPrompt.content
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("タイトルとプロンプト内容は入れて");
      return;
    }

    if (editingId) {
      updatePrompt(editingId, form);
      toast.success("プロンプトを更新した");
      setSelected(editingId);
    } else {
      const prompt = addPrompt(form);
      toast.success("プロンプトを追加した");
      setSelected(prompt.id);
    }

    setShowForm(false);
  };

  return (
    <PageWrapper
      title="プロンプト管理"
      description="記事生成に使用するプロンプトテンプレートの管理。"
      actions={
        <Button size="sm" className="gap-1.5 btn-gradient" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          追加
        </Button>
      }
    >
      {showForm && (
        <div className="card-elevated space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span className="inline-block h-4 w-1 rounded-full bg-primary" />
            {editingId ? "プロンプトを編集" : "プロンプトを追加"}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">タイトル</Label>
              <Input placeholder="テンプレート名" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">説明</Label>
              <Input placeholder="このプロンプトの用途" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">プロンプト内容</Label>
            <Textarea placeholder="プロンプトの本文を入力..." rows={6} value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="btn-gradient" onClick={handleSave}>保存</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>キャンセル</Button>
          </div>
        </div>
      )}

      <div className="card-elevated">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="プロンプトを検索..." value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="space-y-2 lg:col-span-2">
          {filtered.map((prompt) => (
            <button
              key={prompt.id}
              onClick={() => setSelected(prompt.id)}
              className={`w-full rounded-xl border p-4 text-left transition-all duration-200 ${
                selected === prompt.id
                  ? "border-primary bg-accent shadow-md"
                  : "border-border bg-card hover:bg-muted/50 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileText className={`h-4 w-4 shrink-0 ${selected === prompt.id ? "text-primary" : "text-muted-foreground"}`} />
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium">{prompt.title}</h3>
                  <p className="truncate text-xs text-muted-foreground">{prompt.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-3">
          {selectedPrompt ? (
            <div className="card-elevated sticky top-18 space-y-4">
              <div className="flex items-start justify-between">
                <h2 className="text-base font-semibold">{selectedPrompt.title}</h2>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={openEdit}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      deletePrompt(selectedPrompt.id);
                      setSelected(null);
                      toast.success("プロンプトを削除した");
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div>
                <span className="section-label">説明</span>
                <p className="mt-1 text-sm text-muted-foreground">{selectedPrompt.description}</p>
              </div>
              <div>
                <span className="section-label">プロンプト内容</span>
                <div className="mt-2 rounded-lg border border-border/40 bg-muted/30 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{selectedPrompt.content}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="card-elevated p-12 text-center">
              <p className="text-sm text-muted-foreground">左の一覧からプロンプトを選択してください</p>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
