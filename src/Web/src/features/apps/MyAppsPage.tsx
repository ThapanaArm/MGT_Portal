import { AppIcon } from "@/shared/components/Icon";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { api } from "@/shared/lib/api";
import { useToast } from "@/shared/lib/toast";
import { Btn, EmptyState, TypeChip, StatusDot, ScopeTag } from "@/shared/components/ui";
import { Badge, Dialog, Skeleton, Tabs } from "@/shared/components/design-system";
import { Alert } from "@/shared/components/feedback";
import { AppAvatar } from "@/shared/components/MediaPickers";
import AppForm, { AppFormValues } from "@/features/apps/AppForm";
import type { AppSummaryDto, AppType, CategoryDto } from "@/shared/lib/types";

const STATUS_TABS = { "All": null, "Draft": "draft", "IT preparation": "setup", "Development": "development", "Under review": "pending", "Approved": "active", "Suspended": "suspended" } as const;

const requestStatus = (app: AppSummaryDto) => ["setup","development"].includes(app.processStage ?? "") ? app.processStage : app.status;
const EMPTY: AppFormValues = { name: "", description: "", subdomain: "", github: "", products: [], image: null, icon: "fa:box", screenshots: [], audience: "self" };

export default function MyAppsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [statusTab, setStatusTab] = useState("All");
  const [apps, setApps] = useState<AppSummaryDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [showForm, setShowForm] = useState(searchParams.get("new") === "1");
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<AppSummaryDto | null>(null);
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
    setShowForm(false);
    toast({ tone: "success", message: "Draft saved. Review the request summary before submitting." });
    navigate(`/my-apps/${draft.id}${tier ? `?tier=${tier}` : ""}`);
  };

  return (
    <div>
      <div className="portal-page-heading portal-heading-with-action mb-3.5">
        <div className="flex items-center gap-2 text-[13.5px] uppercase tracking-wide text-ink-faint font-bold mb-1.5">
          <span className="w-2 h-2 rounded-sm bg-teal" /> My App
        </div>
        <h1 className="text-[26px] font-bold">My Applications</h1>
        <p className="text-ink-dim text-[16px] mt-1.5 max-w-[62ch] leading-relaxed">
          Applications registered with MGT Hub, including their status and trust level (Application
          Type)
        </p>
        <div className="mt-3.5">
          <Btn variant="primary" onClick={() => setShowForm((s) => !s)}>
            <AppIcon value={showForm ? "fa:close" : "fa:plus"} /> {showForm ? "Cancel" : "Register application"}
          </Btn>
        </div>
      </div>

      {!showForm && !loading && !loadError && apps.length > 0 && <Tabs label="Application request status" items={Object.keys(STATUS_TABS)} value={statusTab} onChange={setStatusTab} renderLabel={label=><>{label}<span className="mgt-tab-count">{apps.filter(app=>!STATUS_TABS[label as keyof typeof STATUS_TABS] || requestStatus(app)===STATUS_TABS[label as keyof typeof STATUS_TABS]).length}</span></>} />}
      {showForm ? (
        <AppForm
          title="Register application"
          hint="Enter your application details. New applications start as drafts; select a tier when submitting for review."
          initial={EMPTY}
          categories={categories}
          submitLabel="Save request draft"
          onSubmit={create}
          onCancel={() => setShowForm(false)}
        />
      ) : loading ? (
        <Skeleton rows={5} />
      ) : loadError ? (
        <Alert tone="danger" title="Unable to load your applications"><p>Please try again to reconnect to your workspace.</p><Btn onClick={load}>Try again</Btn></Alert>
      ) : apps.length === 0 ? (
        <EmptyState title="Build your next application" description="Register an application to manage its API access, review status, and credentials in one place." action={<Btn variant="primary" onClick={() => setShowForm(true)}>Register application</Btn>} />
      ) : (
        <div className="portal-table-frame">
          <table className="w-full min-w-[820px] border-collapse text-[15px]">
            <thead>
              <tr>
                {["Application", "Type", "Status", "API Products", "Created", "Updated", ""].map((h) => (
                  <th key={h} className="text-left text-ink-faint text-[13px] uppercase tracking-wide font-bold px-3.5 py-2.5 border-b border-line whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleApps.map((a) => (
                <tr key={a.id} onClick={() => navigate(`/my-apps/${a.id}`)} className="cursor-pointer hover:bg-surface-2">
                  <td className="px-3.5 py-3 border-b border-line">
                    <div className="flex items-center gap-2.5">
                      <AppAvatar image={a.image} icon={a.icon} size="sm" />
                      <div>
                        <b className="block text-[15.5px]">{a.name}</b>
                        <span className="block font-mono text-[13.5px] text-ink-faint">{a.subdomain}.megachem.co.th</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3.5 py-3 border-b border-line"><TypeChip type={a.type} /></td>
                  <td className="px-3.5 py-3 border-b border-line">{a.processStage && a.processStage !== "draft" ? <Badge tone={a.processStage === "approved" ? "success" : "info"}>{{setup:"IT preparation",development:"Development",review:"Deployment review",approved:"Approved"}[a.processStage] ?? a.processStage}</Badge> : <StatusDot status={a.status} />}</td>
                  <td className="px-3.5 py-3 border-b border-line">
                    <div className="flex gap-1 flex-wrap">
                      {a.products.map((p) => (
                        <ScopeTag key={p}>{categoryName(p)}</ScopeTag>
                      ))}
                    </div>
                  </td>
                  <td className="px-3.5 py-3 border-b border-line font-mono text-[14px] text-ink-dim whitespace-nowrap">{a.createdAt.slice(0, 10)}</td>
                  <td className="px-3.5 py-3 border-b border-line font-mono text-[14px] text-ink-dim whitespace-nowrap">{a.updatedAt.slice(0, 10)}</td>
                  <td className="px-3.5 py-3 border-b border-line whitespace-nowrap"><Btn size="sm" onClick={event => { event.stopPropagation(); setPreview(a); }}>Preview</Btn></td>
                </tr>
              ))}
              {!visibleApps.length && <tr><td colSpan={7}><EmptyState title="No requests with this status" description="Choose another status to see your application requests." action={<Btn onClick={()=>setStatusTab("All")}>View all requests</Btn>} /></td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <Dialog drawer open={!!preview} title={preview?.name ?? "Application preview"} onClose={() => setPreview(null)} footer={preview && <Btn variant="primary" onClick={() => navigate(`/my-apps/${preview.id}`)}>Open application details <AppIcon value="fa:external-link"/></Btn>}>
        {preview && <div className="workspace-preview"><AppAvatar image={preview.image} icon={preview.icon} /><div className="flex flex-wrap gap-2"><TypeChip type={preview.type} /><StatusDot status={preview.status} /></div><p>{preview.description}</p><dl><div><dt>Subdomain</dt><dd>{preview.subdomain}.megachem.co.th</dd></div><div><dt>Created</dt><dd>{preview.createdAt.slice(0, 10)}</dd></div><div><dt>Updated</dt><dd>{preview.updatedAt.slice(0, 10)}</dd></div></dl><div className="flex gap-2 flex-wrap">{preview.products.map(product => <ScopeTag key={product}>{categoryName(product)}</ScopeTag>)}</div></div>}
      </Dialog>
    </div>
  );
}
