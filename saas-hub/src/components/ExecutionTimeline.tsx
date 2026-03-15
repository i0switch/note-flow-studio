import { cn } from "@/lib/utils";

interface TimelineItem {
  label: string;
  time: string;
  status?: "success" | "error" | "info";
  detail?: string;
}

interface ExecutionTimelineProps {
  items: TimelineItem[];
}

const statusColors = {
  success: "bg-success",
  error: "bg-destructive",
  info: "bg-primary",
};

export function ExecutionTimeline({ items }: ExecutionTimelineProps) {
  return (
    <div className="relative space-y-0">
      {items.map((item, i) => (
        <div key={i} className="flex gap-3 pb-6 last:pb-0">
          {/* Line + dot */}
          <div className="flex flex-col items-center">
            <div className={cn("w-2.5 h-2.5 rounded-full mt-1 shrink-0", statusColors[item.status ?? "info"])} />
            {i < items.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
          </div>
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium">{item.label}</p>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">{item.time}</span>
            </div>
            {item.detail && <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
