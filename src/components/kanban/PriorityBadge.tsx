import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PRIORITY_META, type TaskPriority } from "@/lib/kanban/types";

export function PriorityBadge({
  priority,
  className,
}: {
  priority: TaskPriority;
  className?: string;
}) {
  const meta = PRIORITY_META[priority];
  return (
    <Badge className={cn(meta.className, className)}>{meta.label}</Badge>
  );
}
