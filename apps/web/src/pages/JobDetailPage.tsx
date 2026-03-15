import { useMutation, useQuery } from "@tanstack/react-query";
import type { GenerationJobDetail } from "@note-local/shared";
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { InfoCard } from "../components/ui";

const JobDetailPage = () => {
  const params = useParams();
  const id = Number(params.id);
  const { data, isLoading } = useQuery<GenerationJobDetail>({
    queryKey: ["job", id],
    queryFn: () => api.getJob(id),
    refetchInterval: 2500
  });
  const assetSummary = useMemo(() => [
    ...((data?.article?.generatedImages ?? []).map((item) => `画像: ${item.promptText}`)),
    ...((data?.article?.generatedGraphs ?? []).map((item) => `グラフ: ${item.graphTitle}`))
  ].join("\n\n"), [data?.article?.generatedGraphs, data?.article?.generatedImages]);
  const saveMutation = useMutation({
    mutationFn: () => api.saveJob(id, { forceMethod: null, noteAccountId: 1, applySaleSettings: true })
  });
  const publishMutation = useMutation({
    mutationFn: () => api.publishJob(id, { forceMethod: "playwright", noteAccountId: 1, applySaleSettings: true })
  });
  const graphMutation = useMutation({ mutationFn: () => api.regenerateGraphs(id) });
  const salesMutation = useMutation({
    mutationFn: () => api.applySaleSettings(id, {
      priceYen: data?.article?.recommendedPriceYen ?? 980,
      freePreviewRatio: 0.35,
      transitionCtaText: data?.article?.transitionCtaText ?? "ここから先で実装を深掘りする"
    })
  });

  if (isLoading || !data) return <div className="card p-6">読み込み中...</div>;

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">SCR-003</p>
            <h2 className="text-2xl font-black text-ink">{data.article?.title ?? data.keyword}</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="button-secondary" onClick={() => graphMutation.mutate()}>グラフ再生成</button>
            <button className="button-secondary" onClick={() => salesMutation.mutate()}>販売設定反映</button>
            <button className="button-primary" onClick={() => saveMutation.mutate()}>noteへ下書き保存</button>
            <button className="button-primary" onClick={() => publishMutation.mutate()}>noteへ公開</button>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <InfoCard title="無料部分" content={data.article?.freePreviewMarkdown ?? ""} />
          <InfoCard title="有料導線" content={data.article?.transitionCtaText ?? ""} />
          <InfoCard title="有料部分" content={data.article?.paidContentMarkdown ?? ""} />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <InfoCard title="本文" content={data.article?.bodyMarkdown ?? ""} />
          <InfoCard title="アイキャッチ / グラフ" content={assetSummary} />
        </div>
      </section>
      <section className="card p-6">
        <h3 className="mb-3 text-xl font-black text-ink">参考資料</h3>
        <ul className="space-y-2 text-sm text-stone-700">
          {data.references.map((reference) => <li key={reference.id} className="rounded-xl bg-stone-50 p-3"><div className="font-semibold">{reference.title}</div><div>{reference.summaryText}</div></li>)}
        </ul>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <InfoCard title="保存履歴" content={(data.article?.saveAttempts ?? []).map((attempt) => `${attempt.method} / ${attempt.result} / ${attempt.draftUrl ?? "URLなし"}`).join("\n") || "保存履歴なし"} />
        <InfoCard title="実行ログ" content={data.logs.map((log) => `[${log.level}] ${log.message}`).join("\n") || "ログなし"} />
      </section>
    </div>
  );
};

export default JobDetailPage;
