import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReferenceMaterialImportInput } from "@note-local/shared";
import { useState } from "react";
import type { ReferenceRecord } from "../api";
import { api } from "../api";
import { Field } from "../components/ui";

const ReferencePage = () => {
  const queryClient = useQueryClient();
  const { data: references = [] } = useQuery<ReferenceRecord[]>({
    queryKey: ["references"],
    queryFn: api.getReferences
  });
  const [form, setForm] = useState<ReferenceMaterialImportInput>({
    sourceType: "text",
    sourceValue: "",
    title: "",
    genreLabel: "",
    tags: []
  });
  const importMutation = useMutation({
    mutationFn: api.importReference,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["references"] });
      setForm({ sourceType: "text", sourceValue: "", title: "", genreLabel: "", tags: [] });
    }
  });

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">SCR-013</p>
        <h2 className="mb-4 text-2xl font-black text-ink">参考資料管理</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="タイトル"><input className="field" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
          <Field label="ソース種類">
            <select className="field" value={form.sourceType} onChange={(event) => setForm({ ...form, sourceType: event.target.value as "url" | "text" | "file" })}>
              <option value="text">text</option>
              <option value="url">url</option>
              <option value="file">file</option>
            </select>
          </Field>
          <Field label="ジャンル"><input className="field" value={form.genreLabel ?? ""} onChange={(event) => setForm({ ...form, genreLabel: event.target.value })} /></Field>
          <Field label="タグ"><input className="field" value={form.tags.join(", ")} onChange={(event) => setForm({ ...form, tags: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></Field>
        </div>
        <Field label="本文 / URL / ファイルパス"><textarea className="field min-h-40" value={form.sourceValue} onChange={(event) => setForm({ ...form, sourceValue: event.target.value })} /></Field>
        <button className="button-primary" onClick={() => importMutation.mutate(form)}>取り込む</button>
      </section>
      <section className="card p-6">
        <h3 className="mb-4 text-xl font-black text-ink">登録済み参考資料</h3>
        <div className="space-y-3">
          {references.map((reference) => <div key={reference.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-4"><div className="font-semibold">{reference.title}</div><div className="mt-1 text-sm text-stone-600">{reference.summaryText}</div></div>)}
        </div>
      </section>
    </div>
  );
};

export default ReferencePage;
