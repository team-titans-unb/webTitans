"use client";

import { CalendarDays, CheckCircle2, GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDueDate, isDueToday, isOverdue } from "@/lib/kanban/format";
import type { Task } from "@/lib/kanban/types";

import { PriorityBadge } from "./PriorityBadge";

export function TaskCard({
  task,
  onOpen,
  onDragStart,
  onDragEnd,
  dragging,
}: {
  task: Task;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  dragging: boolean;
}) {
  const done = task.subtasks.filter((s) => s.done).length;
  const total = task.subtasks.length;
  const due = formatDueDate(task.dueDate);
  const danger =
    task.status !== "concluida" &&
    (isDueToday(task.dueDate) || isOverdue(task.dueDate));

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Abrir tarefa: ${task.title}`}
      className={cn(
        "group cursor-pointer rounded-xl border border-border bg-card p-4 text-left shadow-sm transition",
        "hover:border-titans-orange/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        dragging && "opacity-40",
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <PriorityBadge priority={task.priority} />
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />
      </div>

      <h3 className="text-sm font-semibold leading-snug text-card-foreground">
        {task.title}
      </h3>
      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {task.description}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-1 font-medium",
            danger ? "text-destructive" : "text-muted-foreground",
          )}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          {due}
        </span>
        {total > 0 && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-muted-foreground",
              done === total && "text-emerald-600 dark:text-emerald-400",
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {done}/{total}
          </span>
        )}
      </div>
    </article>
  );
}
