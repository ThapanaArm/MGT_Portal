import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/shared/lib/auth";
import { api } from "@/shared/lib/api";
import { Btn, EmptyState, Panel, StatusDot, TypeChip } from "@/shared/components/ui";
import { Skeleton, Stat } from "@/shared/components/design-system";
import { Alert } from "@/shared/components/feedback";
import { AppIcon } from "@/shared/components/Icon";
import type { AppSummaryDto, CategoryDto, CommitteeMemberDto } from "@/shared/lib/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [apps, setApps] = useState<AppSummaryDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [queue, setQueue] = useState<AppSummaryDto[]>([]);
  const [reviewer, setReviewer] = useState(false);
  const [reviewError, setReviewError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([api.get<AppSummaryDto[]>("/api/applications"), api.get<CategoryDto[]>("/api/categories"), api.get<CommitteeMemberDto[]>("/api/committee/members")]).then(async ([applications, catalog, members]) => {
      if (!active) return;
      setApps(applications.filter(app => app.ownerEmail.toLowerCase() === user?.email.toLowerCase())); setCategories(catalog);
      const canReview = user?.roleKey === "admin" || members.some(member => member.userId === user?.id); setReviewer(canReview);
      if (canReview) { try { const pending = await api.get<AppSummaryDto[]>("/api/applications/review-queue"); if (active) setQueue(pending); } catch { if (active) setReviewError(true); } }
    }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id, user?.email, user?.roleKey, attempt]);
  const refresh = () => { setLoading(true); setError(false); setReviewError(false); setAttempt(value => value + 1); };
  return <div>
    <div className="portal-page-heading"><span className="workspace-kicker">MGT Portal</span><div className="workspace-section-title"><h1>Dashboard</h1><Btn size="sm" startIcon={<AppIcon value="fa:rotate" />} onClick={refresh}>Refresh</Btn></div><p className="text-sm text-ink-dim">Your application requests, review tasks, and next steps in one place.</p></div>
    <section className="workspace-welcome"><div><span className="workspace-kicker">From idea to approved request</span><h2>Build for your team.</h2><p>Find company services, register your application, and follow its approval. Deployment is handled by IT outside the Portal.</p></div><Btn variant="primary" startIcon={<AppIcon value="fa:plus" />} onClick={() => navigate("/my-apps?new=1")}>Create application request</Btn></section>
    {loading ? <Skeleton rows={5} /> : error ? <Alert tone="danger" title="Unable to load your dashboard"><Btn onClick={refresh}>Try again</Btn></Alert> : <>
      <section className="portal-dashboard-metrics" aria-label="My application request counts">{[{ status: "draft", label: "Draft requests", hint: "Prepare or revise before submitting" }, { status: "pending", label: "Under review", hint: "Awaiting committee and IT decisions" }, { status: "active", label: "Approved requests", hint: "Approval does not confirm deployment" }, { status: "suspended", label: "Suspended", hint: "Review with your administrator" }].map(item => <Stat key={item.status} label={item.label} value={String(apps.filter(app => app.status === item.status).length)} hint={item.hint} />)}</section>
      <div className="portal-dashboard-grid"><Panel title="My recent requests" hint="Your own application requests, ordered by latest update.">{apps.length ? <div className="dashboard-request-list">{apps.slice(0, 5).map(app => <Link to={`/my-apps/${app.id}`} key={app.id}><span><strong>{app.name}</strong><small>Updated {app.updatedAt.slice(0, 10)} · {app.status === "pending" ? "Requested " : ""}<TypeChip type={app.reviewTarget ?? app.type} /></small></span><StatusDot status={app.status} /><AppIcon value="fa:chevron-right" /></Link>)}</div> : <EmptyState title="Start with an application idea" description="Save a draft, choose who can use the app, then submit the request for the appropriate tier." action={<Btn onClick={() => navigate("/my-apps?new=1")}>Create your first request</Btn>} />}<div className="mt-4"><Btn onClick={() => navigate("/my-apps")}>View all my requests</Btn></div></Panel>
      <div>{reviewer && <Panel title="Review workbench" hint="Work available to your committee or administrator account.">{reviewError ? <Alert tone="warning">Unable to load review tasks. Open the review workbench to retry.</Alert> : <><strong className="dashboard-review-count">{queue.length}</strong><p className="review-note">Requests awaiting approval gates. Decisions are recorded under each reviewer's own account.</p></>}<Btn variant="primary" onClick={() => navigate("/reviews")}>Open requests and reviews</Btn></Panel>}<Panel title="Company services" hint="Explore available services before preparing your request."><dl className="request-summary"><div><dt>Business categories</dt><dd>{categories.length}</dd></div><div><dt>Catalog endpoints</dt><dd>{categories.reduce((sum, category) => sum + category.endpointCount, 0)}</dd></div></dl><div className="flex gap-2 flex-wrap mt-4"><Btn onClick={() => navigate("/explore")}>Browse API Catalog</Btn><Btn onClick={() => navigate("/getting-started")}>Request guide</Btn></div></Panel></div></div>
    </>}
  </div>;
}
