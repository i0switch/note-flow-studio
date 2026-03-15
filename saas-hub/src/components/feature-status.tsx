import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type FeatureStatus = "real" | "local" | "planned";

const statusLabel: Record<FeatureStatus, string> = {
  real: "利用可能",
  local: "保存連動",
  planned: "補助表示",
};

const statusClassName: Record<FeatureStatus, string> = {
  real: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  local: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  planned: "border-slate-400/30 bg-slate-500/10 text-slate-700",
};

export function FeatureStatusBadge({
  status,
  label,
  className,
}: {
  status: FeatureStatus;
  label?: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("border text-[11px] font-semibold", statusClassName[status], className)}
    >
      {label ?? statusLabel[status]}
    </Badge>
  );
}

export function FeatureNotice({
  status,
  title,
  children,
  className,
}: {
  status: FeatureStatus;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3",
        status === "real" && "border-emerald-500/20 bg-emerald-500/5",
        status === "local" && "border-amber-500/20 bg-amber-500/5",
        status === "planned" && "border-slate-400/20 bg-slate-500/5",
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <FeatureStatusBadge status={status} />
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      <div className="text-xs leading-6 text-muted-foreground">{children}</div>
    </div>
  );
}
