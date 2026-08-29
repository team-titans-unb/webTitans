"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useKanban, type TaskDraft } from "@/hooks/useKanban";
import { STATUS_ORDER, type Task, type TaskStatus } from "@/lib/kanban/types";

import { KanbanColumn } from "./KanbanColumn";
import { TaskDetailDialog } from "./TaskDetailDialog";
import { TaskFormDialog } from "./TaskFormDialog";

type DialogState =
  | { kind: "none" }
  | { kind: "create"; status: TaskStatus }
  | { kind: "edit"; id: string }
  | { kind: "view"; id: string };

export function KanbanBoard() {
  const {
    tasks,
    tasksByStatus,
    counts,
    addTask,
    updateTask,
    deleteTask,
    moveTask,
    toggleSubtask,
  } = useKanban();

  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const activeId =
    dialog.kind === "edit" || dialog.kind === "view" ? dialog.id : null;
  const activeTask: Task | null =
    activeId != null ? (tasks.find((t) => t.id === activeId) ?? null) : null;

  function handleSubmit(draft: TaskDraft) {
    if (dialog.kind === "edit") {
      updateTask(dialog.id, draft);
      toast.success("Tarefa atualizada");
    } else {
      addTask(draft);
      toast.success("Tarefa criada");
    }
  }

  function handleDelete() {
    if (!activeTask) return;
    deleteTask(activeTask.id);
    setDialog({ kind: "none" });
    toast.success("Tarefa excluída");
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button
          size="sm"
          onClick={() => setDialog({ kind: "create", status: "pendente" })}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova tarefa
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {STATUS_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            count={counts[status]}
            draggingId={draggingId}
            onNewTask={() => setDialog({ kind: "create", status })}
            onOpenTask={(task) => setDialog({ kind: "view", id: task.id })}
            onDragStartTask={setDraggingId}
            onDragEndTask={() => setDraggingId(null)}
            onDropTask={(id, next) => {
              moveTask(id, next);
              setDraggingId(null);
            }}
          />
        ))}
      </div>

      <TaskFormDialog
        open={dialog.kind === "create" || dialog.kind === "edit"}
        mode={dialog.kind === "edit" ? "edit" : "create"}
        task={dialog.kind === "edit" ? activeTask : null}
        defaultStatus={dialog.kind === "create" ? dialog.status : "pendente"}
        onOpenChange={(open) => {
          if (!open) setDialog({ kind: "none" });
        }}
        onSubmit={handleSubmit}
      />

      <TaskDetailDialog
        task={dialog.kind === "view" ? activeTask : null}
        open={dialog.kind === "view"}
        onOpenChange={(open) => {
          if (!open) setDialog({ kind: "none" });
        }}
        onEdit={() =>
          activeTask && setDialog({ kind: "edit", id: activeTask.id })
        }
        onDelete={handleDelete}
        onToggleSubtask={(subtaskId) =>
          activeTask && toggleSubtask(activeTask.id, subtaskId)
        }
      />
    </div>
  );
}
