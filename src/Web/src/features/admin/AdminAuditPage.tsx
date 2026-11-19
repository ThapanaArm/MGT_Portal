import { useEffect, useState } from "react";
import { Input, Select } from "@/shared/components/design-system";
import { Btn } from "@/shared/components/ui";
import { api } from "@/shared/lib/api";
import type { UserBriefDto } from "@/shared/lib/types";

interface AuditRow {
  id: number; occurredAt: string; actorUserId: number | null; actor: string; applicationId: number | null; applicationName: string | null;
  entityType: string; entityId: string | null; entityKeyJson: string; eventName: string; action: string; result: string;
  previousStage: string | null; newStage: string | null; changedFieldsJson: string; beforeJson: string | null; afterJson: string | null;
  requestMethod: string | null; requestPath: string | null; correlationId: string | null; statusCode: number | null;
}
interface AuditPage { data: AuditRow[]; total: number; page: number; pageSize: number; }
interface ActorSummary { actorUserId: number | null; actor: string; changes: number; applications: number; createdApplications: number; reviewActions: number; deployments: number; goLives: number; }
interface Summary { total: number; applications: number; actors: number; byActor: ActorSummary[]; byEvent: { eventName: string; result: string; count: number }[]; }
function localDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function pretty(value: string | null) { if (!value) return "No value"; try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; } }
function label(value: string) { return value.replaceAll("_", " ").replaceAll(".", " / "); }

export default function AdminAuditPage() {
  const [filters, setFilters] = useState(() => ({ from: localDate(new Date(Date.now() - 30 * 86400000)), to: localDate(new Date()), applicationId: "", actorUserId: "", eventName: "", result: "" }));
  const [applied, setApplied] = useState(filters);
  const [users, setUsers] = useState<UserBriefDto[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"history" | "summary">("history");
  const [data, setData] = useState<AuditPage | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([api.get<UserBriefDto[]>("/api/access/users"), api.get<string[]>("/api/admin/audit/events")])
      .then(([us, ev]) => { if (active) { setUsers(us); setEvents(ev); } }).catch(() => { /* The main request displays connection errors. */ });
    return () => { active = false; };
  }, [refresh]);
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams();
    const start = new Date(`${applied.from}T00:00:00`);
    const end = new Date(`${applied.to}T00:00:00`); end.setDate(end.getDate() + 1);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) { setError("Choose a valid date range."); setLoading(false); return; }
    query.set("from", start.toISOString()); query.set("to", end.toISOString());
    for (const key of ["applicationId", "actorUserId", "eventName", "result"] as const) if (applied[key]) query.set(key, applied[key]);
    setLoading(true); setError("");
    Promise.all([api.get<AuditPage>(`/api/admin/audit?${query}&page=${page}&pageSize=25`), api.get<Summary>(`/api/admin/audit/summary?${query}`)])
      .then(([rows, totals]) => { if (active) { setData(rows); setSummary(totals); } })
      .catch(cause => { if (active) { setError(cause instanceof Error ? cause.message : "Unable to load audit history"); setData(null); setSummary(null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applied, page, refresh]);
  const patch = (key: keyof typeof filters, value: string) => setFilters(previous => ({ ...previous, [key]: value }));
  const exportSummary = () => {
    if (!summary) return;
    const cell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const safeActor = (value: string) => /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    const csv = [["Person", "Recorded changes", "Apps involved", "Apps created", "Review actions", "Deployments", "Go lives"], ...summary.byActor.map(row => [safeActor(row.actor), row.changes, row.applications, row.createdApplications, row.reviewActions, row.deployments, row.goLives])].map(row => row.map(cell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `work-summary-${applied.from}-${applied.to}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  return <div>
    <header className="portal-page-heading"><h1>Audit & work summary</h1></header>
    <form className="audit-filters" onSubmit={event => { event.preventDefault(); setPage(1); setApplied({ ...filters }); }}>
      <label>From<Input required type="date" value={filters.from} onChange={event => patch("from", event.target.value)} /></label>
      <label>Through<Input required type="date" value={filters.to} onChange={event => patch("to", event.target.value)} /></label>
      <label>Application ID<Input min="1" type="number" placeholder="All apps" value={filters.applicationId} onChange={event => patch("applicationId", event.target.value)} /></label>
      <label>Person<Select value={filters.actorUserId} onChange={event => patch("actorUserId", event.target.value)}><option value="">Everyone, including system</option>{users.map(user => <option key={user.id} value={user.id}>{user.displayName}</option>)}</Select></label>
      <label>Event<Select value={filters.eventName} onChange={event => patch("eventName", event.target.value)}><option value="">All events</option>{events.map(name => <option key={name} value={name}>{label(name)}</option>)}</Select></label>
      <label>Result<Select value={filters.result} onChange={event => patch("result", event.target.value)}><option value="">All results</option>{["Succeeded", "Denied", "Failed", "Pending"].map(value => <option key={value}>{value}</option>)}</Select></label>
      <Btn type="submit" variant="primary">Apply filters</Btn><Btn type="button" onClick={() => setRefresh(value => value + 1)}>Refresh</Btn>
    </form>
    <div className="audit-view-switch" role="group" aria-label="Audit view"><Btn aria-pressed={view === "history"} onClick={() => setView("history")}>Change history</Btn><Btn aria-pressed={view === "summary"} onClick={() => setView("summary")}>Work summary</Btn></div>
    {error && <p role="alert" className="mb-5">{error}</p>}
    {loading ? <p role="status">Loading audit records...</p> : summary && <>
      <div className="audit-metrics"><div><strong>{summary.total}</strong><span>Recorded events</span></div><div><strong>{summary.applications}</strong><span>Apps involved</span></div><div><strong>{summary.actors}</strong><span>People involved</span></div></div>
      {view === "history" && data && <><div className="portal-table-frame"><table className="w-full"><thead><tr>{["When", "Who", "Application", "Event", "Result", "Changes"].map(text => <th key={text}>{text}</th>)}</tr></thead><tbody>{data.data.map(row => <tr key={row.id}>
        <td>{new Date(row.occurredAt.endsWith("Z") ? row.occurredAt : `${row.occurredAt}Z`).toLocaleString()}</td><td>{users.find(user => user.id === row.actorUserId)?.displayName ?? row.actor}<small className="block text-ink-dim">{row.actor}</small></td><td>{row.applicationName ?? "Other data"}{row.applicationId && <small className="block">#{row.applicationId}</small>}</td><td>{label(row.eventName)}{row.newStage && <small className="block">{row.previousStage ?? "New"} → {row.newStage}</small>}</td><td>{row.result}</td>
        <td><details className="audit-details"><summary>View changes</summary><p>{row.entityType} · {row.entityId ?? "Created record"}</p><p>Fields: {pretty(row.changedFieldsJson)}</p><div className="audit-snapshots"><section><strong>Before</strong><pre>{pretty(row.beforeJson)}</pre></section><section><strong>After</strong><pre>{pretty(row.afterJson)}</pre></section></div><small>Record key: {pretty(row.entityKeyJson)}<br />Request: {row.requestMethod} {row.requestPath}<br />Reference: {row.correlationId}</small></details></td>
      </tr>)}{!data.data.length && <tr><td colSpan={6}>No audit records for these filters. History starts when auditing is enabled.</td></tr>}</tbody></table></div><div className="audit-pagination"><Btn disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</Btn><span>Page {page} · {data.total} records</span><Btn disabled={page * data.pageSize >= data.total} onClick={() => setPage(value => value + 1)}>Next</Btn></div></>}
      {view === "summary" && <><div className="permission-table-toolbar"><p className="permission-note">Counts reflect recorded actions, not hours worked or a performance rating. Several changes can belong to one task.</p><Btn onClick={exportSummary} disabled={!summary.byActor.length}>Export summary</Btn></div><div className="portal-table-frame"><table className="w-full"><thead><tr>{["Person", "Changes", "Apps", "Apps created", "Review actions", "Deployments", "Go lives"].map(text => <th key={text}>{text}</th>)}</tr></thead><tbody>{summary.byActor.map((row, index) => <tr key={`${row.actorUserId}-${index}`}><td>{users.find(user => user.id === row.actorUserId)?.displayName ?? row.actor}</td><td>{row.changes}</td><td>{row.applications}</td><td>{row.createdApplications}</td><td>{row.reviewActions}</td><td>{row.deployments}</td><td>{row.goLives}</td></tr>)}{!summary.byActor.length && <tr><td colSpan={7}>No successful activity in this period</td></tr>}</tbody></table></div></>}
    </>}
  </div>;
}
