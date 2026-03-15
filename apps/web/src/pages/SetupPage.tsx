import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SetupSaveInput, SetupStatus } from "@note-local/shared";
import { useEffect, useState } from "react";
import type { DiagnosticRecord } from "../api";
import { api } from "../api";
import { Field, Toggle } from "../components/ui";

const SetupPage = () => {
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useQuery<SetupStatus>({
    queryKey: ["setup-status"],
    queryFn: api.getSetupStatus,
    refetchInterval: 5000
  });
  const { data: dependencies = [] } = useQuery<DiagnosticRecord[]>({
    queryKey: ["setup-dependencies"],
    queryFn: api.getSetupDependencies,
    refetchInterval: 8000
  });
  const [form, setForm] = useState<SetupSaveInput>({
    geminiApiKey: "",
    geminiModel: "gemini-2.0-flash",
    playwrightHeadless: false,
    localhostPort: 3001
  });

  // 初期値をサーバーから取得したデータで埋める
  useEffect(() => {
    if (status) {
      setForm({
        geminiApiKey: status.fields.hasGeminiApiKey ? "********" : "", // セキュリティのためマスク
        geminiModel: "gemini-2.0-flash", // TODO: サーバーからモデル名も返すべき
        playwrightHeadless: status.fields.playwrightHeadless,
        localhostPort: 3001 // TODO: サーバーからポートも返すべき
      });
    }
  }, [status]);
  const saveMutation = useMutation({
    mutationFn: api.saveSetup,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["setup-status"] });
      await queryClient.invalidateQueries({ queryKey: ["setup-dependencies"] });
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
    }
  });
  const [repairLogs, setRepairLogs] = useState<string[]>([]);
  const repairMutation = useMutation({
    mutationFn: async () => {
      setRepairLogs(["🚀 修復プロセスを開始します...", "📦 依存関係を確認中..."]);
      const result = await api.repairEnvironment();
      if (result.output) {
        setRepairLogs(prev => [...prev, "✅ チェック完了:", ...result.output.split("\n")]);
      } else {
        setRepairLogs(prev => [...prev, "✅ 修復が完了しました。"]);
      }
      return result;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["setup-dependencies"] });
    }
  });
  const [sessionCaptured, setSessionCaptured] = useState(false);
  const captureSessionMutation = useMutation({
    mutationFn: api.captureSession,
    onSuccess: () => {
      setSessionCaptured(true);
      queryClient.invalidateQueries({ queryKey: ["setup-status"] });
      queryClient.invalidateQueries({ queryKey: ["setup-dependencies"] });
    },
    onError: (error) => {
      alert("セッション保存に失敗しちゃった: " + (error instanceof Error ? error.message : String(error)));
    }
  });

  if (isLoading || !status) return <div className="card p-8">セットアップ状態を確認中...</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      <section className="overflow-hidden rounded-[32px] border border-stone-200 bg-white shadow-xl p-8 lg:p-12">
        <div className="mb-10">
          <h1 className="text-3xl font-black tracking-tight text-ink lg:text-4xl">アプリ利用前のセットアップ</h1>
          <p className="mt-3 text-stone-600">
            初回のみ必要な設定です。完了後はそのままアプリを利用できます。
          </p>
        </div>

        <div className="grid gap-12 lg:grid-cols-2">
          {/* Step 1: Settings */}
          <div className="space-y-8">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <h2 className="text-xl font-black text-ink">1. 基本設定</h2>
              <span className={`rounded-full px-4 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${status.isConfigured ? "bg-emerald-100 text-emerald-700" : "bg-stone-200 text-stone-600"}`}>
                {status.isConfigured ? "設定済み" : "未設定"}
              </span>
            </div>
            
            <div className="space-y-6">
              <Field label="Gemini API Key (任意)">
                <input 
                  className="field" 
                  type="password" 
                  placeholder="空欄でもセットアップ可能です"
                  value={form.geminiApiKey} 
                  onChange={(e) => setForm({ ...form, geminiApiKey: e.target.value })} 
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Gemini Model">
                  <input className="field" value={form.geminiModel} onChange={(e) => setForm({ ...form, geminiModel: e.target.value })} />
                </Field>
                <Field label="localhost Port">
                  <input className="field" type="number" value={form.localhostPort} onChange={(e) => setForm({ ...form, localhostPort: Number(e.target.value) })} />
                </Field>
              </div>
              
              <Field label="note ログイン設定">
                {!(sessionCaptured || dependencies.find(d => d.name === "note-session")?.status === "ok") && (
                  <button
                    className="w-full bg-[#f1f1f1] text-[#333] border border-[#ccc] p-3 rounded-xl font-bold hover:bg-[#e7e7e7] transition-colors flex items-center justify-center gap-2"
                    onClick={() => captureSessionMutation.mutate()}
                    disabled={captureSessionMutation.isPending}
                  >
                    {captureSessionMutation.isPending ? "ログイン待機中..." : "👉 note にログインしてセッションを保存"}
                  </button>
                )}
                {(sessionCaptured || dependencies.find(d => d.name === "note-session")?.status === "ok") && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-700">
                    <span className="text-xl">✅</span>
                    <span>note セッションは保存済みだよ！</span>
                  </div>
                )}
                <p className="mt-2 text-[10px] text-stone-500 leading-relaxed">
                  ※ID/パスワードはアプリに保存しません。ブラウザが開くので note にログインしてください。
                </p>
              </Field>

              <div className="pt-2">
                <Toggle label="Playwrightをヘッドレス(画面なし)で動かす" checked={form.playwrightHeadless} onChange={(val) => setForm({ ...form, playwrightHeadless: val })} />
              </div>

              <div className="flex gap-3 pt-4">
                <button className="button-primary flex-1 py-4 text-base" onClick={() => saveMutation.mutate(form)}>
                  {saveMutation.isPending ? "保存中..." : "設定を保存"}
                </button>
                <button className="button-secondary flex-1 py-4 text-base" onClick={() => repairMutation.mutate()}>
                  {repairMutation.isPending ? "修復中..." : "依存チェック"}
                </button>
              </div>

              {saveMutation.isSuccess && <p className="text-center text-sm font-bold text-emerald-600">✅ 設定を保存しました。依存チェックがOKなら完了です。</p>}
              
              {(repairMutation.isPending || repairLogs.length > 0) && (
                <div className="mt-4 space-y-2">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-500 opacity-60">修復ログ</h3>
                  <pre className="max-h-44 overflow-auto rounded-xl bg-ink p-4 text-[10px] text-stone-200 leading-relaxed">
                    {repairLogs.map((log, i) => (
                      <div key={i}>{log}</div>
                    ))}
                    {repairMutation.error && (
                      <div className="text-rose-400 font-bold mt-2">
                        ❌ {repairMutation.error instanceof Error ? repairMutation.error.message : "修復に失敗"}
                      </div>
                    )}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Diagnostics */}
          <div className="space-y-8">
            <div className="border-b border-stone-100 pb-4">
              <h2 className="text-xl font-black text-ink">2. 動作環境の確認</h2>
            </div>
            <div className="space-y-5">
              {dependencies.filter(i => i.name !== "pinchtab").map((item) => (
                <div key={item.name} className="flex items-start justify-between gap-4 rounded-2xl border border-stone-100 bg-stone-50/50 p-5 transition-colors hover:bg-stone-50">
                  <div className="min-w-0">
                    <div className="font-black text-ink uppercase text-[10px] tracking-widest opacity-60 mb-1">{item.name}</div>
                    <p className="text-sm font-bold text-stone-700 truncate">{item.detail}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm ${
                    item.status === "ok" ? "bg-emerald-500 text-white" : 
                    item.status === "warn" ? "bg-amber-400 text-white" : 
                    "bg-rose-500 text-white"
                  }`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
            
            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5 text-[11px] text-blue-700 leading-relaxed">
              <span className="font-black block mb-2 tracking-tighter uppercase opacity-50">Setup Guide</span>
              Playwright (Chromium) が「見つからない」場合は、「依存チェック」ボタンを押してください。必要なブラウザが自動でダウンロードされます。修復完了まで1〜2分かかります。
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SetupPage;
