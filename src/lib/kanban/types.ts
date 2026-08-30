export type TaskStatus = "pendente" | "em_progresso" | "concluida";

export type TaskPriority = 1 | 2 | 3;

export interface Subtask {
  id: string;
  description: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** Data de entrega em ISO (yyyy-MM-dd) ou null quando sem prazo. */
  dueDate: string | null;
  subtasks: Subtask[];
  createdAt: string;
}

interface StatusMeta {
  label: string;
  /** Classe de cor do marcador/accent da coluna. */
  accent: string;
  dot: string;
}

export const STATUS_ORDER: TaskStatus[] = [
  "pendente",
  "em_progresso",
  "concluida",
];

export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  pendente: {
    label: "A começar",
    accent: "border-t-titans-red",
    dot: "bg-titans-red",
  },
  em_progresso: {
    label: "Em andamento",
    accent: "border-t-titans-gold",
    dot: "bg-titans-gold",
  },
  concluida: {
    label: "Concluído",
    accent: "border-t-emerald-500",
    dot: "bg-emerald-500",
  },
};

interface PriorityMeta {
  label: string;
  /** Classes para o badge — legíveis em light e dark. */
  className: string;
}

export const PRIORITY_ORDER: TaskPriority[] = [1, 2, 3];

export const PRIORITY_META: Record<TaskPriority, PriorityMeta> = {
  1: {
    label: "Baixa prioridade",
    className:
      "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  2: {
    label: "Média prioridade",
    className:
      "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  3: {
    label: "Alta prioridade",
    className:
      "border-transparent bg-destructive/15 text-destructive dark:text-red-300",
  },
};
