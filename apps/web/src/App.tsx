import { useQuery } from "@tanstack/react-query";
import type { SetupStatus } from "@note-local/shared";
import { lazy, Suspense } from "react";
import { Link, Route, Routes } from "react-router-dom";
import type { DiagnosticRecord } from "./api";
import { api } from "./api";
import { LoadingCard, Sidebar } from "./components/ui";

const SetupPage = lazy(() => import("./pages/SetupPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const JobDetailPage = lazy(() => import("./pages/JobDetailPage"));
const ReferencePage = lazy(() => import("./pages/ReferencePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

const RouteLoader = () => <LoadingCard message="画面を読み込み中..." />;

const SetupGate = () => {
  const { data: status, isLoading } = useQuery<SetupStatus>({
    queryKey: ["setup-status"],
    queryFn: api.getSetupStatus,
    refetchInterval: 5000
  });
  const { data: dependencyChecks = [] } = useQuery<DiagnosticRecord[]>({
    queryKey: ["setup-dependencies"],
    queryFn: api.getSetupDependencies,
    refetchInterval: 15000,
    enabled: status?.isConfigured
  });

  if (isLoading || !status) return <LoadingCard message="起動準備中..." />;
  if (!status.isConfigured) {
    return (
      <Suspense fallback={<RouteLoader />}>
        <SetupPage />
      </Suspense>
    );
  }

  const warnings = dependencyChecks.filter((item) => item.status !== "ok");
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row">
      <Sidebar />
      <main className="flex-1 space-y-4">
        {warnings.length > 0 && (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
            <div className="font-bold">起動はできてるけど、配布前に見ておきたい警告がある。</div>
            <div className="mt-2 space-y-1">
              {warnings.map((warning) => <div key={warning.name}>{warning.name}: {warning.detail}</div>)}
            </div>
            <Link className="mt-3 inline-block font-semibold underline" to="/settings">設定 / 診断を開く</Link>
          </section>
        )}
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route path="/references" element={<ReferencePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
};

export const App = () => (
  <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(183,121,31,0.16),_transparent_28%),linear-gradient(180deg,_#f9f5ee_0%,_#efe6d6_100%)] p-6">
    <SetupGate />
  </div>
);
