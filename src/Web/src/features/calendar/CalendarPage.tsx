import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { api, ApiError } from "@/shared/lib/api";
import { useAuth } from "@/shared/lib/auth";
import { useToast } from "@/shared/lib/toast";
import { Btn, EmptyState } from "@/shared/components/ui";
import { Badge, Dialog, Field, Input, Select, Skeleton, Textarea } from "@/shared/components/design-system";
import { Alert } from "@/shared/components/feedback";
import { AppIcon } from "@/shared/components/Icon";
import type { AppSummaryDto, CalendarEventDto, CalendarKind } from "@/shared/lib/types";
import { KIND_LABEL, addDays, dateText, dayKey, fromLocalInput, isActive, isBooking, monthGrid, onDay, rangeText, startOfDay, timeText, toLocalInput } from "./calendar-utils";
import "./calendar.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STATUS_LABEL = { requested: "Waiting for IT", confirmed: "Confirmed", declined: "Declined", cancelled: "Cancelled" } as const;
const STATUS_TONE = { requested: "warning", confirmed: "success", declined: "danger", cancelled: "neutral" } as const;

type EntryForm = { id?: number; kind: CalendarKind; title: string; start: string; end: string; applicationId: string; note: string };

/**
 * IT calendar: IT opens available slots, schedules deployments and meetings, and marks freezes.
 * Users book a deployment or meeting inside an available slot; IT confirms or declines (CalendarService).
 */
export default function CalendarPage() {
  const { user } = useAuth();
  const isAdmin = user?.roleKey === "admin";
  const toast = useToast();
  const [month, setMonth] = useState(() => startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [events, setEvents] = useState<CalendarEventDto[]>([]);
  const [apps, setApps] = useState<AppSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState<EntryForm | null>(null);
  const [booking, setBooking] = useState(false);
  const [decline, setDecline] = useState<CalendarEventDto | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const grid = useMemo(() => monthGrid(month), [month]);
  useEffect(() => {
    let active = true;
    const from = grid[0], to = addDays(grid[grid.length - 1], 1);
    api.get<CalendarEventDto[]>(`/api/calendar?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`)
      .then(list => { if (active) { setEvents(list); setError(""); } })
      .catch(() => { if (active) setError("Couldn't load the calendar"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [grid, attempt]);
  useEffect(() => { api.get<AppSummaryDto[]>("/api/applications").then(setApps).catch(() => setApps([])); }, []);
  const reload = () => setAttempt(value => value + 1);

  const myApps = apps.filter(app => app.ownerEmail.toLowerCase() === user?.email.toLowerCase());
  const formApps = isAdmin ? apps : myApps;
  const dayEvents = onDay(events, selected).sort((a, b) => a.startAt.localeCompare(b.startAt));
  const today = dayKey(new Date());

  function openBooking(start?: Date, end?: Date) {
    const from = start ?? new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), 9);
    setForm({ kind: "meeting", title: "", start: toLocalInput(from), end: toLocalInput(end ?? new Date(from.getTime() + 3_600_000)), applicationId: "", note: "" });
    setBooking(!isAdmin);
  }
  function openEntry(event?: CalendarEventDto) {
    if (event) {
      setForm({ id: event.id, kind: event.kind, title: event.title, start: toLocalInput(new Date(event.startAt)), end: toLocalInput(new Date(event.endAt)), applicationId: event.applicationId ? String(event.applicationId) : "", note: event.note ?? "" });
    } else {
      const from = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), 9);
      setForm({ kind: "available", title: "", start: toLocalInput(from), end: toLocalInput(new Date(from.getTime() + 3 * 3_600_000)), applicationId: "", note: "" });
    }
    setBooking(false);
  }

  async function run(work: () => Promise<unknown>, done: string) {
    setBusy(true);
    try { await work(); toast({ tone: "success", message: done }); reload(); return true; }
    catch (err) { toast({ tone: "danger", message: err instanceof ApiError ? err.message : "Couldn't update the calendar" }); return false; }
    finally { setBusy(false); }
  }

  async function saveForm(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    const body = { kind: form.kind, startAt: fromLocalInput(form.start), endAt: fromLocalInput(form.end), title: form.title || null, note: form.note || null, applicationId: form.applicationId ? Number(form.applicationId) : null };
    const ok = await run(() => booking ? api.post("/api/calendar/bookings", body) : form.id ? api.put(`/api/calendar/events/${form.id}`, body) : api.post("/api/calendar/events", body),
      booking ? "Booking sent to IT" : form.id ? "Entry updated" : "Entry added");
    if (ok) setForm(null);
  }

  async function submitDecline(event: React.FormEvent) {
    event.preventDefault();
    if (!decline) return;
    if (await run(() => api.post(`/api/calendar/events/${decline.id}/decision`, { confirm: false, note }), "Booking declined")) setDecline(null);
  }

  const chipClass = (event: CalendarEventDto) => `cal-chip is-${event.kind} is-${event.status}`;

  return <div className="calendar-page">
    <header className="portal-page-heading calendar-heading">
      <h1>IT Calendar</h1>
      <div className="calendar-heading-actions">
        {isAdmin ? <Btn variant="primary" startIcon={<AppIcon value="fa:plus" />} onClick={() => openEntry()}>Add entry</Btn>
          : <Btn variant="primary" startIcon={<AppIcon value="fa:calendar" />} onClick={() => openBooking()}>Book IT time</Btn>}
      </div>
    </header>

    <div className="calendar-layout">
      <section className="portal-panel calendar-month" aria-label="Month">
        <div className="calendar-toolbar">
          <div className="calendar-nav">
            <Btn size="sm" variant="ghost" iconOnly aria-label="Previous month" onClick={() => setMonth(value => new Date(value.getFullYear(), value.getMonth() - 1, 1))}><AppIcon value="fa:arrow-left" /></Btn>
            <h2>{month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h2>
            <Btn size="sm" variant="ghost" iconOnly aria-label="Next month" onClick={() => setMonth(value => new Date(value.getFullYear(), value.getMonth() + 1, 1))}><AppIcon value="fa:arrow-right" /></Btn>
          </div>
          <Btn size="sm" onClick={() => { const now = startOfDay(new Date()); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelected(now); }}>Today</Btn>
          <ul className="calendar-legend" aria-label="Legend">{(Object.keys(KIND_LABEL) as CalendarKind[]).map(kind => <li key={kind}><span className={`cal-dot is-${kind}`} />{KIND_LABEL[kind]}</li>)}</ul>
        </div>
        {loading ? <Skeleton rows={6} /> : error ? <Alert tone="danger" title={error}><Btn onClick={() => { setLoading(true); reload(); }}>Try again</Btn></Alert> : <div className="calendar-grid" role="grid">
          {WEEKDAYS.map(day => <div key={day} className="calendar-weekday" role="columnheader">{day}</div>)}
          {grid.map(day => {
            const key = dayKey(day), list = onDay(events, day).filter(event => isActive(event) || event.mine || isAdmin);
            const outside = day.getMonth() !== month.getMonth();
            return <button key={key} type="button" role="gridcell" aria-selected={key === dayKey(selected)} aria-label={`${dateText(day)}, ${list.length} entries`}
              className={`calendar-day${outside ? " is-outside" : ""}${key === today ? " is-today" : ""}${key === dayKey(selected) ? " is-selected" : ""}`} onClick={() => setSelected(day)}>
              <span className="calendar-day-number">{day.getDate()}</span>
              <span className="calendar-day-events">
                {list.slice(0, 3).map(event => <span key={event.id} className={chipClass(event)}>{event.kind === "freeze" ? event.title : `${dayKey(new Date(event.startAt)) === key ? timeText(event.startAt) + " " : ""}${event.kind === "available" ? "Available" : event.title}`}</span>)}
                {list.length > 3 && <span className="cal-more">+{list.length - 3} more</span>}
              </span>
            </button>;
          })}
        </div>}
      </section>

      <aside className="portal-panel calendar-agenda" aria-label={`Entries on ${dateText(selected)}`}>
        <h2>{dateText(selected)}</h2>
        {!dayEvents.length ? <EmptyState title="Nothing scheduled" description={isAdmin ? "Add an available slot so people can book IT time." : "IT has no available time on this day."} />
          : <ul className="calendar-agenda-list">{dayEvents.map(event => <li key={event.id} className={`cal-entry is-${event.kind} is-${event.status}`}>
            <div className="cal-entry-head">
              <span className={`cal-dot is-${event.kind}`} />
              <strong>{event.kind === "available" ? "IT available" : event.title}</strong>
              {isBooking(event.kind) && !event.private && <Badge tone={STATUS_TONE[event.status]}>{STATUS_LABEL[event.status]}</Badge>}
            </div>
            <span className="cal-entry-time">{rangeText(event)}</span>
            {event.applicationId && <Link className="cal-entry-link" to={`/my-apps/${event.applicationId}`}>{event.applicationName}</Link>}
            {isAdmin && event.requestedByEmail && <span className="cal-entry-meta">Requested by {event.requestedByName || event.requestedByEmail}</span>}
            {event.note && <p className="cal-entry-note">{event.note}</p>}
            {event.decisionNote && <p className="cal-entry-note is-decision">{event.status === "declined" ? "Reason: " : "IT: "}{event.decisionNote}</p>}
            <div className="cal-entry-actions">
              {event.kind === "available" && !isAdmin && new Date(event.endAt) > new Date() && <Btn size="sm" variant="primary" onClick={() => openBooking(new Date(Math.max(new Date(event.startAt).getTime(), Date.now())), new Date(event.endAt))}>Book</Btn>}
              {isAdmin && event.status === "requested" && <>
                <Btn size="sm" variant="primary" disabled={busy} onClick={() => void run(() => api.post(`/api/calendar/events/${event.id}/decision`, { confirm: true }), "Booking confirmed")}>Confirm</Btn>
                <Btn size="sm" disabled={busy} onClick={() => { setNote(""); setDecline(event); }}>Decline</Btn>
              </>}
              {isBooking(event.kind) && isActive(event) && (event.mine || isAdmin) && <Btn size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => api.post(`/api/calendar/events/${event.id}/cancel`, {}), "Booking cancelled")}>Cancel booking</Btn>}
              {isAdmin && isActive(event) && <Btn size="sm" variant="ghost" disabled={busy} onClick={() => openEntry(event)}>Edit</Btn>}
              {isAdmin && !isBooking(event.kind) && <Btn size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => api.del(`/api/calendar/events/${event.id}`), "Entry deleted")}>Delete</Btn>}
            </div>
          </li>)}</ul>}
      </aside>
    </div>

    <Dialog open={!!form} title={booking ? "Book IT time" : form?.id ? "Edit entry" : "Add entry"} onClose={() => { if (!busy) setForm(null); }}>
      {form && <form className="calendar-form" onSubmit={saveForm}>
        {booking ? <Field>Purpose<Select value={form.kind} onChange={event => setForm({ ...form, kind: event.target.value as CalendarKind, applicationId: "" })}><option value="meeting">Meeting with IT</option><option value="deploy">Deploy my application</option></Select></Field>
          : <Field>Type<Select value={form.kind} disabled={!!form.id && isBooking(form.kind)} onChange={event => setForm({ ...form, kind: event.target.value as CalendarKind })}>{(Object.keys(KIND_LABEL) as CalendarKind[]).filter(kind => !form.id || isBooking(kind) === isBooking(form.kind)).map(kind => <option key={kind} value={kind}>{KIND_LABEL[kind]}</option>)}</Select></Field>}
        {!booking && form.kind !== "available" && <Field>Title (optional)<Input maxLength={200} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder={form.kind === "freeze" ? "e.g. Month-end close" : "Filled from the type and application"} /></Field>}
        {isBooking(form.kind) && <Field>Application{form.kind === "deploy" ? "" : " (optional)"}<Select required={form.kind === "deploy"} value={form.applicationId} onChange={event => setForm({ ...form, applicationId: event.target.value })}>
          <option value="">{form.kind === "deploy" ? "Choose an application" : "None"}</option>
          {formApps.filter(app => form.kind !== "deploy" || app.status === "active").map(app => <option key={app.id} value={app.id}>{app.name}</option>)}
        </Select></Field>}
        <div className="calendar-form-times">
          <Field>Start<Input type="datetime-local" required value={form.start} onChange={event => setForm({ ...form, start: event.target.value })} /></Field>
          <Field>End<Input type="datetime-local" required min={form.start} value={form.end} onChange={event => setForm({ ...form, end: event.target.value })} /></Field>
        </div>
        <Field>Note (optional)<Textarea rows={3} maxLength={2000} value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} placeholder={booking ? "What would you like to cover?" : undefined} /></Field>
        <div className="example-form-footer mt-6"><Btn type="button" disabled={busy} onClick={() => setForm(null)}>Cancel</Btn><Btn type="submit" variant="primary" loading={busy}>{booking ? "Send booking" : "Save"}</Btn></div>
      </form>}
    </Dialog>

    <Dialog open={!!decline} title="Decline booking" onClose={() => { if (!busy) setDecline(null); }}>
      <form className="calendar-form" onSubmit={submitDecline}>
        <Field>Reason (required)<Textarea required rows={3} value={note} onChange={event => setNote(event.target.value)} placeholder="The requester sees this reason." /></Field>
        <div className="example-form-footer mt-6"><Btn type="button" disabled={busy} onClick={() => setDecline(null)}>Cancel</Btn><Btn type="submit" variant="primary" loading={busy} disabled={!note.trim()}>Decline</Btn></div>
      </form>
    </Dialog>
  </div>;
}
