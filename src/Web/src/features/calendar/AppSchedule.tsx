import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api } from "@/shared/lib/api";
import { Badge } from "@/shared/components/design-system";
import { AppIcon } from "@/shared/components/Icon";
import type { CalendarEventDto } from "@/shared/lib/types";
import { KIND_LABEL, addDays, dateText, rangeText } from "./calendar-utils";
import "./calendar.css";

const STATUS = { requested: ["Waiting for IT", "warning"], confirmed: ["Confirmed", "success"], declined: ["Declined", "danger"], cancelled: ["Cancelled", "neutral"] } as const;

/** Upcoming IT calendar entries for one application (deploy dates and meetings), with a link to book IT time. */
export default function AppSchedule({ appId, canBook }: { appId: number; canBook: boolean }) {
  const [events, setEvents] = useState<CalendarEventDto[]>([]);
  useEffect(() => {
    const from = addDays(new Date(), -1), to = addDays(new Date(), 119);
    api.get<CalendarEventDto[]>(`/api/calendar?applicationId=${appId}&from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`)
      .then(setEvents).catch(() => setEvents([]));
  }, [appId]);
  if (!events.length && !canBook) return null;
  return <section className="portal-panel app-schedule">
    <header><h3><AppIcon value="fa:calendar" /> IT schedule</h3>{canBook && <Link to="/calendar" className="portal-button portal-button-sm">Book IT time</Link>}</header>
    {events.length ? <ul>{events.map(event => <li key={event.id}>
      <strong>{KIND_LABEL[event.kind]}</strong>
      <span>{dateText(event.startAt)} · {rangeText(event)}</span>
      <Badge tone={STATUS[event.status][1]}>{STATUS[event.status][0]}</Badge>
    </li>)}</ul> : <p className="rv-muted">No deployment date or meeting booked yet.</p>}
  </section>;
}
