import { useEditingGuard } from "@/shared/lib/editing-guard";
import { AppIcon } from "@/shared/components/Icon";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { api } from "@/shared/lib/api";
import { useToast } from "@/shared/lib/toast";
import { Btn, EmptyState, TypeChip } from "@/shared/components/ui";
import { Badge, Skeleton, Tabs } from "@/shared/components/design-system";
import { Alert } from "@/shared/components/feedback";
import { AppAvatar } from "@/shared/components/MediaPickers";
import AppForm, { AppFormValues } from "@/features/apps/AppForm";
import type { AppSummaryDto, AppType, CategoryDto } from "@/shared/lib/types";
import { TIER_NAME, appDomain, normalizeTier } from "@/shared/lib/tiers";

const STATUS_TABS = { "All": null, "Draft": "draft", "IT preparation": "setup", "Development": "development", "Changes requested": "changes", "Under review": "pending", "Awaiting deployment": "awaiting-deployment", "Deployed": "deployed", "Live": "live", "Approved": "active", "Suspended": "suspended" } as const;

const requestStatus = (app: AppSummaryDto) => ["setup","development","changes","awaiting-deployment","deployed","live"].includes(app.processStage ?? "") ? app.processStage : app.status;
/** One readable status per request: the process stage when it has one, otherwise the approval status. */
const STATUS_LABEL: Record<string, { text: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  draft: { text: "Draft", tone: "neutral" }, setup: { text: "IT preparation", tone: "info" }, development: { text: "Development", tone: "info" },
  changes: { text: "Changes requested", tone: "warning" }, review: { text: "Under review", tone: "info" }, pending: { text: "Under review", tone: "info" },
  "awaiting-deployment": { text: "Awaiting deployment", tone: "info" }, deployed: { text: "Deployed", tone: "info" }, live: { text: "Live", tone: "success" },
  approved: { text: "Approved", tone: "success" }, active: { text: "Approved", tone: "success" }, suspended: { text: "Suspended", tone: "danger" },
};
const statusOf = (app: AppSummaryDto) => STATUS_LABEL[app.processStage && app.processStage !== "draft" ? app.processStage : app.status] ?? { text: app.status, tone: "neutral" as const };
const ago = (iso: string) => {
  const days = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000));
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  return days < 30 ? format.format(-days, "day") : days < 365 ? format.format(-Math.round(days / 30), "month") : format.format(-Math.round(days / 365), "year");
};
const EMPTY: AppFormValues = { name: "", description: "", subdomain: "", github: "", products: [], image: null, icon: "fa:box", screenshots: [], audience: "self" };

export default function MyAppsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [statusTab, setStatusTab] = useState("All");
  const [apps, setApps] = useState<AppSummaryDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [showForm, setShowForm] = useState(searchParams.get("new") === "1");
  const { requestExit, complete } = useEditingGuard(showForm);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError(false);
    Promise.all([api.get<AppSummaryDto[]>("/api/applications"), api.get<CategoryDto[]>("/api/categories")])
      .then(([a, c]) => {
        setApps(a);
        setCategories(c);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    queueMicrotask(load);
  }, []);

  const visibleApps = apps.filter(app => !STATUS_TABS[statusTab as keyof typeof STATUS_TABS] || requestStatus(app) === STATUS_TABS[statusTab as keyof typeof STATUS_TABS]);
  const categoryName = (key: string) => categories.find((c) => c.key === key)?.name ?? key;

  const create = async (values: AppFormValues, tier?: AppType) => {
    const draft = await api.post<AppSummaryDto>("/api/applications", values);
    if (tier) await api.put(`/api/applications/${draft.id}/development-access`, { targetTier: tier, emails: [draft.ownerEmail] });
    setShowForm(false);
    toast({ tone: "success", message: "Draft saved. Review the request summary before submitting." });
    complete(() => navigate(`/my-apps/${draft.id}${tier ? `?tier=${tier}` : ""}`));
  };

  return (
    <div>
      <div className="portal-page-heading portal-heading-with-action mb-3.5">
        <div className="flex items-center gap-2 text-[13.5px] uppercase tracking-wide text-ink-faint font-bold mb-1.5">
          <span className="w-2 h-2 rounded-sm bg-teal" /> My App
        </div>
        <h1 className="text-[26px] font-bold">My Applications</h1>
        <p className="text-ink-dim text-[16px] mt-1.5 max-w-[62ch] leading-relaxed">Your requests and where each one is.</p>
        <div className="mt-3.5">
          <Btn variant="primary" onClick={() => showForm ? requestExit(() => setShowForm(false)) : setShowForm(true)}>
            <AppIcon value={showForm ? "fa:close" : "fa:plus"} /> {showForm ? "Cancel" : "Register application"}
          </Btn>
        </div>
      </div>

      {!showForm && !loading && !loadError && apps.length > 0 && <Tabs label="Application request status" items={Object.keys(STATUS_TABS).filter(label => label === "All" || label === statusTab || apps.some(app => requestStatus(app) === STATUS_TABS[label as keyof typeof STATUS_TABS]))} value={statusTab} onChange={setStatusTab} renderLabel={label=><>{label}<span className="mgt-tab-count">{apps.filter(app=>!STATUS_TABS[label as keyof typeof STATUS_TABS] || requestStatus(app)===STATUS_TABS[label as keyof typeof STATUS_TABS]).length}</span></>} />}
      {showForm ? (
        <AppForm
          title="Register application"
          hint="Enter your application details. New applications start as drafts; select a tier when submitting for review."
          initial={EMPTY}
          categories={categories}
          submitLabel="Save request draft"
          onSubmit={create}
          onCancel={() => requestExit(() => setShowForm(false))}
        />
      ) : loading ? (
        <Skeleton rows={5} />
      ) : loadError ? (
        <Alert tone="danger" title="Unable to load your applications"><p>Please try again to reconnect to your workspace.</p><Btn onClick={load}>Try again</Btn></Alert>
      ) : apps.length === 0 ? (
        <EmptyState title="Build your next application" description="Register an application to manage its API access, review status, and credentials in one place." action={<Btn variant="primary" onClick={() => setShowForm(true)}>Register application</Btn>} />
      ) : (
        <div className="portal-panel app-list app-request-list" role="list" aria-label="Application requests">
          <div className="app-list-head" aria-hidden="true"><span>Application</span><span>Owner</span><span>Tier</span><span>Status</span><span>Updated</span><span /></div>
          {visibleApps.map((a) => {
            const status = statusOf(a);
            const tier = normalizeTier(a.requestedTier) ?? normalizeTier(a.type) ?? "tier1";
            const domain = appDomain(a.subdomain);
            const products = a.products.map(categoryName).join(", ");
            return <button key={a.id} type="button" role="listitem" className="app-list-row" onClick={() => navigate(`/my-apps/${a.id}`)}>
              <span className="app-list-app"><AppAvatar image={a.image} icon={a.icon} size="sm" /><span><strong>{a.name}</strong><small>{[domain, products].filter(Boolean).join(" · ") || "No domain or APIs yet"}</small></span></span>
              <span className="app-list-owner" aria-label={`Owner: ${a.ownerDisplayName || a.ownerEmail}`}><strong>{a.ownerDisplayName || a.ownerEmail}</strong>{a.ownerDisplayName && a.ownerDisplayName !== a.ownerEmail && <small>{a.ownerEmail}</small>}</span>
              <span className="app-list-tier"><TypeChip type={tier} /><small>{TIER_NAME[tier]}{a.requestedTier ? " · requested" : ""}</small></span>
              <span><Badge tone={status.tone}>{status.text}</Badge></span>
              <span className="app-list-date" title={`Updated ${a.updatedAt.slice(0, 10)} · Created ${a.createdAt.slice(0, 10)}`}>{ago(a.updatedAt)}</span>
              <AppIcon value="fa:chevron-right" className="app-list-chevron" />
            </button>;
          })}
          {!visibleApps.length && <EmptyState title="No requests with this status" description="Choose another status to see your application requests." action={<Btn onClick={()=>setStatusTab("All")}>View all requests</Btn>} />}
        </div>
      )}
    </div>
  );
}

