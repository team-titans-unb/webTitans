"use client";

import { CalendarDays, Pencil, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatDueDate, isDueToday, isOverdue } from "@/lib/kanban/format";
import { STATUS_META, type Task } from "@/lib/kanban/types";

import { PriorityBadge } from "./PriorityBadge";

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onToggleSubtask,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleSubtask: (subtaskId: string) => void;
}) {
  if (!task) return null;

  const done = task.subtasks.filter((s) => s.done).length;
  const total = task.subtasks.length;
  const danger =
    task.status !== "concluida" &&
    (isDueToday(task.dueDate) || isOverdue(task.dueDate));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={task.priority} />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  STATUS_META[task.status].dot,
                )}
              />
              {STATUS_META[task.status].label}
            </span>
          </div>
          <DialogTitle className="pt-1 text-left">{task.title}</DialogTitle>
        </DialogHeader>

        {task.description && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {task.description}
          </p>
        )}

        {total > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">
              Subtarefas{" "}
              <span className="font-normal text-muted-foreground">
                ({done}/{total})
              </span>
            </h3>
            <ul className="space-y-1.5">
              {task.subtasks.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={s.done}
                      onCheckedChange={() => onToggleSubtask(s.id)}
                    />
                    <span
                      className={cn(
                        s.done && "text-muted-foreground line-through",
                      )}
                    >
                      {s.description}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold">Entrega:</span>
          <span
            className={cn(
              "inline-flex items-center gap-1",
              danger ? "text-destructive" : "text-muted-foreground",
            )}
          >
            <CalendarDays className="h-4 w-4" />
            {formatDueDate(task.dueDate)}
          </span>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. A tarefa &ldquo;{task.title}
                  &rdquo; será removida do quadro.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={onDelete}
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar tarefa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
