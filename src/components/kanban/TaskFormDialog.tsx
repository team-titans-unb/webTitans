"use client";

import { useEffect, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toISODate } from "@/lib/kanban/format";
import {
  PRIORITY_META,
  PRIORITY_ORDER,
  STATUS_META,
  STATUS_ORDER,
  type Subtask,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/kanban/types";
import type { TaskDraft } from "@/hooks/useKanban";

type SubtaskRow = Subtask & { key: string };

let keySeq = 0;
const newRow = (partial?: Partial<Subtask>): SubtaskRow => ({
  key: `row-${++keySeq}`,
  id: partial?.id ?? "",
  description: partial?.description ?? "",
  done: partial?.done ?? false,
});

function buildRows(task: Task | null): SubtaskRow[] {
  const base = task ? task.subtasks.map((s) => newRow(s)) : [];
  return [...base, newRow()];
}

export function TaskFormDialog({
  open,
  mode,
  task,
  defaultStatus,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  task: Task | null;
  defaultStatus: TaskStatus;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: TaskDraft) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [priority, setPriority] = useState<TaskPriority>(1);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [rows, setRows] = useState<SubtaskRow[]>(buildRows(null));
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setStatus(task?.status ?? defaultStatus);
    setPriority(task?.priority ?? 1);
    setDueDate(task?.dueDate ?? null);
    setRows(buildRows(task ?? null));
    setShowError(false);
  }, [open, task, defaultStatus]);

  function updateRow(key: string, patch: Partial<SubtaskRow>) {
    setRows((prev) => {
      const next = prev.map((r) => (r.key === key ? { ...r, ...patch } : r));
      // Mantém sempre uma linha vazia ao final para adicionar novas.
      if (next.length === 0 || next[next.length - 1].description.trim() !== "") {
        next.push(newRow());
      }
      return next;
    });
  }

  function removeRow(key: string) {
    setRows((prev) => {
      const next = prev.filter((r) => r.key !== key);
      return next.length ? next : [newRow()];
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim() === "") {
      setShowError(true);
      return;
    }
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      dueDate,
      subtasks: rows
        .filter((r) => r.description.trim() !== "")
        .map((r) => ({ id: r.id, description: r.description, done: r.done })),
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Criar nova tarefa" : "Editar tarefa"}
          </DialogTitle>
          <DialogDescription>
            Preencha os detalhes da tarefa da equipe.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Título</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (showError) setShowError(false);
              }}
              placeholder="Entitule a tarefa"
              aria-invalid={showError}
            />
            {showError && (
              <p className="text-xs text-destructive">Informe um título.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Descrição</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva a tarefa"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Subtarefas</Label>
            <div className="space-y-2">
              {rows.map((row) => (
                <div key={row.key} className="flex items-center gap-2">
                  <Checkbox
                    checked={row.done}
                    onCheckedChange={(v) =>
                      updateRow(row.key, { done: v === true })
                    }
                    aria-label="Concluída"
                  />
                  <Input
                    value={row.description}
                    onChange={(e) =>
                      updateRow(row.key, { description: e.target.value })
                    }
                    placeholder="Adicionar subtarefa..."
                    className="h-9"
                  />
                  {row.description.trim() !== "" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground"
                      onClick={() => removeRow(row.key)}
                      aria-label="Remover subtarefa"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Progresso</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as TaskStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select
                value={String(priority)}
                onValueChange={(v) =>
                  setPriority(Number(v) as TaskPriority)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_ORDER.map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      {PRIORITY_META[p].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Data de entrega</Label>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start font-normal",
                      !dueDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {dueDate
                      ? format(parseISO(dueDate), "dd/MM/yyyy")
                      : "Sem prazo"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    locale={ptBR}
                    selected={dueDate ? parseISO(dueDate) : undefined}
                    onSelect={(d) => setDueDate(d ? toISODate(d) : null)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {dueDate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground"
                  onClick={() => setDueDate(null)}
                  aria-label="Limpar data"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit">
              {mode === "create" ? "Criar tarefa" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
