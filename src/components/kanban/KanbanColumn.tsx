"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STATUS_META, type Task, type TaskStatus } from "@/lib/kanban/types";

import { TaskCard } from "./TaskCard";

export function KanbanColumn({
  status,
  tasks,
  count,
  draggingId,
  onNewTask,
  onOpenTask,
  onDragStartTask,
  onDragEndTask,
  onDropTask,
}: {
  status: TaskStatus;
  tasks: Task[];
  count: number;
  draggingId: string | null;
  onNewTask: () => void;
  onOpenTask: (task: Task) => void;
  onDragStartTask: (id: string) => void;
  onDragEndTask: () => void;
  onDropTask: (id: string, status: TaskStatus) => void;
}) {
  const meta = STATUS_META[status];
  const [isOver, setIsOver] = useState(false);

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!isOver) setIsOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDropTask(id, status);
      }}
      className={cn(
        "flex min-h-[12rem] flex-col rounded-xl border border-t-4 bg-muted/30 transition-colors",
        meta.accent,
        isOver && "bg-titans-orange/10 ring-2 ring-titans-orange/40",
      )}
    >
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} />
          <h2 className="text-sm font-semibold">{meta.label}</h2>
          <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {count}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onNewTask}
          aria-label={`Nova tarefa em ${meta.label}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3 md:max-h-[calc(100vh-16rem)]">
        {tasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground">
            Nenhuma tarefa
          </p>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              dragging={draggingId === task.id}
              onOpen={() => onOpenTask(task)}
              onDragStart={() => onDragStartTask(task.id)}
              onDragEnd={onDragEndTask}
            />
          ))
        )}
      </div>
    </section>
  );
}
