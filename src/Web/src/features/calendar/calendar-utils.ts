import type { CalendarEventDto, CalendarKind } from "@/shared/lib/types";

export const KIND_LABEL: Record<CalendarKind, string> = { available: "IT available", deploy: "Deploy", meeting: "Meeting", freeze: "Freeze" };
export const isBooking = (kind: CalendarKind) => kind === "deploy" || kind === "meeting";
export const isActive = (event: CalendarEventDto) => event.status === "requested" || event.status === "confirmed";

const pad = (value: number) => String(value).padStart(2, "0");
/** Local date key, e.g. 2026-11-25. */
export const dayKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
/** Value for <input type="datetime-local"> in local time. */
export const toLocalInput = (date: Date) => `${dayKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
export const fromLocalInput = (value: string) => new Date(value).toISOString();

export const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
export const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
/** Monday-first 6-week grid that contains the month. */
export function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export const timeText = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
export const dateText = (iso: string | Date) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
/** "10:00–11:00", or with dates when the entry spans several days. */
export function rangeText(event: CalendarEventDto) {
  const start = new Date(event.startAt), end = new Date(event.endAt);
  const sameDay = dayKey(start) === dayKey(new Date(end.getTime() - 1));
  return sameDay ? `${timeText(event.startAt)}–${timeText(event.endAt)}` : `${dateText(start)} ${timeText(event.startAt)} – ${dateText(end)} ${timeText(event.endAt)}`;
}
/** Entries that touch this local day. */
export const onDay = (events: CalendarEventDto[], day: Date) => {
  const from = startOfDay(day).getTime(), to = addDays(day, 1).getTime();
  return events.filter(event => new Date(event.startAt).getTime() < to && from < new Date(event.endAt).getTime());
};
