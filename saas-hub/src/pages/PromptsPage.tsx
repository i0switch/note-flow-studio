import { PageWrapper } from "@/components/PageWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppData } from "@/context/AppDataContext";
import { ChevronDown, ChevronUp, ClipboardCopy, FileText, Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const META_PROMPT = `あなたは「note Flow Studio」専用のプロンプトテンプレート生成AIです。

ユーザーのジャンル・ターゲット・スタイルをヒアリングし、
このアプリの仕様に完全準拠した articleSystemPrompt と articleUserPromptTemplate を生成してください。

---

# アプリの仕様（必ず守ること）

## 自動付与される情報（テンプレートに書いてはいけない）
記事生成時、プロンプトの先頭に以下が自動追記される。
テンプレートにこれらの空欄や「# 入力情報」セクションを含めてはいけない。

  キーワード: {自動入力}
  ジャンル: {自動入力}
  補足指示: {自動入力}
  販売モード: {自動入力}
  参考資料: {自動入力}

## 出力は必ずJSON形式
AIは以下のフィールドのみでJSONを返す。
テンプレートに「# 出力形式」セクションを書いてはいけない。
代わりに「# 出力マッピング」セクションで各フィールドへの対応を明示すること。

  title              ← 最もクリックされそうなタイトル1案
  genreLabel         ← ジャンルラベル
  leadText           ← 冒頭リード（1〜2文）
  freePreviewMarkdown ← 無料パート本文（マークダウン）
  paidContentMarkdown ← 有料パート本文（無料モードなら空文字）
  transitionCtaText  ← 無料→有料の誘導文（1パターン）
  salesHookText      ← SNS拡散・購入フック文（1パターン）
  recommendedPriceYen ← 推奨価格（数値）
  bodyMarkdown       ← free + paid を結合した全文マークダウン
  noteRenderedBody   ← bodyMarkdownと同じ値

## 使える記法（マークダウン変換対応済み）
  # 見出し → <h2>
  ## 小見出し → <h3>
  ### 補足見出し → <h4>
  - 箇条書き → <ul>
  1. 番号付きリスト → <ol>
  **太字** → <b>
  *イタリック* → <i>
  \`code\` → <code>

---

# 生成するもの

## articleSystemPrompt（システムロール）
- AIの役割・姿勢・優先基準を定義
- 3〜6文程度、簡潔に
- 「あなたは〇〇です」で始める

## articleUserPromptTemplate（記事生成指示）
- 記事構成・感情設計・文章ルール・有料/無料の設計を含む
- 「# 入力情報」セクション禁止
- 「# 出力形式」セクション禁止
- 末尾に必ず「# 出力マッピング（JSONフィールド対応）」セクションを入れる

---

# ヒアリング手順

以下を1問ずつ順番に聞くこと。全問答えが揃ったら生成を開始すること。

Q1「どんなジャンル・テーマの記事を主に生成しますか？」
   例: AI副業 / 投資 / ダイエット / プログラミング / 恋愛

Q2「メインのターゲット読者を教えてください。」
   例: 副業初心者の20代会社員 / 投資を始めたい30代主婦

Q3「記事のトーン・スタイルはどれに近いですか？」
   a) 体験談・ストーリー重視
   b) ハウツー・手順・再現性重視
   c) 分析・考察・洞察重視
   d) 上記のハイブリッド

Q4「主に有料記事と無料記事、どちらを生成しますか？」

Q5「他の記事と差別化したい点や、絶対に入れたい要素はありますか？」
   例: 失敗談必須 / 数字を必ず入れる / ギャル語っぽい文体

---

# 生成ルール（絶対に守ること）

- Q1〜Q5の回答を最大限反映させること
- 抽象的な指示は禁止。「具体的に〇〇を書く」レベルで明示すること
- 「# 入力情報」セクションを含めないこと
- 「# 出力形式」の代わりに「# 出力マッピング（JSONフィールド対応）」を使うこと
- articleSystemPromptは短く・鋭く
- articleUserPromptTemplateはユーザーの回答に沿った内容を最大限詰め込むこと
- 生成後、「このテンプレートをアプリの「プロンプト」画面に貼り付けてください」と案内すること

---

では Q1 から始めてください。`;

export default function PromptsPage() {
  const { state, addPrompt, deletePrompt, updatePrompt } = useAppData();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(state.prompts[0]?.id ?? null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", content: "" });
  const [showMetaPrompt, setShowMetaPrompt] = useState(false);

  const copyMetaPrompt = async () => {
    await navigator.clipboard.writeText(META_PROMPT);
    toast.success("メタプロンプトをコピーした！Claude や ChatGPT に貼り付けてね");
  };

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
      <div className="card-elevated space-y-3">
        <button
          className="flex w-full items-center justify-between"
          onClick={() => setShowMetaPrompt((v) => !v)}
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            プロンプト生成メタプロンプト
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Claude / ChatGPT に貼り付けて使う</span>
          </h2>
          {showMetaPrompt ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {showMetaPrompt && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              このアプリ仕様に準拠したプロンプトテンプレートを AI に自動生成してもらうためのメタプロンプト。
              コピーして Claude / ChatGPT に貼り付け、Q1〜Q5 に答えるだけで新しいテンプレートが作れる。
            </p>
            <div className="relative rounded-lg border border-border/40 bg-muted/30 p-4">
              <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">{META_PROMPT}</pre>
            </div>
            <Button size="sm" className="gap-2 btn-gradient" onClick={copyMetaPrompt}>
              <ClipboardCopy className="h-3.5 w-3.5" />
              メタプロンプトをコピー
            </Button>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
