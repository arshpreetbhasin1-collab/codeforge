import { CheckCircle2, XCircle, AlertTriangle, Clock, HardDrive, FileWarning, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VERDICT_LABEL, type Verdict } from "@/lib/judge/verdicts";
import { cn } from "@/lib/utils";

const VERDICT_STYLE: Record<Verdict, { icon: React.ComponentType<{ className?: string }>; className: string }> = {
  queued: { icon: Clock, className: "text-muted-foreground" },
  running: { icon: Clock, className: "text-muted-foreground" },
  accepted: { icon: CheckCircle2, className: "text-brand" },
  wrong_answer: { icon: XCircle, className: "text-destructive" },
  compile_error: { icon: FileWarning, className: "text-destructive" },
  runtime_error: { icon: AlertTriangle, className: "text-destructive" },
  time_limit_exceeded: { icon: Clock, className: "text-amber-600 dark:text-amber-500" },
  memory_limit_exceeded: { icon: HardDrive, className: "text-amber-600 dark:text-amber-500" },
  output_limit_exceeded: { icon: HardDrive, className: "text-amber-600 dark:text-amber-500" },
  system_error: { icon: Ban, className: "text-muted-foreground" },
  cancelled: { icon: Ban, className: "text-muted-foreground" },
};

export function VerdictBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  const { icon: Icon, className: colorClass } = VERDICT_STYLE[verdict];
  return (
    <Badge variant="outline" className={cn("gap-1.5 text-sm font-medium", colorClass, className)}>
      <Icon className="size-4" aria-hidden="true" />
      {VERDICT_LABEL[verdict]}
    </Badge>
  );
}
