import { differenceInCalendarDays, format, parseISO } from "date-fns";

/** Converte um Date para a string ISO de data (yyyy-MM-dd), sem fuso. */
export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** "HOJE" | "dd/MM/yyyy" | "Sem prazo" */
export function formatDueDate(iso: string | null): string {
  if (!iso) return "Sem prazo";
  const date = parseISO(iso);
  const diff = differenceInCalendarDays(date, new Date());
  if (diff === 0) return "HOJE";
  return format(date, "dd/MM/yyyy");
}

/** true quando a data já passou (ontem ou antes). */
export function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  return differenceInCalendarDays(parseISO(iso), new Date()) < 0;
}

/** true quando a entrega é hoje. */
export function isDueToday(iso: string | null): boolean {
  if (!iso) return false;
  return differenceInCalendarDays(parseISO(iso), new Date()) === 0;
}
