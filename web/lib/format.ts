import { format, parseISO, isValid } from "date-fns";

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const d = parseISO(value);
    if (!isValid(d)) return value;
    return format(d, "MMM d, yyyy h:mm a");
  } catch {
    return value;
  }
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const d = parseISO(value);
    if (!isValid(d)) return value;
    return format(d, "MMM d, yyyy");
  } catch {
    return value;
  }
}
