import { PageWrapper } from "@/components/PageWrapper";
import { StatusBadge, type StatusType } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/context/AppDataContext";
import { providerLabels } from "@/lib/app-data";
import { captureNoteSession } from "@/lib/note-api";
import { Download, ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function DiagnosticsPage() {
  const { diagnostics, state, installChromium, rerunDiagnostics, captureAccountSession } = useAppData();
  const navigate = useNavigate();
  const [running, setRunning] = useState<"diagnostics" | "install" | "session" | null>(null);

  const logs = [
    { time: "14:30:01", level: "info", message: "診断を開始しました" },
    ...diagnostics.map((diagnostic) => ({
      time: "14:30:02",
      level: diagnostic.status === "error" ? "error" : "info",
      message: `${diagnostic.name}: ${diagnostic.detail}`
    })),
    { time: "14:30:06", level: "info", message: `診断完了 (${state.lastDiagnosticsRunAt})` }
  ];

  const handleInstallChromium = async () => {
    setRunning("install");
    try {
      await installChromium();
      toast.success("Chromiumの導入が完了しました");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chromium導入に失敗しました");
    } finally {
      setRunning(null);
    }
  };

  const handleCaptureSession = async () => {
    setRunning("session");
    try {
      const result = await captureAccountSession();
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "セッション取得に失敗しました");
    } finally {
      setRunning(null);
    }
  };

  // Normalize diagnostic name for matching (case-insensitive, hyphen/space agnostic)
  const matchName = (name: string, ...patterns: string[]) =>
    patterns.some((p) => name.toLowerCase().includes(p.toLowerCase()));

  const getInlineAction = (diagnostic: (typeof diagnostics)[number]) => {
    if (diagnostic.status === "completed") return null;

    // Chromium: "playwright-browser" (getDependencyChecks), "Playwright" (buildDiagnostics), "playwright" (verifyAdapters)
    if (matchName(diagnostic.name, "playwright-browser", "playwright") && !matchName(diagnostic.name, "package")) {
      return (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shadow-sm shrink-0"
          disabled={running !== null}
          onClick={() => void handleInstallChromium()}
        >
          {running === "install" ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          Chromiumを導入
        </Button>
      );
    }

    // Note session: "note-session" (getDependencyChecks), "note ログイン" (buildDiagnostics)
    if (matchName(diagnostic.name, "note-session", "note ログイン")) {
      return (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shadow-sm shrink-0"
          disabled={running !== null}
          onClick={() => void handleCaptureSession()}
        >
          {running === "session" ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
          ブラウザでnoteにログイン
        </Button>
      );
    }

    // PinchTab: "pinchtab" (verifyAdapters), "PinchTab" (buildDiagnostics)
    if (matchName(diagnostic.name, "pinchtab")) {
      return (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shadow-sm shrink-0"
          onClick={() => navigate("/settings")}
        >
          <ExternalLink className="h-3 w-3" />
          PinchTab設定へ
        </Button>
      );
    }

    return null;
  };

  return (
    <PageWrapper
      title="環境診断"
      description="依存関係のチェックとログ表示。"
      actions={
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shadow-sm"
          disabled={running !== null}
          onClick={async () => {
            setRunning("diagnostics");
            try {
              await rerunDiagnostics();
              toast.success("環境チェックが完了しました");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "チェックに失敗しました");
            } finally {
              setRunning(null);
            }
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          再チェック
        </Button>
      }
    >
      <div className="card-elevated space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="inline-block h-4 w-1 rounded-full bg-primary" />
          環境チェック
        </h2>
        <div className="space-y-2">
          {diagnostics.map((diagnostic) => (
            <div key={diagnostic.name} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{diagnostic.name}</p>
                <p className="text-xs text-muted-foreground">{diagnostic.detail}</p>
              </div>
              <div className="flex items-center gap-3 ml-3">
                {getInlineAction(diagnostic)}
                <StatusBadge status={diagnostic.status as StatusType} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card-elevated space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="inline-block h-4 w-1 rounded-full bg-primary" />
          AIプロバイダ接続状況
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Object.entries(state.settings.providerSummaries).map(([providerId, provider]) => (
            <div key={providerId} className="rounded-lg border border-border/40 bg-muted/30 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{provider.label}</p>
                <StatusBadge status={(provider.usable ? "completed" : provider.configured ? "pending" : "pending") as StatusType} />
              </div>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p>設定: {provider.configured ? "設定済" : "未設定"}</p>
                <p>接続: {provider.reachable ? "可" : "未確認"}</p>
                <p>利用: {provider.usable ? "利用可能" : "準備中"}</p>
                <p>モデル: {provider.model || providerLabels[providerId as keyof typeof providerLabels]}</p>
                {provider.lastTestError ? <p className="text-destructive">直近エラー: {provider.lastTestError}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card-elevated space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="inline-block h-4 w-1 rounded-full bg-primary" />
          ログ
        </h2>
        <div className="max-h-72 space-y-1 overflow-auto rounded-lg border border-border/40 bg-foreground/[0.03] p-4 font-mono text-xs">
          {logs.map((log, index) => (
            <div key={`${log.time}-${index}`} className="flex gap-3">
              <span className="shrink-0 tabular-nums text-muted-foreground">{log.time}</span>
              <span className={log.level === "error" ? "text-destructive" : "text-foreground"}>
                {log.message}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PageWrapper>
  );
}
