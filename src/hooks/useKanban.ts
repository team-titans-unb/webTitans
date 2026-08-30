"use client";

import { useCallback, useMemo, useReducer } from "react";

import { SEED_TASKS } from "@/lib/kanban/seed";
import {
  STATUS_ORDER,
  type Subtask,
  type Task,
  type TaskStatus,
} from "@/lib/kanban/types";

/** Campos editáveis por formulário (criar/editar). */
export type TaskDraft = Pick<
  Task,
  "title" | "description" | "status" | "priority" | "dueDate" | "subtasks"
>;

type Action =
  | { type: "add"; draft: TaskDraft }
  | { type: "update"; id: string; draft: TaskDraft }
  | { type: "delete"; id: string }
  | { type: "move"; id: string; status: TaskStatus }
  | { type: "toggleSubtask"; taskId: string; subtaskId: string };

function uid(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}${Date.now()}`;
}

/** Garante ids em subtarefas vindas do formulário. */
function normalizeSubtasks(subtasks: Subtask[]): Subtask[] {
  return subtasks
    .filter((s) => s.description.trim() !== "")
    .map((s) => ({
      id: s.id || uid("sub"),
      description: s.description.trim(),
      done: s.done,
    }));
}

function reducer(state: Task[], action: Action): Task[] {
  switch (action.type) {
    case "add": {
      const task: Task = {
        id: uid("task"),
        createdAt: new Date().toISOString().slice(0, 10),
        ...action.draft,
        subtasks: normalizeSubtasks(action.draft.subtasks),
      };
      return [task, ...state];
    }
    case "update":
      return state.map((t) =>
        t.id === action.id
          ? {
              ...t,
              ...action.draft,
              subtasks: normalizeSubtasks(action.draft.subtasks),
            }
          : t,
      );
    case "delete":
      return state.filter((t) => t.id !== action.id);
    case "move":
      return state.map((t) =>
        t.id === action.id && t.status !== action.status
          ? { ...t, status: action.status }
          : t,
      );
    case "toggleSubtask":
      return state.map((t) =>
        t.id === action.taskId
          ? {
              ...t,
              subtasks: t.subtasks.map((s) =>
                s.id === action.subtaskId ? { ...s, done: !s.done } : s,
              ),
            }
          : t,
      );
    default:
      return state;
  }
}

export function useKanban() {
  const [tasks, dispatch] = useReducer(reducer, SEED_TASKS);

  const addTask = useCallback(
    (draft: TaskDraft) => dispatch({ type: "add", draft }),
    [],
  );
  const updateTask = useCallback(
    (id: string, draft: TaskDraft) => dispatch({ type: "update", id, draft }),
    [],
  );
  const deleteTask = useCallback(
    (id: string) => dispatch({ type: "delete", id }),
    [],
  );
  const moveTask = useCallback(
    (id: string, status: TaskStatus) => dispatch({ type: "move", id, status }),
    [],
  );
  const toggleSubtask = useCallback(
    (taskId: string, subtaskId: string) =>
      dispatch({ type: "toggleSubtask", taskId, subtaskId }),
    [],
  );

  const tasksByStatus = useMemo(() => {
    const grouped = {
      pendente: [] as Task[],
      em_progresso: [] as Task[],
      concluida: [] as Task[],
    } satisfies Record<TaskStatus, Task[]>;
    for (const task of tasks) grouped[task.status].push(task);
    return grouped;
  }, [tasks]);

  const counts = useMemo(
    () =>
      STATUS_ORDER.reduce(
        (acc, status) => {
          acc[status] = tasksByStatus[status].length;
          return acc;
        },
        {} as Record<TaskStatus, number>,
      ),
    [tasksByStatus],
  );

  return {
    tasks,
    tasksByStatus,
    counts,
    addTask,
    updateTask,
    deleteTask,
    moveTask,
    toggleSubtask,
  };
}
