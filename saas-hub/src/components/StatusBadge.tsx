import { cn } from "@/lib/utils";

export type StatusType = "generating" | "completed" | "error" | "saved" | "published" | "pending" | "running";

const statusConfig: Record<StatusType, { label: string; className: string; dot: string }> = {
  generating: { label: "生成中", className: "status-badge-running", dot: "bg-primary animate-pulse" },
  completed: { label: "完了", className: "status-badge-success", dot: "bg-success" },
  error: { label: "エラー", className: "status-badge-error", dot: "bg-destructive" },
  saved: { label: "保存済み", className: "status-badge bg-primary/10 text-primary", dot: "bg-primary" },
  published: { label: "公開済み", className: "status-badge-success", dot: "bg-success" },
  pending: { label: "待機中", className: "status-badge-pending", dot: "bg-muted-foreground" },
  running: { label: "実行中", className: "status-badge-running", dot: "bg-primary animate-pulse" },
};

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span className={cn(config.className, className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
      {label ?? config.label}
    </span>
  );
}
