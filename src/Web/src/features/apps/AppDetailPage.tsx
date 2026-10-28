import DevelopmentRequestPanel from "./DevelopmentRequestPanel";
import { AppIcon } from "@/shared/components/Icon";
import { Badge, Select, Tabs, Field, Input } from "@/shared/components/design-system";
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { api, ApiError } from "@/shared/lib/api";
import { useAuth } from "@/shared/lib/auth";
import { useToast } from "@/shared/lib/toast";
import { Btn, Panel, ScopeTag, StatusDot, EnvChip } from "@/shared/components/ui";
import { AppAvatar } from "@/shared/components/MediaPickers";
import { ShotsGallery } from "@/shared/components/MediaPickers";
import AppForm, { AppFormValues } from "@/features/apps/AppForm";
import { AUDIENCE_LABEL, TIERS, TIER_LABEL, TIER_NAME, tierCanUseApis } from "@/shared/lib/tiers";
import type { AppDetailDto, AppType, CategoryDto, CommitteeMemberDto } from "@/shared/lib/types";
const ACTION_LABEL: Record<string, string> = { create: "Draft created", review: "Request submitted", update: "Updated", publish: "Approval / reactivation", unpublish: "Suspended" };
const ACTION_DOT: Record<string, string> = { create: "bg-teal", review: "bg-put", update: "bg-ink-faint", publish: "bg-post", unpublish: "bg-danger" };

function CredentialBlock({ appId, env, category, cred, isAdmin, emptyNote, onChanged }: {
  appId: number; env: "sandbox" | "production"; category: string; cred: { tokenId: string; tokenSecret: string } | undefined; isAdmin: boolean; emptyNote?: string; onChanged: () => void;
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
      {cred ? (
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
  const [isCommitteeReviewer, setIsCommitteeReviewer] = useState(false);
  const [repositoryDraft, setRepositoryDraft] = useState("");
  const [repositoryBusy, setRepositoryBusy] = useState(false);
  const [repositoryError, setRepositoryError] = useState("");
  const [tab, setTab] = useState("Overview");
  const [actionBusy, setActionBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<AppType>("tier1");

  const isAdmin = user?.roleKey === "admin";

  const load = useCallback(() => {
    setLoadError(false);
    api.get<AppDetailDto>(`/api/applications/${id}`).then((d) => {
      setDetail(d);
      setRepositoryDraft(d.summary.github && d.summary.github !== "-" ? d.summary.github.startsWith("https://") ? d.summary.github : `https://${d.summary.github}` : "");
      // Applications with API products default to Tier 2 because Tier 1 does not support APIs.
      const s = d.summary;
      setReviewTarget(s.status === "draft" && TIERS.includes(preferredTier as AppType) && (preferredTier !== "tier3" || isAdmin) && (preferredTier !== "tier1" || !s.products.length) ? preferredTier as AppType : s.products.length > 0 && !tierCanUseApis(s.type) ? "tier2" : s.type);
    }).catch(() => setLoadError(true));
    api.get<CategoryDto[]>("/api/categories").then(setCategories).catch(() => setCategories([]));
    api.get<CommitteeMemberDto[]>("/api/committee/members").then(members => setIsCommitteeReviewer(members.some(member => member.userId === user?.id))).catch(() => setIsCommitteeReviewer(false));
  }, [id, preferredTier, isAdmin, user?.id]);

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
        : "Automatically approved (Tier 1)",
    );
  const publish = () => run(() => api.post(`/api/applications/${id}/publish`), "Application reactivated");
  const unpublish = () => run(() => api.post(`/api/applications/${id}/unpublish`), "Application suspended and credentials disabled");

  const saveEdit = async (values: AppFormValues) => {
    try {
      await api.put(`/api/applications/${id}`, values);
      setEditing(false);
      toast({ tone: "success", message: "Changes saved" });
      load();
    } catch (err) {
      throw new Error(err instanceof ApiError ? err.message : "Unable to save", { cause: err });
    }
  };

  const approved = a.status === "active" || a.status === "suspended";
  const isOwner = a.ownerEmail.toLowerCase() === user?.email.toLowerCase();
  const canManage = isOwner && (!detail.development || detail.development.stage === "draft");
  const canReview = isAdmin || isCommitteeReviewer;
  const approvedVotes = detail.votes.filter((v) => v.approved && v.actorEmail && v.decidedAt).length;
  const codeReviewText = detail.codeReview ? (detail.codeReview.approved ? "Approved" : "Rejected") : "Not reviewed";
  // Sandbox: from IT preparation (development/review) onward. Production: only after approval.
  // Mirrors ApplicationWorkflow.CredentialAllowed; the backend checks this as well.
  const devStage = detail.development?.stage;
  const canManageProduction = isAdmin && a.status === "active" && tierCanUseApis(a.type);
  const canManageSandbox = canManageProduction || (isAdmin && a.products.length > 0 &&
    (devStage === "development" || devStage === "review") && tierCanUseApis(detail.development?.targetTier ?? a.type));
  const credentialNote =
    approved && !tierCanUseApis(a.type)
      ? "Tier 1 applications do not use APIs and have no credentials"
      : "Sandbox is issued when IT completes preparation; Production after approval";
  // One token per requested API (category) per environment — a token only works for its own API.
  const credOf = (env: "sandbox" | "production", category: string) =>
    detail.credentials.find((c) => c.env === env && c.category.toLowerCase() === category.toLowerCase());
  const credentialCategories = [...new Set(a.products.map((p) => p.trim().toLowerCase()).filter(Boolean))];

  const currentTier = detail.development?.targetTier ?? (a.status === "draft" ? reviewTarget : a.reviewTarget ?? a.type);
  const needsReview = tierCanUseApis(currentTier);
  const requiredVotes = detail.requiredVotes || 3;
  const statusCopy = a.status === "draft" ? "Check details and submit." : a.status === "pending" ? "IT and committee reviews are in progress." : a.status === "active" ? "Approved for deployment by IT." : "Contact IT to resume this request.";
  const repository = a.github && a.github !== "-" ? a.github : "";
  async function saveRepository(event: React.FormEvent) {
    event.preventDefault(); setRepositoryBusy(true); setRepositoryError("");
    try { await api.put(`/api/applications/${id}/repository`, {github:repositoryDraft.trim()}); toast({tone:"success",message:"Repository information saved by IT"}); load(); }
    catch(error) { setRepositoryError(error instanceof ApiError ? error.message : "Unable to save repository information"); }
    finally { setRepositoryBusy(false); }
  }
  return <div className="app-request-page">
    <header className="app-request-header"><div className="app-request-identity"><AppAvatar image={a.image} icon={a.icon} size="lg" /><div><span className="workspace-kicker">{isAdmin && !isOwner ? "IT request workspace" : canReview && !isOwner ? "Review workspace" : "Application request"} · #{a.id}</span><h1>{a.name}</h1><div className="app-request-badges">{detail.development && !["draft","approved"].includes(detail.development.stage) ? <Badge tone="info">{{setup:"IT preparation",development:"Development",review:"Deployment review"}[detail.development.stage] ?? detail.development.stage}</Badge> : <StatusDot status={a.status} />}<Badge tone="neutral">{isAdmin ? "IT administrator view" : isCommitteeReviewer && !isOwner ? "Committee reviewer view" : isOwner ? "Requester view" : "Read-only view"}</Badge><Badge tone="info">{TIER_LABEL[currentTier]} · {TIER_NAME[currentTier]}</Badge></div></div></div>{canManage && <Btn onClick={() => setEditing(value => !value)}>{editing ? "Cancel editing" : "Edit request"}</Btn>}</header>
    <DevelopmentRequestPanel key={`${a.id}-${a.updatedAt}`} detail={detail} onChanged={load} />
    {editing ? <AppForm title="Edit application" initialTier={currentTier} hint="Update the application details before continuing your request." initial={{name:a.name,description:a.description,subdomain:a.subdomain,github:a.github,products:a.products,image:a.image,icon:a.icon,screenshots:detail.screenshots,audience:a.audience}} categories={categories} submitLabel="Save changes" onSubmit={saveEdit} onCancel={()=>setEditing(false)} /> : <div className="app-request-layout"><main className="app-request-main">
      <Tabs label="Application request details" items={isAdmin && !detail.development ? ["Overview","IT preparation","Review","Activity"] : ["Overview","Review","Activity"]} value={tab} onChange={setTab} />
      {tab === "Overview" && <div className="app-request-tab-content"><Panel title="Application overview"><div className="app-request-purpose"><span>Purpose</span><p>{a.description || "No description provided."}</p></div><dl className="request-summary"><div><dt>Audience</dt><dd><AppIcon value="fa:users" /> {AUDIENCE_LABEL[a.audience]}</dd></div><div><dt>Requested tier</dt><dd>{TIER_LABEL[currentTier]} · {TIER_NAME[currentTier]}</dd></div><div><dt>Requested subdomain</dt><dd><code>{a.subdomain || "Not provided"}</code></dd></div><div><dt>Repository</dt><dd>{repository ? <a className="text-teal-strong" href={repository.startsWith("https://") ? repository : `https://${repository}`} target="_blank" rel="noopener noreferrer">{repository} <AppIcon value="fa:external-link" /></a> : <span className="text-ink-dim">To be provided by IT</span>}</dd></div></dl></Panel>
      <Panel title="Requested services"><div className="app-request-service-tags">{a.products.map(product=><ScopeTag key={product}>{categoryName(product)}</ScopeTag>)}{!a.products.length && <span className="text-sm text-ink-dim">Standalone application</span>}</div></Panel>
      {!!detail.screenshots.length && <ShotsGallery shots={detail.screenshots} />}
      {(isAdmin || isOwner) && <details className="app-request-credentials"><summary><span><AppIcon value="fa:lock" /> API credentials</span><span>View credentials <AppIcon value="fa:chevron-down" /></span></summary><Panel title="API credentials" hint="Each API has its own token — use the token that matches the API you call. Keep secrets private and never embed them in client code.">{credentialCategories.length ? credentialCategories.map(category=><section key={category} className="app-request-credential-service"><h3><ScopeTag>{categoryName(category)}</ScopeTag><code>{categories.find((c)=>c.key===category)?.basePath ?? `/api/v1/${category}`}</code></h3><div className="app-request-credential-grid"><CredentialBlock appId={a.id} env="sandbox" category={category} cred={credOf("sandbox", category)} isAdmin={canManageSandbox} emptyNote={credentialNote} onChanged={load} /><CredentialBlock appId={a.id} env="production" category={category} cred={credOf("production", category)} isAdmin={canManageProduction} emptyNote={credentialNote} onChanged={load} /></div></section>) : <p className="text-sm text-ink-dim">This application does not request any API.</p>}</Panel></details>}
      </div>}
      {tab === "IT preparation" && isAdmin && <Panel title="IT preparation"><div className="app-request-owned-note"><strong>Requested by {a.ownerEmail}</strong></div>{a.status === "draft" ? <p className="text-sm text-ink-dim mt-5">Awaiting requester submission.</p> : <form onSubmit={saveRepository} className="app-request-repository-form"><Field>Git repository URL<Input type="url" pattern="https://.*" placeholder="https://github.com/company/repository" value={repositoryDraft} onChange={event=>setRepositoryDraft(event.target.value)} /></Field>{repositoryError && <p role="alert" className="text-danger text-xs">{repositoryError}</p>}<Btn type="submit" variant="primary" loading={repositoryBusy}>Save repository</Btn></form>}</Panel>}
      {tab === "Review" && <div className="app-request-tab-content"><Panel title="Approval checkpoints" hint={a.status === "draft" ? "Not submitted yet" : "Approval for deployment"}>{!needsReview ? <div className="app-request-review-empty"><AppIcon value="fa:check" /><h3>Committee and IT review are not required</h3><p>Tier 1 requests are approved automatically when submitted.</p></div> : <div className="app-request-review-grid"><section className="request-checkpoint"><header><span className="request-checkpoint-icon"><AppIcon value="fa:users" /></span><h3>Committee review</h3><Badge tone={approvedVotes >= requiredVotes ? "success" : "neutral"}>{a.status === "draft" ? "Not started" : `${approvedVotes} / ${requiredVotes} approved`}</Badge></header>{a.status === "draft" ? <p className="review-note">Awaiting submission.</p> : <>{detail.votes.map(vote=><div className="review-member" key={vote.committeeMemberId}><div><strong>{vote.memberName}</strong><small>{vote.memberRoleTitle}</small>{vote.note && <p>{vote.note}</p>}</div><Badge tone={vote.approved && vote.actorEmail && vote.decidedAt ? "success" : "neutral"}>{vote.approved && vote.actorEmail && vote.decidedAt ? "Approved" : "Awaiting review"}</Badge></div>)}{!detail.votes.length && <p className="review-note">No committee decisions recorded yet.</p>}</>}</section><section className="request-checkpoint"><header><span className="request-checkpoint-icon"><AppIcon value="fa:code" /></span><h3>IT code review</h3><Badge tone={detail.codeReview?.approved ? "success" : "neutral"}>{a.status === "draft" ? "Not started" : codeReviewText}</Badge></header><p className="review-note">{detail.codeReview ? `Reviewed by ${detail.codeReview.reviewerEmail}` : "Awaiting IT review."}</p>{detail.codeReview?.note && <p className="review-note">{detail.codeReview.note}</p>}</section></div>}</Panel></div>}
      {tab === "Activity" && <Panel title="Request activity"><div className="app-request-activity">{detail.log.map((entry,index)=><div key={index}><span className={`app-request-activity-dot ${ACTION_DOT[entry.actionType] ?? "bg-teal"}`} /><div><strong>{ACTION_LABEL[entry.actionType] ?? entry.actionType}</strong><small>{new Date(entry.occurredAt).toLocaleString("en-GB")} · {entry.actor}</small>{entry.note && <p>{entry.note}</p>}</div></div>)}{!detail.log.length && <p className="text-sm text-ink-dim">No activity recorded yet.</p>}</div></Panel>}
    </main><aside className="app-request-aside">{!detail.development && !["draft"].includes(a.status) && <Panel className="app-request-next-step"><span className="workspace-kicker">{isAdmin && !isOwner ? "Your IT tasks" : canReview && !isOwner ? "Your review tasks" : isOwner ? "Next step" : "Request status"}</span><h2>{isAdmin && !isOwner ? a.status === "draft" ? "Awaiting submission" : "IT preparation" : canReview && !isOwner ? "Review this request" : a.status === "draft" ? "Prepare your request" : a.status === "pending" ? "Awaiting review" : a.status === "active" ? "Approved for deployment" : "Approval suspended"}</h2><p>{isAdmin && !isOwner ? a.status === "draft" ? "The requester is preparing this request." : "Add the repository and complete the IT review." : canReview && !isOwner ? "Review the request and record your decision." : !isOwner ? "Read-only request details." : statusCopy}</p>{isAdmin && !isOwner && <div className="app-request-admin-actions"><Btn variant="primary" disabled={a.status === "draft"} onClick={()=>setTab("IT preparation")}>Manage repository</Btn>{a.status === "pending" && <Btn onClick={()=>navigate("/reviews")}>Review request</Btn>}</div>}{isCommitteeReviewer && !isAdmin && !isOwner && <Btn variant="primary" onClick={()=>navigate("/reviews")}>Open review workbench</Btn>}{canManage && (a.status === "draft" || a.status === "suspended") && <div className="app-request-submit"><label htmlFor="request-review-tier">Requested tier</label><Select id="request-review-tier" value={reviewTarget} disabled={actionBusy} onChange={event=>setReviewTarget(event.target.value as AppType)}>{TIERS.map(tier=><option key={tier} value={tier} disabled={(!tierCanUseApis(tier) && a.products.length > 0) || (tier === "tier3" && !isAdmin)}>{TIER_LABEL[tier]} · {TIER_NAME[tier]}</option>)}</Select><p>{tierCanUseApis(reviewTarget) ? "3 committee approvals + IT code review" : "Automatic approval"}</p><Btn variant="primary" loading={actionBusy} onClick={sendReview}>Submit for review <AppIcon value="fa:arrow-right" /></Btn></div>}{isOwner && a.status === "pending" && <Btn onClick={()=>setTab("Review")}>View review progress</Btn>}{isAdmin && a.status === "active" && <Btn size="sm" danger disabled={actionBusy} onClick={unpublish}>Suspend application</Btn>}{isAdmin && a.status === "suspended" && <Btn disabled={actionBusy} onClick={publish}>Reactivate approval</Btn>}</Panel>}
      <Panel title="Request information"><dl className="app-request-owner"><div><dt>Requested by</dt><dd>{a.ownerEmail}</dd></div><div><dt>Created</dt><dd>{a.createdAt.slice(0,10)}</dd></div><div><dt>Last updated</dt><dd>{a.updatedAt.slice(0,10)}</dd></div></dl></Panel>
    </aside></div>}
  </div>;
}
