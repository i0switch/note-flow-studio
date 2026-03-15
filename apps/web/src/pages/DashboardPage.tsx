import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GenerationJobCreateInput, GenerationJobSummary } from "@note-local/shared";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AccountRecord, PromptTemplateRecord, ReferenceRecord } from "../api";
import { api } from "../api";
import { Field, Toggle } from "../components/ui";
import { useAppStore } from "../store";

const DashboardPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setSelectedJobId = useAppStore((state) => state.setSelectedJobId);
  const { data: accounts = [] } = useQuery<AccountRecord[]>({ queryKey: ["accounts"], queryFn: api.getAccounts });
  const { data: templates = [] } = useQuery<PromptTemplateRecord[]>({ queryKey: ["templates"], queryFn: api.getPromptTemplates });
  const { data: references = [] } = useQuery<ReferenceRecord[]>({ queryKey: ["references"], queryFn: api.getReferences });
  const { data: jobs = [] } = useQuery<GenerationJobSummary[]>({
    queryKey: ["jobs"],
    queryFn: api.listJobs,
    refetchInterval: 3000
  });
  const [form, setForm] = useState<GenerationJobCreateInput>({
    keyword: "",
    noteAccountId: 1,
    promptTemplateId: 1,
    targetGenre: "",
    referenceMaterialIds: [],
    imageEnabled: true,
    graphEnabled: true,
    monetizationEnabled: true,
    salesMode: "free_paid",
    desiredPriceYen: 980,
    additionalInstruction: ""
  });

  const createJob = useMutation({
    mutationFn: api.createJob,
    onSuccess: async (job: { id: number }) => {
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setSelectedJobId(job.id);
      navigate(`/jobs/${job.id}`);
    }
  });

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">SCR-001</p>
            <h2 className="text-2xl font-black text-ink">記事生成</h2>
          </div>
          <button className="button-primary" onClick={() => createJob.mutate(form)} disabled={createJob.isPending}>
            {createJob.isPending ? "生成中..." : "生成開始"}
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="キーワード"><input className="field" value={form.keyword} onChange={(event) => setForm({ ...form, keyword: event.target.value })} /></Field>
          <Field label="対象ジャンル"><input className="field" value={form.targetGenre ?? ""} onChange={(event) => setForm({ ...form, targetGenre: event.target.value })} /></Field>
          <Field label="使用アカウント">
            <select className="field" value={form.noteAccountId} onChange={(event) => setForm({ ...form, noteAccountId: Number(event.target.value) })}>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.displayName}</option>)}
            </select>
          </Field>
          <Field label="プロンプト">
            <select className="field" value={form.promptTemplateId} onChange={(event) => setForm({ ...form, promptTemplateId: Number(event.target.value) })}>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </Field>
          <Field label="想定価格"><input className="field" type="number" value={form.desiredPriceYen ?? 0} onChange={(event) => setForm({ ...form, desiredPriceYen: Number(event.target.value) })} /></Field>
          <Field label="販売モード">
            <select className="field" value={form.salesMode} onChange={(event) => setForm({ ...form, salesMode: event.target.value as "normal" | "free_paid" })}>
              <option value="free_paid">無料+有料</option>
              <option value="normal">通常</option>
            </select>
          </Field>
          <Field label="参考資料">
            <div className="grid max-h-44 gap-2 overflow-auto rounded-xl border border-stone-300 p-3">
              {references.map((reference) => (
                <label key={reference.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.referenceMaterialIds.includes(reference.id)}
                    onChange={() => setForm({
                      ...form,
                      referenceMaterialIds: form.referenceMaterialIds.includes(reference.id)
                        ? form.referenceMaterialIds.filter((id) => id !== reference.id)
                        : [...form.referenceMaterialIds, reference.id]
                    })}
                  />
                  {reference.title}
                </label>
              ))}
            </div>
          </Field>
          <Field label="補足指示"><textarea className="field min-h-32" value={form.additionalInstruction} onChange={(event) => setForm({ ...form, additionalInstruction: event.target.value })} /></Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-stone-700">
          <Toggle label="画像" checked={form.imageEnabled} onChange={(value) => setForm({ ...form, imageEnabled: value })} />
          <Toggle label="グラフ" checked={form.graphEnabled} onChange={(value) => setForm({ ...form, graphEnabled: value })} />
          <Toggle label="販売導線" checked={form.monetizationEnabled} onChange={(value) => setForm({ ...form, monetizationEnabled: value })} />
        </div>
      </section>

      <section className="card p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">SCR-002</p>
        <h2 className="mb-4 text-2xl font-black text-ink">実行履歴</h2>
        <div className="overflow-hidden rounded-2xl border border-stone-200">
          <table className="min-w-full text-sm">
            <thead className="bg-stone-100 text-left">
              <tr><th className="px-4 py-3">キーワード</th><th className="px-4 py-3">ジャンル</th><th className="px-4 py-3">販売</th><th className="px-4 py-3">状態</th><th className="px-4 py-3">詳細</th></tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-stone-200">
                  <td className="px-4 py-3">{job.keyword}</td>
                  <td className="px-4 py-3">{job.targetGenre ?? "auto"}</td>
                  <td className="px-4 py-3">{job.salesMode}</td>
                  <td className="px-4 py-3">{job.status}</td>
                  <td className="px-4 py-3"><Link className="font-semibold text-pine underline" to={`/jobs/${job.id}`}>開く</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
