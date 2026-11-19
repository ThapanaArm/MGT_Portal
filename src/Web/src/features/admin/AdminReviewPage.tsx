import { Link, useSearchParams } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/shared/lib/api";
import { useAuth } from "@/shared/lib/auth";
import { useToast } from "@/shared/lib/toast";
import { Btn, EmptyState } from "@/shared/components/ui";
import { Badge, Dialog, Field, Input, Select, Skeleton, Textarea } from "@/shared/components/design-system";
import { Alert } from "@/shared/components/feedback";
import { AppAvatar } from "@/shared/components/MediaPickers";
import { AppIcon } from "@/shared/components/Icon";
import ReviewLinks from "@/shared/components/ReviewLinks";
import { AUDIENCE_LABEL, tierText } from "@/shared/lib/tiers";
import type { AppDetailDto, AppSummaryDto, CategoryDto, ReviewerDto } from "@/shared/lib/types";
import DeploymentList from "./DeploymentList";
import { COMMITTEE_SIZE } from "./CommitteeSettings";

type Item = { app: AppSummaryDto; detail: AppDetailDto };
type Tab = "mine" | "waiting" | "all" | "rejected";
type Me = { id?: number; email?: string; isAdmin: boolean };

const initials = (name: string) => {
  const parts = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? "?").slice(0, 2)).toUpperCase();
};
const ago = (iso: string) => new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000)), "day");

/** Everything the queue needs to know about one request, from the signed-in user's point of view. */
function reviewState({ detail }: Item, me: Me) {
  const reviewers = detail.reviewers ?? [];
  // Every request uses the one committee (5 people, or 4 when the requester is a member).
  // Register needs 3 approvals; Verify / Official need every member.
  const seats = detail.committeeSize || COMMITTEE_SIZE;
  const required = detail.requiredVotes || seats;
  const decided = (userId: number) => detail.votes.find(vote => vote.reviewerUserId === userId && vote.actorEmail && vote.decidedAt);
  const approved = reviewers.filter(member => decided(member.userId)?.approved).length;
  const rejected = reviewers.filter(member => decided(member.userId)?.rejected).length;
  const mine = reviewers.find(member => member.userId === me.id);
  const myVote = mine ? decided(mine.userId) : undefined;
  const myApproved = !!myVote?.approved;
  const myRejected = !!myVote?.rejected;
  const seatsMissing = reviewers.length < seats;
  const needsCodeReview = detail.requiresCodeReview;
  const itPassed = !needsCodeReview || !!detail.codeReview?.approved;
  const myTurn = !!mine && !myApproved && !myRejected;
  const needsMe = myTurn || (me.isAdmin && (seatsMissing || (needsCodeReview && !detail.codeReview)));
  const parts: string[] = [];
  if (seatsMissing) parts.push(me.isAdmin ? "Set up the committee" : "Waiting for IT");
  else if (myTurn) parts.push(approved + 1 < required ? `Your approval + ${required - approved - 1} more` : "Your approval");
  else if (approved < required) parts.push(`${required - approved} approval${required - approved > 1 ? "s" : ""} left`);
  if (rejected > 0) parts.push(`${rejected} rejected`);
  if (!itPassed) parts.push(me.isAdmin && !detail.codeReview ? "IT review" : "IT review pending");
  return { reviewers, seats, required, decided, approved, rejected, mine, myApproved, myRejected, seatsMissing, needsCodeReview, itPassed, needsMe, status: parts.length ? parts.join(" · ") : "Ready" };
}

function Avatars({ reviewers, required, decided }: { reviewers: ReviewerDto[]; required: number; decided: (userId: number) => { approved: boolean; rejected?: boolean } | undefined }) {
  return <span className="rv-avatars">{Array.from({ length: required }, (_, index) => {
    const member = reviewers[index];
    if (!member) return <span key={index} className="rv-avatar empty" title="Empty seat">+</span>;
    const vote = decided(member.userId);
    return <span key={member.userId} className={`rv-avatar ${vote ? vote.approved ? "ok" : "no" : ""}`} title={`${member.name} · ${vote ? vote.approved ? "Approved" : vote.rejected ? "Rejected" : "Changes requested" : "Waiting"}`}>{initials(member.name)}</span>;
  })}</span>;
}

function ReviewRow({ item, me, categories, onChanged }: { item: Item; me: Me; categories: CategoryDto[]; onChanged: () => void }) {
  const { app, detail } = item;
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<"approve" | "changes" | "reject" | "it-pass" | "it-fail" | "it-withdraw" | null>(null);
  const [note, setNote] = useState("");
  const [resolvedCycles, setResolvedCycles] = useState<number[]>([]);
  const outstandingChanges = (detail.changeRequests ?? []).filter(change => change.source === "it" && change.resolvedInCycle == null);
  const [links, setLinks] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);
  const s = reviewState(item, me);
  const tier = detail.development?.targetTier ?? app.reviewTarget ?? app.type;
  const isCodeReview = action === "it-pass" || action === "it-fail";
  const needsNote = action === "changes" || action === "reject" || action === "it-fail";
  const title = { approve: "Approve", changes: "Request changes", reject: "Reject request", "it-pass": "Pass IT review", "it-fail": "Request code changes", "it-withdraw": "Withdraw IT review" }[action ?? "approve"];
  const products = app.products.map(key => categories.find(category => category.key === key)?.name ?? key).join(", ");

  function begin(next: typeof action) { setResolvedCycles([]); setNote(""); setLinks([""]); setAction(next); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (needsNote && !note.trim()) return;
    setBusy(true);
    try {
      if (action === "it-withdraw") await api.del(`/api/applications/${app.id}/code-review`);
      else await api.post(`/api/applications/${app.id}/${isCodeReview ? "code-review" : "vote"}`, isCodeReview
        ? { approved: action === "it-pass", note: note.trim() || null, links: links.map(link => link.trim()).filter(Boolean), resolvedCycles: action === "it-pass" ? resolvedCycles : [], resolveOnly: action === "it-pass" && resolvedCycles.length < outstandingChanges.length }
        : { approved: action === "approve", note: note.trim() || null, reject: action === "reject" });
      toast({ tone: "success", message: action === "it-withdraw" ? "IT review withdrawn" : "Decision saved" }); setAction(null); onChanged();
    } catch (error) { toast({ tone: "danger", message: error instanceof ApiError ? error.message : "Couldn't save the decision" }); }
    finally { setBusy(false); }
  }

  return <article className={`portal-panel rv-card ${open ? "open" : ""}`}>
    <div className="rv-row">
      <button type="button" className="rv-main" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <AppAvatar image={app.image} icon={app.icon} />
        <span className="rv-title"><strong>{app.name}</strong><small>{tierText(tier)} · {ago(app.updatedAt)}</small></span>
      </button>
      <Avatars reviewers={s.reviewers} required={s.seats} decided={s.decided} />
      {s.needsCodeReview ? <span className={`rv-it ${s.itPassed ? "ok" : detail.codeReview ? "no" : ""}`} title="IT review"><AppIcon value={s.itPassed ? "fa:check" : "fa:code"} /> IT</span> : <span className="rv-it" title="No IT code review for Register" aria-hidden="true" />}
      <span className={`rv-status ${s.needsMe ? "attention" : ""}`}>{s.status}</span>
      <Btn size="sm" variant={s.needsMe && !open ? "primary" : "ghost"} onClick={() => { if (open || s.seatsMissing || !s.needsMe) setOpen(value => !value); else begin(s.mine && !s.myApproved ? "approve" : "it-pass"); }}>{open ? "Close details" : s.needsMe ? "Review decision" : "Details"}</Btn>
    </div>
    {open && <div className="rv-body">
      <section className="rv-box">
        <header><h3>Committee</h3><span className="rv-count" title={`${s.required} of ${s.seats} approvals needed`}>{s.approved}/{s.required}{s.required < s.seats ? ` of ${s.seats}` : ""}</span>{me.isAdmin && <Link className="rv-link" to="/admin/committee">Committee settings</Link>}</header>
        {s.reviewers.length === 0 ? <p className="rv-muted">{me.isAdmin ? <>No committee yet. <Link to="/admin/committee">Set up the committee</Link></> : "Waiting for IT to set up the committee"}</p>
          : s.reviewers.map(member => { const vote = s.decided(member.userId); const isMe = member.userId === me.id; return <div className="rv-member" key={member.userId}>
              <span className={`rv-avatar ${vote ? vote.approved ? "ok" : "no" : ""}`}>{initials(member.name)}</span>
              <span className="rv-member-name"><strong>{isMe ? "You" : member.name}</strong>{vote?.note && <small>{vote.rejected ? "Reason: " : ""}{vote.note}</small>}</span>
              <Badge tone={vote ? vote.approved ? "success" : "danger" : isMe ? "warning" : "neutral"}>{vote ? vote.approved ? "Approved" : vote.rejected ? "Rejected" : "Changes" : isMe ? "Your turn" : "Waiting"}</Badge>
            </div>; })}
      </section>
      <section className="rv-box">
        {s.mine && <div className="rv-decision"><h3>Your decision</h3>{s.myApproved ? <Badge tone="success">Approved</Badge> : s.myRejected ? <Badge tone="danger">Rejected</Badge> : <Btn size="sm" variant="primary" disabled={busy} onClick={() => begin("approve")}>Review decision</Btn>}</div>}
        {s.needsCodeReview ? <>
        <header><h3>IT review</h3><Badge tone={s.itPassed ? "success" : detail.codeReview ? "danger" : "neutral"}>{s.itPassed ? "Passed" : detail.codeReview ? "Changes" : "Pending"}</Badge></header>
        {detail.codeReview && <p className="rv-muted">{detail.codeReview.reviewerEmail} · {new Date(detail.codeReview.reviewedAt).toLocaleDateString("en-GB")}</p>}
        {detail.codeReview?.note && <p className="rv-note">{detail.codeReview.note}</p>}
        <ReviewLinks links={detail.codeReview?.links} />
        {me.isAdmin && <div className="rv-actions"><Btn size="sm" variant={s.mine ? "secondary" : "primary"} disabled={busy} onClick={() => begin(s.itPassed ? "it-withdraw" : "it-pass")}>{s.itPassed ? "Withdraw IT review" : "Review code"}</Btn></div>}
        </> : <p className="rv-muted">Register does not need an IT code review.</p>}
      </section>
      {detail.development?.parentApplicationId && <div className="rv-note"><Badge tone="info">System update · {detail.development.version}</Badge><p>{detail.development.changeSummary}</p><Link to={`/my-apps/${detail.development.parentApplicationId}`}>View current live system</Link></div>}
      <footer className="rv-meta">
        <span>{app.ownerEmail}</span>
        {products && <span>{products}</span>}
        <span>{AUDIENCE_LABEL[app.audience]}</span>
        {detail.development?.commit && <code>{detail.development.branch} · {detail.development.commit.slice(0, 7)}</code>}
        <Link to={`/my-apps/${app.id}`}>Open request <AppIcon value="fa:arrow-right" /></Link>
      </footer>
    </div>}
    <Dialog open={!!action} size={action === "changes" || action === "reject" ? "lg" : "md"} title={title} onClose={() => { if (!busy) setAction(null); }}><form className="review-decision-form" onSubmit={submit}>
      {action && action !== "it-withdraw" && <Field>Decision<Select value={action} onChange={event => { setAction(event.target.value as typeof action); setNote(""); setResolvedCycles([]); }}>{isCodeReview ? <><option value="it-pass">Pass IT review</option><option value="it-fail">Request code changes</option></> : <><option value="approve">Approve</option><option value="changes">Request changes</option><option value="reject">Reject</option></>}</Select></Field>}
      {action === "it-withdraw" ? <p className="rv-muted">Overall IT review goes back to pending. Previously passed change requests stay passed.</p> : <>
        {(action === "it-pass") && outstandingChanges.length > 0 && <div className="development-people"><p>{"Select the changes that passed. Selecting some saves only those changes; selecting all also passes the overall IT review. Previously passed changes stay passed."}</p>{outstandingChanges.map(change => <div key={change.cycle}><strong>Round {change.cycle} · Requested by {change.by}</strong>{change.note && <p>{change.note}</p>}<ReviewLinks links={change.links} /><label><input type="checkbox" checked={resolvedCycles.includes(change.cycle)} onChange={event => setResolvedCycles(previous => event.target.checked ? [...previous, change.cycle] : previous.filter(cycle => cycle !== change.cycle))} />Changes checked and passed</label></div>)}</div>}
        {action === "reject" && <Alert tone="danger" title="Rejecting closes the request">{s.required < s.seats ? `The request closes when ${s.seats - s.required + 1} committee members reject it, because ${s.required} approvals are then no longer possible.` : "One rejection closes the request."} A closed request cannot be edited or sent again; the requester has to create a new one.</Alert>}
        <Field>{action === "reject" ? "Reason for rejecting (required)" : action === "changes" ? "Changes required (required)" : action === "approve" ? "Approval comments (optional)" : needsNote ? "Note (required)" : "Note (optional)"}<Textarea required={needsNote} value={note} onChange={event => setNote(event.target.value)} rows={action === "changes" ? 8 : action === "approve" ? 5 : 3} placeholder={action === "reject" ? "Explain why this request should not go ahead. The requester sees this reason." : action === "changes" ? "Describe each issue, what needs to change, and the expected result.\n\n1. Issue or concern:\n   Required change:\n   Expected result:" : action === "approve" ? "Add the reason for approval or any recommendations for the requester." : undefined} /></Field>
        {isCodeReview && <div className="review-link-fields"><span className="review-link-label">Links (optional)</span>{links.map((link, index) => <div className="review-link-row" key={index}><Input type="url" pattern="https://.*" title="A full https:// link" aria-label={`Link ${index + 1}`} placeholder="https://megachem.sharepoint.com/..." value={link} onChange={event => { const value = event.target.value; setLinks(old => old.map((item, itemIndex) => itemIndex === index ? value : item)); }} />{links.length > 1 && <Btn type="button" size="sm" variant="ghost" aria-label={`Remove link ${index + 1}`} onClick={() => setLinks(old => old.filter((_, itemIndex) => itemIndex !== index))}><AppIcon value="fa:close" /></Btn>}</div>)}{links.length < 5 && <Btn type="button" size="sm" variant="ghost" startIcon={<AppIcon value="fa:plus" />} onClick={() => setLinks(old => [...old, ""])}>Add link</Btn>}</div>}
      </>}
      <div className="example-form-footer mt-6"><Btn type="button" disabled={busy} onClick={() => setAction(null)}>Cancel</Btn><Btn type="submit" variant="primary" loading={busy} disabled={action === "it-pass" && outstandingChanges.length > 0 && !resolvedCycles.length}>{action === "it-pass" && outstandingChanges.length > 0 && resolvedCycles.length < outstandingChanges.length ? "Pass selected changes" : title}</Btn></div>
    </form></Dialog>
  </article>;
}

/**
 * Requests waiting for IT to prepare Git and API access. A full tab with one row per request, so it
 * stays readable however many are waiting (it used to be a single line of links above the tabs).
 * Oldest first: the request that has waited longest is at the top.
 */
function PreparationList({ apps }: { apps: AppSummaryDto[] }) {
  if (!apps.length) return <EmptyState title="Nothing to prepare" description="Requests that need Git and API access set up will show up here." />;
  const sorted = [...apps].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  return <div className="rv-list">{sorted.map(app => <article key={app.id} className="portal-panel rv-card">
    <div className="rv-row rv-row-prep">
      <Link to={`/my-apps/${app.id}`} className="rv-main">
        <AppAvatar image={app.image} icon={app.icon} />
        <span className="rv-title"><strong>{app.name}</strong><small>{tierText(app.requestedTier ?? app.reviewTarget ?? app.type)} · {app.ownerDisplayName || app.ownerEmail} · requested {ago(app.updatedAt)}</small></span>
      </Link>
      <span className="rv-status">Set up Git{app.products.length ? " and API access" : ""}</span>
      <Link to={`/my-apps/${app.id}`} className="portal-button portal-button-primary portal-button-sm">Prepare</Link>
    </div>
  </article>)}</div>;
}

/**
 * Requests closed by a committee rejection. IT can reopen one for development with a reason:
 * it goes back to the requester as a draft (or "changes" if IT already prepared Git), and a new review round starts later.
 */
function RejectedList({ items, onChanged }: { items: Item[]; onChanged: () => void }) {
  const [reopening, setReopening] = useState<Item | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function reopen(event: React.FormEvent) {
    event.preventDefault();
    if (!reopening) return;
    setBusy(true);
    try {
      await api.post(`/api/applications/${reopening.app.id}/reopen`, { note });
      toast({ tone: "success", message: `${reopening.app.name} is back in development` });
      setReopening(null);
      onChanged();
    } catch (error) { toast({ tone: "danger", message: error instanceof ApiError ? error.message : "Couldn't reopen the request" }); }
    finally { setBusy(false); }
  }
  if (!items.length) return <EmptyState title="No rejected requests" description="Requests closed by the committee show up here. You can reopen one for development." />;
  const sorted = [...items].sort((a, b) => b.app.updatedAt.localeCompare(a.app.updatedAt));
  return <>
    <div className="rv-list">{sorted.map(item => {
      const { app, detail } = item;
      const reasons = detail.votes.filter(vote => vote.rejected && vote.note);
      return <article key={app.id} className="portal-panel rv-card">
        <div className="rv-row rv-row-prep">
          <Link to={`/my-apps/${app.id}`} className="rv-main">
            <AppAvatar image={app.image} icon={app.icon} />
            <span className="rv-title"><strong>{app.name}</strong><small>{tierText(app.requestedTier ?? app.reviewTarget ?? app.type)} · {app.ownerDisplayName || app.ownerEmail} · rejected {ago(app.updatedAt)}</small></span>
          </Link>
          <span className="rv-status">{reasons.length ? `${reasons.length} rejection${reasons.length > 1 ? "s" : ""}` : "Rejected"}</span>
          {detail.development?.parentApplicationId
            ? <span className="rv-muted" title="Ask the owner to request a new system update">System update</span>
            : <Btn size="sm" variant="primary" onClick={() => { setNote(""); setReopening(item); }}>Reopen for development</Btn>}
        </div>
        {reasons.length > 0 && <ul className="rv-reasons">{reasons.map(vote => <li key={vote.reviewerUserId}><strong>{vote.memberName}</strong>{vote.note}</li>)}</ul>}
      </article>;
    })}</div>
    <Dialog open={!!reopening} title="Reopen for development" onClose={() => { if (!busy) setReopening(null); }}><form className="review-decision-form" onSubmit={reopen}>
      <Field>Reason for reopening (required)<Textarea required rows={4} value={note} onChange={event => setNote(event.target.value)} placeholder="For example: scope agreed with the department, the committee's concerns can now be fixed." /></Field>
      <div className="example-form-footer mt-6"><Btn type="button" disabled={busy} onClick={() => setReopening(null)}>Cancel</Btn><Btn type="submit" variant="primary" loading={busy} disabled={!note.trim()}>Reopen</Btn></div>
    </form></Dialog>
  </>;
}

// IT switches between these sections from the App Management group in the sidebar (no in-page tabs).
const SECTION_TITLE = { reviews: "Review queue", preparation: "IT preparation", deployment: "Deployment", } as const;

export default function AdminReviewPage() {
  const { user } = useAuth();
  const isAdmin = user?.roleKey === "admin";
  const me: Me = useMemo(() => ({ id: user?.id, email: user?.email, isAdmin }), [user?.id, user?.email, isAdmin]);
  const [items, setItems] = useState<Item[]>([]);
  const [deployments, setDeployments] = useState<Item[]>([]);
  const [preparation, setPreparation] = useState<AppSummaryDto[]>([]);
  const [rejected, setRejected] = useState<Item[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const workspaceTab: keyof typeof SECTION_TITLE = tabParam === "reviews" || tabParam === "preparation" ? tabParam : "deployment";
  const [tab, setTab] = useState<Tab>(() => searchParams.get("list") === "rejected" ? "rejected" : "mine");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<AppSummaryDto[]>("/api/applications/review-queue").then(apps => Promise.all(apps.map(app => api.get<AppDetailDto>(`/api/applications/${app.id}`).then(detail => ({ app, detail }))))),
      api.get<CategoryDto[]>("/api/categories"),
      isAdmin ? api.get<AppSummaryDto[]>("/api/applications").then(apps => apps.filter(app => app.processStage === "setup")) : Promise.resolve<AppSummaryDto[]>([]),
      isAdmin ? api.get<AppSummaryDto[]>("/api/applications").then(async apps => { const active = await Promise.all(apps.filter(app => app.status === "active" && ["awaiting-deployment", "deployed", "live"].includes(app.processStage ?? "")).map(app => api.get<AppDetailDto>(`/api/applications/${app.id}`).then(detail => ({ app, detail })))); const ids = [...new Set(active.map(item => item.detail.development?.pendingUpdateId).filter((id): id is number => id != null && !active.some(item => item.app.id === id)))]; const updates = await Promise.all(ids.map(id => api.get<AppDetailDto>(`/api/applications/${id}`).then(detail => ({ app: detail.summary, detail })))); return [...active, ...updates]; }) : Promise.resolve<Item[]>([]),
      isAdmin ? api.get<AppSummaryDto[]>("/api/applications").then(apps => Promise.all(apps.filter(app => app.status === "rejected").map(app => api.get<AppDetailDto>(`/api/applications/${app.id}`).then(detail => ({ app, detail }))))) : Promise.resolve<Item[]>([]),
    ]).then(([queue, cats, setup, deploymentItems, rejectedItems]) => { if (active) { setItems(queue); setCategories(cats); setPreparation(setup); setRejected(rejectedItems); setDeployments(deploymentItems.filter(item => !(item.detail.development?.parentApplicationId && item.detail.development.stage === "live"))); } })
      .catch(error => { if (active) setError(error instanceof ApiError && error.status === 403 ? "Only committee members and IT can open reviews." : "Couldn't load reviews"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt, isAdmin]);
  const reload = () => { setError(""); setAttempt(value => value + 1); };

  const mine = items.filter(item => reviewState(item, me).needsMe);
  const waiting = items.filter(item => !reviewState(item, me).needsMe);
  const shown = tab === "mine" ? mine : tab === "waiting" ? waiting : items;
  const tabs: [Tab, string, number][] = [["mine", "Needs you", mine.length], ["waiting", "Waiting on others", waiting.length], ["all", "All", items.length], ...(isAdmin ? [["rejected", "Rejected", rejected.length] as [Tab, string, number]] : [])];

  return <div className="review-workspace">
    <div className="rv-heading"><h1>{isAdmin ? SECTION_TITLE[workspaceTab] : "Requests and reviews"}</h1><Btn size="sm" variant="ghost" startIcon={<AppIcon value="fa:rotate" />} onClick={reload}>Refresh</Btn></div>
    {loading ? <Skeleton rows={5} /> : error ? <Alert tone="danger" title={error}><Btn onClick={reload}>Try again</Btn></Alert> : <>
      {isAdmin && workspaceTab === "preparation" ? <PreparationList apps={preparation} /> : isAdmin && workspaceTab === "deployment" ? <DeploymentList items={deployments} onChanged={reload} /> : <>
      <div className="rv-tabs" role="tablist">{tabs.map(([key, label, count]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "on" : ""} onClick={() => setTab(key)}>{label}<span>{count}</span></button>)}</div>
      {tab === "rejected" ? <RejectedList items={rejected} onChanged={reload} /> : shown.length ? <div className="rv-list">{shown.map(item => <ReviewRow key={`${item.app.id}-${item.app.updatedAt}`} item={item} me={me} categories={categories} onChanged={reload} />)}</div>
        : <EmptyState title={tab === "mine" ? "You're all caught up" : "Nothing here"} description={tab === "mine" ? "Requests that need you will show up here." : "No requests in this list."} />}
      </>}
    </>}
  </div>;
}
