import { Link } from "react-router";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/shared/lib/api";
import { useAuth } from "@/shared/lib/auth";
import { useToast } from "@/shared/lib/toast";
import { Btn, EmptyState, Panel, ScopeTag } from "@/shared/components/ui";
import { Badge, Dialog, Field, Skeleton, Textarea } from "@/shared/components/design-system";
import { Alert } from "@/shared/components/feedback";
import { AppAvatar } from "@/shared/components/MediaPickers";
import { TIER_LABEL, AUDIENCE_LABEL } from "@/shared/lib/tiers";
import type { AppDetailDto, AppSummaryDto, CategoryDto, CommitteeMemberDto } from "@/shared/lib/types";
import CommitteeAssignments from "./CommitteeAssignments";

function ReviewCard({ app, categories, members, onChanged }: { app: AppSummaryDto; categories: CategoryDto[]; members: CommitteeMemberDto[]; onChanged: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [detail, setDetail] = useState<AppDetailDto | null>(null);
  const [error, setError] = useState(false);
  const [action, setAction] = useState<"approve" | "changes" | "it-pass" | "it-fail" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => api.get<AppDetailDto>(`/api/applications/${app.id}`).then(setDetail).catch(() => setError(true));
  useEffect(() => { let active = true; api.get<AppDetailDto>(`/api/applications/${app.id}`).then(value => { if (active) setDetail(value); }).catch(() => { if (active) setError(true); }); return () => { active = false; }; }, [app.id]);
  if (error) return <Alert tone="danger" title={`Unable to load ${app.name}`}><Btn onClick={() => { setError(false); void load(); }}>Try again</Btn></Alert>;
  if (!detail) return <Skeleton rows={3} />;
  const approved = detail.votes.filter(vote => vote.approved && vote.actorEmail && vote.decidedAt).length;
  const mine = members.find(member => member.userId === user?.id);
  const myVote = detail.votes.find(vote => vote.committeeMemberId === mine?.id && vote.actorEmail === user?.email);
  const needsNote = action === "changes" || action === "it-fail";
  const title = action === "approve" ? "Approve application request" : action === "changes" ? "Request changes" : action === "it-pass" ? "Pass IT code review" : "Request code changes";
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (needsNote && !note.trim()) return;
    setBusy(true);
    try {
      const isCodeReview = action === "it-pass" || action === "it-fail";
      await api.post(`/api/applications/${app.id}/${isCodeReview ? "code-review" : "vote"}`, { approved: action === "approve" || action === "it-pass", note: note.trim() || null });
      toast({ tone: "success", message: "Your review decision has been recorded" }); setAction(null); onChanged(); await load();
    } catch (error) { toast({ tone: "danger", message: error instanceof ApiError ? error.message : "Unable to record the decision" }); }
    finally { setBusy(false); }
  }
  function begin(next: typeof action) { setNote(""); setAction(next); }
  return <Panel className="review-request">
    <div className="workspace-section-title"><div className="flex items-center gap-3"><AppAvatar image={app.image} icon={app.icon} /><div><h2>{app.name}</h2><p className="text-xs text-ink-dim">Requested by {app.ownerEmail}</p></div></div><Badge tone="info">{TIER_LABEL[app.reviewTarget ?? app.type]}</Badge></div>
    {detail.development?.commit && <div className="development-note"><strong>Deployment version:</strong> <code>{detail.development.branch} · {detail.development.commit}</code> · <Link to={`/my-apps/${app.id}`}>Open request</Link></div>}
    <p className="text-sm text-ink-dim mb-4">{app.description}</p>
    <dl className="request-summary"><div><dt>Requested subdomain</dt><dd>{app.subdomain || "Not provided"}</dd></div><div><dt>Repository</dt><dd>{app.github || "Not provided"}</dd></div><div><dt>Audience</dt><dd>{AUDIENCE_LABEL[app.audience]}</dd></div><div><dt>Review cycle</dt><dd>{detail.reviewCycle}</dd></div></dl>
    <div className="flex gap-2 flex-wrap my-4">{app.products.map(product => <ScopeTag key={product}>{categories.find(category => category.key === product)?.name ?? product}</ScopeTag>)}</div>
    <div className="review-gates"><section><h3>Committee approval <Badge tone={approved >= detail.requiredVotes ? "success" : "warning"}>{approved} / {detail.requiredVotes}</Badge></h3>
      {members.map(member => { const vote = detail.votes.find(item => item.committeeMemberId === member.id); const verified = !!vote?.actorEmail && !!vote?.decidedAt; return <div key={member.id} className="review-member"><div><strong>{member.name}</strong><small>{member.roleTitle} · {member.email ?? "Account not assigned"}</small>{verified && <small>{vote.actorEmail} · {new Date(vote.decidedAt!).toLocaleString("en-GB")}</small>}{vote?.note && <p>{vote.note}</p>}</div><Badge tone={verified ? vote.approved ? "success" : "danger" : "neutral"}>{verified ? vote.approved ? "Approved" : "Changes requested" : vote ? "Legacy decision — review again" : "Awaiting decision"}</Badge></div>; })}
      {mine ? <div className="flex flex-wrap gap-2 mt-4"><Btn variant="primary" disabled={!!myVote?.approved} onClick={() => begin("approve")}>{myVote?.approved ? "Your approval is recorded" : "Approve as yourself"}</Btn><Btn onClick={() => begin("changes")}>Request changes</Btn></div> : <p className="review-note">You can view decisions. Only assigned committee members can cast their own vote.</p>}
    </section><section><h3>IT code review <Badge tone={detail.codeReview?.approved ? "success" : "warning"}>{detail.codeReview ? detail.codeReview.approved ? "Passed" : "Changes requested" : "Awaiting review"}</Badge></h3><p className="review-note">A separate approval gate. Three committee approvals alone do not complete this request.</p>{detail.codeReview && <div className="review-note"><strong>{detail.codeReview.reviewerEmail}</strong><p>{new Date(detail.codeReview.reviewedAt).toLocaleString("en-GB")}</p><p>{detail.codeReview.note}</p></div>}{user?.roleKey === "admin" && <div className="flex gap-2 flex-wrap mt-4"><Btn onClick={() => begin("it-pass")}>Pass code review</Btn><Btn onClick={() => begin("it-fail")}>Request code changes</Btn></div>}</section></div>
    <p className="review-note">Approval completes this Portal request. IT handles repository setup, company domain configuration, and deployment outside the Portal.</p>
    <Dialog open={!!action} title={title} onClose={() => { if (!busy) setAction(null); }}><form onSubmit={submit}><Alert tone="info">Your decision is recorded under {user?.email}. {action === "changes" ? "The request returns to its owner for revision." : "Approval does not deploy the application."}</Alert><Field>Review notes {needsNote ? "(required)" : "(optional)"}<Textarea required={needsNote} value={note} onChange={event => setNote(event.target.value)} rows={4} /></Field><div className="example-form-footer mt-6"><Btn type="button" disabled={busy} onClick={() => setAction(null)}>Cancel</Btn><Btn type="submit" variant="primary" loading={busy}>{title}</Btn></div></form></Dialog>
  </Panel>;
}

export default function AdminReviewPage() {
  const { user } = useAuth();
  const [preparation, setPreparation] = useState<AppSummaryDto[]>([]);
  useEffect(() => { if (user?.roleKey === "admin") api.get<AppSummaryDto[]>("/api/applications").then(apps => setPreparation(apps.filter(app => app.processStage === "setup"))).catch(() => setPreparation([])); }, [user?.roleKey]);
  const [pending, setPending] = useState<AppSummaryDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [members, setMembers] = useState<CommitteeMemberDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { let active = true; Promise.all([api.get<AppSummaryDto[]>("/api/applications/review-queue"), api.get<CategoryDto[]>("/api/categories"), api.get<CommitteeMemberDto[]>("/api/committee/members")]).then(([apps, cats, committee]) => { if (active) { setPending(apps); setCategories(cats); setMembers(committee); } }).catch(error => { if (active) setError(error instanceof ApiError && error.status === 403 ? "Review access is available to assigned committee members and administrators." : "Unable to load application reviews"); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [attempt]);
  const reload = () => { setError(""); setLoading(true); setAttempt(value => value + 1); };
  const assigned = members.filter(member => member.userId).length;
  return <div className="review-workspace"><div className="portal-page-heading"><span className="workspace-kicker">Application governance</span><h1>Requests and reviews</h1><p className="text-sm text-ink-dim mt-2">Review submitted applications and record your decision. IT handles deployment after approval.</p></div>{loading ? <Skeleton rows={5} /> : error ? <Alert tone="danger" title={error}><Btn onClick={reload}>Try again</Btn></Alert> : <><div className="review-role-banner"><div><small>Your role here</small><strong>{members.some(member => member.userId === user?.id) ? "Committee reviewer" : "IT code reviewer"}</strong><p>{members.some(member => member.userId === user?.id) ? "Record your own committee decision on each request." : "Record the IT code review. Only assigned committee members can vote."}</p></div><div><small>Review queue</small><strong>{pending.length} awaiting review</strong></div></div>{user?.roleKey === "admin" && <section className="review-settings-area"><h2>Committee setup</h2><p>{assigned} of {members.length} seats have an account. {assigned < members.length ? "Assign the remaining accounts so committee members can vote." : "Committee accounts are ready to review requests."}</p><CommitteeAssignments members={members} onChanged={reload} /></section>}{user?.roleKey === "admin" && preparation.length > 0 && <Panel title="IT preparation queue"><div className="development-people">{preparation.map(app => <div key={app.id}><strong>{app.name}</strong><span>{app.ownerEmail}</span><Link className="text-teal-strong" to={`/my-apps/${app.id}`}>Prepare access</Link></div>)}</div></Panel>}<div className="review-queue-heading"><h2>Awaiting review</h2><Btn onClick={reload}>Refresh queue</Btn></div>{pending.length ? pending.map(app => <ReviewCard key={`${app.id}-${app.updatedAt}`} app={app} categories={categories} members={members} onChanged={reload} />) : <EmptyState title="Your review queue is clear" description="There is nothing to approve yet. Submitted Tier 2 and Tier 3 requests will appear here automatically." />}</>}<Panel className="review-explainer"><h2>How approval works</h2><ol><li><strong>1. Owner submits</strong><p>A Tier 2 or Tier 3 request enters this queue.</p></li><li><strong>2. Committee and IT review</strong><p>Three individual committee approvals and a separate IT code review are required.</p></li><li><strong>3. Request approved</strong><p>IT arranges deployment outside the Portal.</p></li></ol><p className="review-note">Tier 1 is approved automatically and does not appear in this queue.</p></Panel></div>;
}
