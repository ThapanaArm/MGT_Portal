import { useState } from "react";
import { Link } from "react-router";
import { api, ApiError } from "@/shared/lib/api";
import { useToast } from "@/shared/lib/toast";
import { Btn, EmptyState } from "@/shared/components/ui";
import { Badge, Input, Select } from "@/shared/components/design-system";
import type { AppDetailDto, AppSummaryDto } from "@/shared/lib/types";
import DeploymentSummary from "../apps/DeploymentSummary";
import RequestUpdateDialog from "../apps/RequestUpdateDialog";

type Item = { app: AppSummaryDto; detail: AppDetailDto };
const stageLabel = (stage?: string) => ({ "awaiting-deployment": "Awaiting deployment", deployed: "Awaiting go live", live: "Live", review: "Under review", changes: "Changes requested", development: "In development", suspended: "Suspended" }[stage ?? ""] ?? "Pending");
export default function DeploymentList({ items, onChanged }: { items: Item[]; onChanged: () => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [updateRequest, setUpdateRequest] = useState<Item | null>(null);
  const toast = useToast();
  const roots = items.filter(item => !item.detail.development?.parentApplicationId);
  const updateFor = (item: Item) => items.find(candidate => candidate.app.id === item.detail.development?.pendingUpdateId);
  const actionItem = (item: Item) => updateFor(item) ?? item;
  const shown = roots.filter(item => item.app.name.toLowerCase().includes(query.trim().toLowerCase()) && (filter === "all" || actionItem(item).detail.development?.stage === filter));
  const selected = roots.find(item => item.app.id === selectedId);
  const update = selected ? updateFor(selected) : undefined;
  async function advance(target: Item) {
    if (busyId !== null) return;
    const targetStage = target.detail.development?.stage;
    setBusyId(target.app.id);
    try { await api.put(`/api/applications/${target.app.id}/deployment-status`, { stage: targetStage === "deployed" ? "live" : "deployed", expectedUpdatedAt: target.app.updatedAt }); toast({ tone: "success", message: targetStage === "deployed" ? "Release is live." : "Deployment saved. Ready for go live." }); onChanged(); }
    catch (error) { toast({ tone: "danger", message: error instanceof ApiError ? error.message : "Couldn't update deployment" }); if (error instanceof ApiError && error.status === 409) onChanged(); }
    finally { setBusyId(null); }
  }
  function primaryAction(item: Item) {
    const target = actionItem(item);
    const state = target.detail.development;
    if (target.app.status === "active" && ["awaiting-deployment", "deployed"].includes(state?.stage ?? ""))
      return <Btn size="sm" variant="primary" loading={busyId === target.app.id} disabled={busyId !== null && busyId !== target.app.id} onClick={() => void advance(target)}>{state?.stage === "deployed" ? "Mark as live" : "Mark as deployed"}</Btn>;
    if (updateFor(item) || item.detail.development?.pendingUpdateId)
      return <Link className="release-action-link" to={`/my-apps/${item.detail.development?.pendingUpdateId ?? target.app.id}`}>Open update</Link>;
    if (item.detail.development?.stage === "live")
      return <Btn size="sm" variant="primary" onClick={() => setUpdateRequest(item)}>Request update</Btn>;
    return null;
  }
  return <section className="deployment-workspace"><header className="deployment-list-heading"><h2>Deployment and go live</h2><span>{roots.length} applications</span></header><div className="deployment-list-controls"><Input type="search" aria-label="Search applications" placeholder="Search applications" value={query} onChange={event => setQuery(event.target.value)} /><Select aria-label="Filter deployment status" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All statuses</option><option value="awaiting-deployment">Awaiting deployment</option><option value="deployed">Awaiting go live</option><option value="live">Live</option><option value="review">Update under review</option><option value="changes">Changes requested</option></Select></div>{shown.length ? <div className="deployment-table-scroll"><table className="deployment-table"><thead><tr><th>Application</th><th>Live version</th><th>Update</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{shown.map(item => {
    const state = item.detail.development;
    const candidate = updateFor(item);
    const next = candidate?.detail.development;
    return <tr key={item.app.id} className={selectedId === item.app.id ? "selected" : undefined}><td><Link to={`/my-apps/${item.app.id}`}>{item.app.name}</Link><small>{item.app.ownerEmail}</small></td><td>{state?.stage === "live" ? state.version ?? "Initial release" : "Not live yet"}</td><td>{next ? <>{next.version}<small>{stageLabel(next.stage)}</small></> : state?.stage !== "live" ? <>{state?.version ?? "Initial release"}<small>First deployment</small></> : <span className="text-ink-dim">No pending update</span>}</td><td><Badge tone={state?.stage === "live" ? "success" : "info"}>{stageLabel(state?.stage)}</Badge></td><td><div className="deployment-row-actions">{primaryAction(item)}<Btn size="sm" variant="ghost" onClick={() => setSelectedId(item.app.id)} aria-expanded={selectedId === item.app.id} aria-controls="deployment-selected-details">Details</Btn></div></td></tr>;
  })}</tbody></table></div> : <EmptyState title="No applications found" description="Try another name or deployment status." />}
  {selected && <section id="deployment-selected-details" className="deployment-selected-details" aria-label="Selected deployment details"><header><h3>{selected.app.name}</h3><Btn size="sm" variant="ghost" onClick={() => setSelectedId(null)}>Close details</Btn></header><div className={update ? "deployment-release-comparison" : undefined}><section><h4>{selected.detail.development?.stage === "live" ? "Current live release" : "First deployment"}</h4><DeploymentSummary state={selected.detail.development} /></section>{update && <section><h4>Update in progress · {stageLabel(update.detail.development?.stage)}</h4><DeploymentSummary state={update.detail.development} />{update.detail.development?.changeSummary && <p className="review-note">{update.detail.development.changeSummary}</p>}</section>}</div><footer className="release-card-actions"><Link className="release-action-link" to={`/my-apps/${selected.app.id}`}>Release history</Link>{primaryAction(selected)}</footer></section>}
  {updateRequest && <RequestUpdateDialog appId={updateRequest.app.id} appName={updateRequest.app.name} initialBranch={updateRequest.detail.development?.branch ?? "main"} onClose={() => setUpdateRequest(null)} onSubmitted={() => { setUpdateRequest(null); toast({ tone: "success", message: "Update submitted for review. The current version remains live." }); onChanged(); }} />}
  </section>;
}
