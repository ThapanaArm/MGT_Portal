import { useEditingGuard } from "@/shared/lib/editing-guard";
import DevelopmentRequestPanel from "./DevelopmentRequestPanel";
import { AppIcon } from "@/shared/components/Icon";
import ReviewLinks from "@/shared/components/ReviewLinks";
import { Badge, Select, Tabs, Field, Input, Dialog } from "@/shared/components/design-system";
import ChangeRequestsList from "./ChangeRequestsList";
import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import AppSchedule from "@/features/calendar/AppSchedule";
import { api, ApiError } from "@/shared/lib/api";
import { useAuth } from "@/shared/lib/auth";
import { useToast } from "@/shared/lib/toast";
import { Btn, Panel, ScopeTag, StatusDot, EnvChip } from "@/shared/components/ui";
import { AppAvatar } from "@/shared/components/MediaPickers";
import { Alert } from "@/shared/components/feedback";
import { AppOpenButton, AppScreenshots } from "@/features/apps/components/AppShowcase";
import AppForm, { type AppFormDevelopment, type AppFormValues } from "@/features/apps/AppForm";
import { AUDIENCE_LABEL, TIERS, TIER_NAME, tierCanUseApis, normalizeTier } from "@/shared/lib/tiers";
import type { AppDetailDto, AppType, CategoryDto } from "@/shared/lib/types";
const ACTION_LABEL: Record<string, string> = { create: "Draft created", review: "Request submitted", update: "Updated", publish: "Approval / reactivation", unpublish: "Suspended" };
const ACTION_DOT: Record<string, string> = { create: "bg-teal", review: "bg-put", update: "bg-ink-faint", publish: "bg-post", unpublish: "bg-danger" };

function CredentialBlock({ appId, env, category, cred, isAdmin, emptyNote, onChanged }: {
  appId: number; env: "sandbox" | "production"; category: string; cred: { tokenId: string; tokenSecret: string; hidden?: boolean } | undefined; isAdmin: boolean; emptyNote?: string; onChanged: () => void;
}) {
  const toast = useToast();
  const [revealed, setRevealed] = useState(false);

  const copy = (v: string) => {
    navigator.clipboard?.writeText(v).catch(() => {});
    toast({ tone: "success", message: "Copied" });
  };

  const regenerate = async () => {
    await api.post(`/api/applications/${appId}/credentials/${env}/${encodeURIComponent(category)}/regenerate`);
    toast("Credential regenerated");
    onChanged();
  };
  const revoke = async () => {
    await api.post(`/api/applications/${appId}/credentials/${env}/${encodeURIComponent(category)}/revoke`);
    toast({ tone: "success", message: "Credential revoked" });
    onChanged();
  };

  return (
    <div className="border border-line rounded-lg p-3 bg-paper">
      <h4 className="text-[13.5px] uppercase tracking-wide text-ink-faint font-bold mb-2.5 flex items-center gap-2">
        <EnvChip env={env} />
      </h4>
      {cred?.hidden ? (
        // Production keys can only be viewed and copied by IT; the server does not send the secret here.
        <>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[13.5px] text-ink-faint w-[76px] flex-shrink-0">Token ID</span>
            <code className="font-mono text-[14px] bg-surface-2 rounded-md px-2 py-0.5 break-all flex-1 min-w-[110px] select-none">{cred.tokenId}</code>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13.5px] text-ink-faint w-[76px] flex-shrink-0">Token Secret</span>
            <code className="font-mono text-[14px] bg-surface-2 rounded-md px-2 py-0.5 flex-1 min-w-[110px] select-none">••••••••••••••••</code>
          </div>
          <p className="text-[13px] text-ink-dim mt-2.5 flex items-center gap-1.5"><AppIcon value="fa:lock" /> Production key is held by IT and added at deployment. Use the Sandbox key for development.</p>
        </>
      ) : cred ? (
        <>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[13.5px] text-ink-faint w-[76px] flex-shrink-0">Token ID</span>
            <code className="font-mono text-[14px] bg-surface-2 rounded-md px-2 py-0.5 break-all flex-1 min-w-[110px]">{cred.tokenId}</code>
            <Btn size="sm" onClick={() => copy(cred.tokenId)}>Copy</Btn>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13.5px] text-ink-faint w-[76px] flex-shrink-0">Token Secret</span>
            <code className="font-mono text-[14px] bg-surface-2 rounded-md px-2 py-0.5 break-all flex-1 min-w-[110px]">
              {revealed ? cred.tokenSecret : "••••••••••••••••"}
            </code>
            <Btn size="sm" onClick={() => setRevealed((r) => !r)}>{revealed ? "Hide" : "Show"}</Btn>
            <Btn size="sm" onClick={() => copy(cred.tokenSecret)}>Copy</Btn>
          </div>
          {isAdmin && (
            <div className="flex gap-1.5 mt-2.5 pt-2.5 border-t border-line">
              <Btn size="sm" onClick={regenerate}>Regenerate</Btn>
              <Btn size="sm" danger onClick={revoke}>Revoke</Btn>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="text-[14.5px] text-ink-faint">{emptyNote ?? "No credential available"}</div>
          {isAdmin && (
            <div className="mt-2.5 pt-2.5 border-t border-line">
              <Btn size="sm" onClick={regenerate}>Issue credential</Btn>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function AppDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preferredTier = searchParams.get("tier");
  const { user } = useAuth();
  const toast = useToast();
  const [detail, setDetail] = useState<AppDetailDto | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [repositoryDraft, setRepositoryDraft] = useState("");
  const [repositoryBusy, setRepositoryBusy] = useState(false);
  const [repositoryError, setRepositoryError] = useState("");
  const [tab, setTab] = useState("Overview");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState(false);
  const { requestExit } = useEditingGuard(editing);
  const [reviewTarget, setReviewTarget] = useState<AppType>("tier1");

  const isAdmin = user?.roleKey === "admin";

  const load = useCallback(() => {
    setLoadError(false);
    api.get<AppDetailDto>(`/api/applications/${id}`).then((d) => {
      setDetail(d);
      setRepositoryDraft(d.summary.github && d.summary.github !== "-" ? d.summary.github.startsWith("https://") ? d.summary.github : `https://${d.summary.github}` : "");
      // Applications with API products default to Verify because Register does not support APIs.
      const s = d.summary;
      setReviewTarget(s.status === "draft" && TIERS.includes(preferredTier as AppType) && (preferredTier !== "tier3" || isAdmin) && (preferredTier !== "tier1" || !s.products.length) ? preferredTier as AppType : s.products.length > 0 && !tierCanUseApis(s.type) ? "tier2" : s.type);
    }).catch(() => setLoadError(true));
    api.get<CategoryDto[]>("/api/categories").then(setCategories).catch(() => setCategories([]));
  }, [id, preferredTier, isAdmin]);

  useEffect(load, [load]);
  useEffect(() => {
    if (editing) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      api.get<AppDetailDto>(`/api/applications/${id}`).then(next => {
        setDetail(current => current?.summary.updatedAt === next.summary.updatedAt ? current : next);
      }).catch(() => {});
    }, 15000);
    return () => window.clearInterval(timer);
  }, [id, editing]);

  if (loadError && !detail) return <Panel title="Unable to load this request"><Btn onClick={load}>Try again</Btn></Panel>;
  if (!detail) return <div className="text-ink-faint text-[15.5px]">Loading...</div>;
  const a = detail.summary;
  const categoryName = (key: string) => categories.find((c) => c.key === key)?.name ?? key;

  /** Execute an API action and display its result, including backend validation errors. */
  const run = async (call: () => Promise<unknown>, okMessage: string) => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await call();
      toast({tone:"success",message:okMessage});
    } catch (err) {
      toast({tone:"danger",message:err instanceof ApiError ? err.message : "Unable to complete the action"});
    }
    setActionBusy(false);
    load();
  };

  const sendReview = () =>
    run(
      () => api.post(`/api/applications/${id}/send-review`, { targetType: reviewTarget }),
      tierCanUseApis(reviewTarget)
        ? "Submitted for committee and IT review"
        : "Submitted for committee review (3 of 5 approvals needed)",
    );
  const publish = () => run(() => api.post(`/api/applications/${id}/publish`), "Application reactivated");
  const unpublish = () => run(() => api.post(`/api/applications/${id}/unpublish`), "Application suspended and credentials disabled");

  const saveEdit = async (values: AppFormValues, tier?: AppType, development?: AppFormDevelopment) => {
    try {
      await api.put(`/api/applications/${id}`, values);
      // Draft requests: the same "Edit request" also saves the development access (tier, mode, accounts).
      if (development) await api.put(`/api/applications/${id}/development-access`, { targetTier: tier, emails: development.emails });
      setEditing(false);
      toast({ tone: "success", message: "Changes saved" });
      load();
    } catch (err) {
      throw new Error(err instanceof ApiError ? err.message : "Unable to save", { cause: err });
    }
  };

  const approved = a.status === "active" || a.status === "suspended";
  const isOwner = a.ownerEmail.toLowerCase() === user?.email.toLowerCase();
  const canEditData = (detail.canEditData ?? isOwner) && a.status !== "rejected" && (!detail.development || detail.development.stage === "draft");
  // My apps shows "Open" only once IT has deployed the app (older apps without a development record count once approved).
  // The requester edits development access (mode + accounts) together with the app details while the request is a draft.
  const developmentDraft = isOwner && (detail.development ? detail.development.stage === "draft" : a.status === "draft")
    ? { team: (detail.development?.developers?.length ?? 0) > 1, emails: detail.development?.developers?.length ? detail.development.developers.map(d => d.email) : [a.ownerEmail] }
    : undefined;
  // Developers in the request's Development accounts list can copy the Sandbox keys too (Production stays with IT).
  const isListedDeveloper = !!user && (detail.development?.developers ?? []).some(d => d.email.toLowerCase() === user.email.toLowerCase());
  const isDeployed = a.status === "active" && (detail.development ? ["deployed", "live"].includes(detail.development.stage) : true);
  const canManage = isOwner && (!detail.development || detail.development.stage === "draft");
  // Each application has its own committee (chosen by IT); only its members can vote on it.
  const reviewers = detail.reviewers ?? [];
  const changeCount = detail.changeRequests?.length ?? 0;
  const isCommitteeReviewer = reviewers.some((r) => r.userId === user?.id);
  const canReview = isAdmin || isCommitteeReviewer;
  const approvedVotes = detail.votes.filter((v) => v.approved && v.actorEmail && v.decidedAt && reviewers.some((r) => r.userId === v.reviewerUserId)).length;
  const codeReviewText = detail.codeReview ? (detail.codeReview.approved ? "Passed" : "Changes requested") : "Not reviewed";
  // Sandbox: from IT preparation (development/review) onward. Production: only after approval.
  // Mirrors ApplicationWorkflow.CredentialAllowed; the backend checks this as well.
  const devStage = detail.development?.stage;
  const canManageProduction = isAdmin && a.status === "active" && tierCanUseApis(a.type);
  const canManageSandbox = canManageProduction || (isAdmin && a.products.length > 0 &&
    (devStage === "development" || devStage === "changes" || devStage === "review") && tierCanUseApis(detail.development?.targetTier ?? a.type));
  const credentialNote =
    approved && !tierCanUseApis(a.type)
      ? "Register applications do not use APIs and have no credentials"
      : "Sandbox is issued when IT completes preparation; Production after approval";
  // One token per requested API (category) per environment — a token only works for its own API.
  const credOf = (env: "sandbox" | "production", category: string) =>
    detail.credentials.find((c) => c.env === env && c.category.toLowerCase() === category.toLowerCase());
  const credentialCategories = [...new Set(a.products.map((p) => p.trim().toLowerCase()).filter(Boolean))];

  // normalizeTier also maps records saved with the old level names (verify, official, ...).
  const currentTier = normalizeTier(detail.development?.targetTier ?? (a.status === "draft" ? reviewTarget : a.reviewTarget ?? a.type)) ?? reviewTarget;
  // Every tier now goes to the committee; only Verify / Official also need an IT code review.
  const needsCodeReview = detail.requiresCodeReview;
  const committeeSize = detail.committeeSize ?? 5;
  const requiredVotes = detail.requiredVotes || committeeSize;
  const statusCopy = a.status === "draft" ? "Check details and submit." : a.status === "pending" ? "IT and committee reviews are in progress." : a.status === "active" ? "Approved for deployment by IT." : a.status === "rejected" ? "The committee rejected this request. It is closed; create a new request to try again." : "Contact IT to resume this request.";
  const repository = a.github && a.github !== "-" ? a.github : "";
  async function saveRepository(event: React.FormEvent) {
    event.preventDefault(); setRepositoryBusy(true); setRepositoryError("");
    try { await api.put(`/api/applications/${id}/repository`, {github:repositoryDraft.trim()}); toast({tone:"success",message:"GitHub information saved by IT"}); load(); }
    catch(error) { setRepositoryError(error instanceof ApiError ? error.message : "Unable to save GitHub information"); }
    finally { setRepositoryBusy(false); }
  }
  return <div className="app-request-page">
    {/* Review sits in an edge tab: committee, IT review and every request for changes in one drawer. */}
    <button type="button" className={`review-edge-tab ${changeCount && detail.development?.stage === "changes" ? "attention" : ""}`} onClick={() => setReviewOpen(true)} aria-label="Open review"><AppIcon value={changeCount ? "fa:comment" : "fa:check"} /><span>{changeCount ? "Changes · Review" : "Review"}</span>{changeCount > 0 && <b>{changeCount}</b>}</button>
    <Dialog open={reviewOpen} drawer expandable size="lg" title="Review" onClose={() => setReviewOpen(false)}>
      {changeCount > 0 && <section className="review-drawer-section"><h3>Change request history</h3><ChangeRequestsList items={detail.changeRequests ?? []} /></section>}
      <section className="review-drawer-section"><h3>Approval checkpoints</h3>{<div className="app-request-review-grid"><section className="request-checkpoint"><header><span className="request-checkpoint-icon"><AppIcon value="fa:users" /></span><h3>Committee review</h3><Badge tone={approvedVotes >= requiredVotes ? "success" : a.status === "rejected" ? "danger" : "neutral"}>{a.status === "draft" ? "Not started" : a.status === "rejected" ? "Rejected" : `${approvedVotes} / ${requiredVotes} approved${requiredVotes < committeeSize ? ` (of ${committeeSize})` : ""}`}</Badge></header><>{reviewers.map(member => { const vote = detail.votes.find(item => item.reviewerUserId === member.userId); const decided = !!vote?.actorEmail && !!vote?.decidedAt; return <div className="review-member" key={member.userId}><div><strong>{member.name}</strong><small>{member.email}</small>{vote?.note && <p>{vote.rejected ? "Reason: " : ""}{vote.note}</p>}</div><Badge tone={decided ? vote?.approved ? "success" : "danger" : "neutral"}>{decided ? vote?.approved ? "Approved" : vote?.rejected ? "Rejected" : "Changes requested" : a.status === "draft" ? "Assigned" : "Awaiting review"}</Badge></div>; })}{!reviewers.length && <p className="review-note">{a.status === "draft" ? `Awaiting submission. IT selects ${committeeSize} committee members for this request.` : "IT has not selected the committee for this request yet."}</p>}{reviewers.length > 0 && reviewers.length < committeeSize && <p className="review-note">{reviewers.length} of {committeeSize} committee members selected by IT.</p>}</></section>{needsCodeReview ? <section className="request-checkpoint"><header><span className="request-checkpoint-icon"><AppIcon value="fa:code" /></span><h3>IT code review</h3><Badge tone={detail.codeReview?.approved ? "success" : "neutral"}>{a.status === "draft" && !detail.codeReview ? "Not started" : codeReviewText}</Badge></header><p className="review-note">{detail.codeReview ? `Reviewed by ${detail.codeReview.reviewerEmail}` : "Awaiting IT review."}</p>{detail.codeReview?.note && <p className="review-note">{detail.codeReview.note}</p>}<ReviewLinks links={detail.codeReview?.links} /></section> : <section className="request-checkpoint"><header><span className="request-checkpoint-icon"><AppIcon value="fa:code" /></span><h3>IT code review</h3><Badge tone="neutral">Not required</Badge></header><p className="review-note">Register needs {requiredVotes} of {committeeSize} committee approvals and no IT code review.</p></section>}</div>}</section>
    </Dialog>
    <header className="app-request-header"><div className="app-request-identity"><AppAvatar image={a.image} icon={a.icon} size="xl" /><div><span className="workspace-kicker">{isAdmin && !isOwner ? "IT request workspace" : canReview && !isOwner ? "Review workspace" : "Application request"} · #{a.id}</span><h1>{a.name}</h1><div className="app-request-badges">{detail.development && !["draft","approved"].includes(detail.development.stage) ? <Badge tone={detail.development.stage === "rejected" ? "danger" : detail.development.stage === "changes" ? "warning" : "info"}>{{setup:"IT preparation",development:"Development",changes:"Changes requested",review:"Deployment review","awaiting-deployment":"Awaiting deployment",deployed:"Deployed",live:"Live",suspended:"Suspended",rejected:"Rejected"}[detail.development.stage] ?? detail.development.stage}</Badge> : <StatusDot status={a.status} />}<Badge tone="neutral">{isAdmin ? "IT administrator view" : isCommitteeReviewer && !isOwner ? "Committee reviewer view" : isOwner ? "Requester view" : "Read-only view"}</Badge><Badge tone="info">{TIER_NAME[currentTier]}</Badge></div></div></div><div className="app-request-header-aside">{isDeployed && <AppOpenButton app={a} size="md" />}<dl className="app-request-header-facts"><div><dt>Requested by</dt><dd>{a.ownerEmail}</dd></div>{detail.development && <div><dt>{detail.development.parentApplicationId ? "Update version" : "Current version"}</dt><dd>{detail.development.version ?? (detail.development.stage === "live" ? "Initial release" : "Not released yet")}</dd></div>}<div><dt>Last updated</dt><dd>{new Date(a.updatedAt).toLocaleString("en-GB")}</dd></div></dl>{canEditData && <Btn onClick={() => editing ? requestExit(() => setEditing(false)) : setEditing(true)}>{editing ? "Cancel editing" : "Edit request"}</Btn>}</div></header>
    {a.status === "rejected" && <Alert tone="danger" title="Request rejected by the committee">
      <p>This request is closed and cannot be edited or sent again unless IT reopens it for development. Otherwise, create a new request to try again.</p>
      {isAdmin && !detail.development?.parentApplicationId && <p className="mt-2"><Link to="/reviews?tab=reviews&list=rejected">Reopen for development</Link></p>}
      <ul className="mt-2 list-disc pl-5">{detail.votes.filter(vote => vote.rejected).map(vote => <li key={vote.reviewerUserId}><strong>{vote.memberName}:</strong> {vote.note}</li>)}</ul>
    </Alert>}
    <DevelopmentRequestPanel key={`${a.id}-${a.updatedAt}`} detail={detail} initialTier={reviewTarget} onChanged={load} />
    {(isOwner || isAdmin) && a.status !== "rejected" && a.status !== "draft" && <AppSchedule key={`schedule-${a.id}-${a.updatedAt}`} appId={a.id} canBook={isOwner} />}
    {editing ? <AppForm title="Edit request" initialTier={currentTier} development={developmentDraft} hint="Update the application details before continuing your request." initial={{name:a.name,description:a.description,subdomain:a.subdomain,github:a.github,products:a.products,image:a.image,icon:a.icon,screenshots:detail.screenshots,audience:a.audience}} categories={categories} submitLabel="Save changes" onSubmit={saveEdit} onCancel={()=>requestExit(() => setEditing(false))} /> : <div className="app-request-layout"><main className="app-request-main">
      <Tabs label="Application request details" items={isAdmin && !detail.development ? ["Overview","IT preparation","Activity"] : ["Overview","Activity"]} value={tab} onChange={setTab} />
      {tab === "Overview" && <div className="app-request-tab-content"><AppScreenshots app={a} shots={detail.screenshots} onAdd={canEditData && !editing ? () => setEditing(true) : undefined} /><Panel title="Request details"><div className="app-request-purpose"><span>Purpose</span><p>{a.description || "No description provided."}</p></div><dl className="request-summary"><div><dt>Audience</dt><dd><AppIcon value="fa:users" /> {AUDIENCE_LABEL[a.audience]}</dd></div><div><dt>Requested tier</dt><dd>{TIER_NAME[currentTier]}</dd></div><div><dt>Requested subdomain</dt><dd><code>{a.subdomain || "Not provided"}</code></dd></div><div><dt>GitHub</dt><dd>{repository ? <a className="text-teal-strong" href={repository.startsWith("https://") ? repository : `https://${repository}`} target="_blank" rel="noopener noreferrer">{repository} <AppIcon value="fa:external-link" /></a> : <span className="text-ink-dim">To be provided by IT</span>}</dd></div></dl></Panel>
      <Panel title="Requested services"><div className="app-request-service-tags">{a.products.map(product=><ScopeTag key={product}>{categoryName(product)}</ScopeTag>)}{!a.products.length && <span className="text-sm text-ink-dim">Standalone application</span>}</div></Panel>
      {(isAdmin || isOwner || isListedDeveloper) && (detail.development?.parentApplicationId ? <Panel title="API access"><p className="development-note">This update uses the main application’s API credentials. Manage access on the main application.</p><Btn onClick={() => navigate(`/my-apps/${detail.development?.parentApplicationId}`)}>Open main application</Btn></Panel> : <details className="app-request-credentials"><summary><span><AppIcon value="fa:lock" /> API credentials</span><span>View credentials <AppIcon value="fa:chevron-down" /></span></summary><Panel title="API credentials" hint="Each API has its own token. Use the token that matches the API you call. Keep secrets private and never embed them in client code.">{credentialCategories.length ? credentialCategories.map(category=><section key={category} className="app-request-credential-service"><h3><ScopeTag>{categoryName(category)}</ScopeTag><code>{categories.find((c)=>c.key===category)?.basePath ?? `/api/v1/${category}`}</code></h3><div className="app-request-credential-grid"><CredentialBlock appId={a.id} env="sandbox" category={category} cred={credOf("sandbox", category)} isAdmin={canManageSandbox} emptyNote={credentialNote} onChanged={load} /><CredentialBlock appId={a.id} env="production" category={category} cred={credOf("production", category)} isAdmin={canManageProduction} emptyNote={credentialNote} onChanged={load} /></div></section>) : <p className="text-sm text-ink-dim">This application does not request any API.</p>}</Panel></details>)}
      </div>}
      {tab === "IT preparation" && isAdmin && <Panel title="IT preparation"><div className="app-request-owned-note"><strong>Requested by {a.ownerEmail}</strong></div>{a.status === "draft" ? <p className="text-sm text-ink-dim mt-5">Awaiting requester submission.</p> : <form onSubmit={saveRepository} className="app-request-repository-form"><Field>GitHub URL<Input type="url" pattern="https://.*" placeholder="https://github.com/company/repository" value={repositoryDraft} onChange={event=>setRepositoryDraft(event.target.value)} /></Field>{repositoryError && <p role="alert" className="text-danger text-xs">{repositoryError}</p>}<Btn type="submit" variant="primary" loading={repositoryBusy}>Save repository</Btn></form>}</Panel>}
      {tab === "Activity" && <Panel title="Request activity"><div className="app-request-activity">{detail.log.map((entry,index)=><div key={index}><span className={`app-request-activity-dot ${ACTION_DOT[entry.actionType] ?? "bg-teal"}`} /><div><strong>{ACTION_LABEL[entry.actionType] ?? entry.actionType}</strong><small>{new Date(entry.occurredAt).toLocaleString("en-GB")} · {entry.actor}</small>{entry.note && <p>{entry.note}</p>}</div></div>)}{!detail.log.length && <p className="text-sm text-ink-dim">No activity recorded yet.</p>}</div></Panel>}
    </main><aside className="app-request-aside">{!detail.development && !["draft"].includes(a.status) && <Panel className="app-request-next-step"><span className="workspace-kicker">{isAdmin && !isOwner ? "Your IT tasks" : canReview && !isOwner ? "Your review tasks" : isOwner ? "Next step" : "Request status"}</span><h2>{isAdmin && !isOwner ? a.status === "draft" ? "Awaiting submission" : "IT preparation" : canReview && !isOwner ? "Review this request" : a.status === "draft" ? "Prepare your request" : a.status === "pending" ? "Awaiting review" : a.status === "active" ? "Approved for deployment" : "Approval suspended"}</h2><p>{isAdmin && !isOwner ? a.status === "draft" ? "The requester is preparing this request." : "Add the GitHub link and complete the IT review." : canReview && !isOwner ? "Review the request and record your decision." : !isOwner ? "Read-only request details." : statusCopy}</p>{isAdmin && !isOwner && <div className="app-request-admin-actions"><Btn variant="primary" disabled={a.status === "draft"} onClick={()=>setTab("IT preparation")}>Manage GitHub</Btn>{a.status === "pending" && <Btn onClick={()=>navigate("/reviews")}>Review request</Btn>}</div>}{isCommitteeReviewer && !isAdmin && !isOwner && <Btn variant="primary" onClick={()=>navigate("/reviews")}>Open review workbench</Btn>}{canManage && (a.status === "draft" || a.status === "suspended") && <div className="app-request-submit"><label htmlFor="request-review-tier">Requested tier</label><Select id="request-review-tier" value={reviewTarget} disabled={actionBusy} onChange={event=>setReviewTarget(event.target.value as AppType)}>{TIERS.map(tier=><option key={tier} value={tier} disabled={(!tierCanUseApis(tier) && a.products.length > 0) || (tier === "tier3" && !isAdmin)}>{TIER_NAME[tier]}</option>)}</Select><p>{tierCanUseApis(reviewTarget) ? `${detail.committeeSize ?? 5} committee approvals + IT code review` : "Automatic approval"}</p><Btn variant="primary" loading={actionBusy} onClick={sendReview}>Submit for review <AppIcon value="fa:arrow-right" /></Btn></div>}{isOwner && a.status === "pending" && <Btn onClick={()=>setReviewOpen(true)}>View review progress</Btn>}{isAdmin && a.status === "active" && <Btn size="sm" danger disabled={actionBusy} onClick={unpublish}>Suspend application</Btn>}{isAdmin && a.status === "suspended" && <Btn disabled={actionBusy} onClick={publish}>Reactivate approval</Btn>}</Panel>}
      <Panel title="Request information"><dl className="app-request-owner"><div><dt>Requested by</dt><dd>{a.ownerEmail}</dd></div><div><dt>Created</dt><dd>{a.createdAt.slice(0,10)}</dd></div><div><dt>Last updated</dt><dd>{a.updatedAt.slice(0,10)}</dd></div></dl></Panel>
    </aside></div>}
  </div>;
}

