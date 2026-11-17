import { Input, Select, Skeleton } from "@/shared/components/design-system";
import AppsIllustration from "@/shared/components/AppsIllustration";
import OrbitIllustration from "@/shared/components/OrbitIllustration";

/** Shown on the light-theme orbit until there are at least three approved apps. */
const SAMPLE_APPS = [
  { icon: "fa:chart-column", label: "Reports" }, { icon: "fa:truck", label: "Shipping" }, { icon: "fa:flask", label: "Lab" },
  { icon: "fa:users", label: "People" }, { icon: "fa:warehouse", label: "Inventory" },
];
import { AppIcon } from "@/shared/components/IconPicker";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { api } from "@/shared/lib/api";
import { useLocale } from "@/shared/lib/locale-context";
import { Btn, EmptyState, ScopeTag, TypeChip } from "@/shared/components/ui";
import { Alert } from "@/shared/components/feedback";
import { AppAvatar } from "@/shared/components/MediaPickers";
import { Carousel } from "@/shared/components/Carousel";
import type { AppSummaryDto, CategoryDto } from "@/shared/lib/types";

export default function EcosystemPage() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const [apps, setApps] = useState<AppSummaryDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState<"updated" | "name">("updated");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([api.get<AppSummaryDto[]>("/api/applications?catalog=true"), api.get<CategoryDto[]>("/api/categories")])
      .then(([applications, products]) => { if (active) { setApps(applications); setCategories(products); } })
      .catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  const retry = () => { setLoading(true); setError(false); setAttempt(value => value + 1); };
  const categoryName = (key: string) => categories.find(category => category.key === key)?.name ?? key;
  const highlight = useMemo(() => [...apps.filter(app => app.type === "tier3"), ...apps.filter(app => app.type !== "tier3")].slice(0, 4), [apps]);
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return apps.filter(app => (cat === "all" || app.products.includes(cat)) && (!search || `${app.name} ${app.description}`.toLowerCase().includes(search)))
      .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : b.updatedAt.localeCompare(a.updatedAt));
  }, [apps, cat, query, sort]);
  return <div>
    <section className="ecosystem-hero ecosystem-welcome relative overflow-hidden">
      <div className="relative max-w-[620px]">
        <span className="workspace-kicker"><AppIcon value="fa:globe" /> Connected by MGT</span>
        <h1>{t("ecosystem.title")}</h1><p>{t("ecosystem.desc")}</p>
        <div className="flex gap-3 flex-wrap mt-6">
          <button onClick={() => navigate("/my-apps?new=1")} className="bg-[#89c64a] text-[#10210b] rounded-lg px-4 py-2.5 font-bold transition hover:-translate-y-px">{t("ecosystem.registerApp")} <span aria-hidden="true"><AppIcon value="fa:external-link"/></span></button>
        </div>
      </div>
      {/* Dark theme: app launcher illustration · Light theme: apps orbiting the MGT hub */}
      <div className="hero-art">
        <AppsIllustration className="ecosystem-illustration hero-art-dark" count={loading || error ? undefined : apps.length} />
        <OrbitIllustration className="hero-art-light" hub="fa:globe" compact items={apps.length >= 3 ? apps.map(app => ({ icon: app.icon, label: app.name })) : SAMPLE_APPS} />
      </div>
    </section>
    {loading ? <Skeleton rows={3} /> : error ? <Alert tone="danger" title="Unable to load the application catalog"><p>Please try again to reconnect to your workspace.</p><Btn onClick={retry}>Try again</Btn></Alert> : <>
      <div className="ecosystem-stats">
        <div className="ecosystem-stat"><AppIcon value="fa:box" /><div><strong>{apps.length}</strong><small>Approved applications</small></div></div>
        <div className="ecosystem-stat"><AppIcon value="fa:globe" /><div><strong>{categories.length}</strong><small>API categories</small></div></div>
        <div className="ecosystem-stat"><AppIcon value="fa:code" /><div><strong>{categories.reduce((sum, category) => sum + category.endpointCount, 0)}</strong><small>API endpoints</small></div></div>
      </div>
      {!!highlight.length && <div className="ecosystem-highlights">
        <div className="workspace-section-title"><h2>{t("ecosystem.highlight")}</h2></div>
        <Carousel label={t("ecosystem.highlight")} variant="centered" slides={highlight.map(app => {
          const category = app.products[0];
          const card = <>
            <div className="ecosystem-feature-art" data-category={category} aria-hidden="true">
              <div className="ecosystem-feature-mark" data-has-logo={Boolean(app.image)}>
                {app.image ? <img src={app.image} alt="" /> : <AppIcon value={app.icon} />}
              </div>
            </div>
            <div className="ecosystem-feature-copy">
              <TypeChip type={app.type} />
              <strong>{app.name}</strong>
              <span>{category ? categoryName(category) : "Standalone application"}</span>
            </div>
          </>;
          return {
            id: String(app.id),
            title: app.name,
            content: <Link to={`/ecosystem/${app.id}`} className="ecosystem-card">{card}</Link>,
            preview: <div className="ecosystem-card">{card}</div>,
          };
        })} />
      </div>}
      <section aria-labelledby="all-apps">
        <div className="workspace-section-title"><h2 id="all-apps">{t("ecosystem.exploreApps")}</h2><span role="status">{filtered.length} applications</span></div>
        <div className="workspace-filterbar">
          <div className="workspace-search"><AppIcon value="fa:search" /><Input aria-label="Search applications" value={query} onChange={event => setQuery(event.target.value)} placeholder={t("ecosystem.searchPlaceholder")} />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><AppIcon value="fa:close"/></button>}</div>
          <Select aria-label="Sort applications" value={sort} onChange={event => setSort(event.target.value as "updated" | "name")}><option value="updated">{t("ecosystem.sortUpdated")}</option><option value="name">{t("ecosystem.sortName")}</option></Select>
        </div>
        <div className="workspace-filter-chips" role="group" aria-label="Filter by API category"><button aria-pressed={cat === "all"} onClick={() => setCat("all")}>{t("ecosystem.all")}</button>{categories.map(category => <button key={category.key} aria-pressed={cat === category.key} onClick={() => setCat(category.key)}>{category.name}</button>)}</div>
        {filtered.length ? <div className="ecosystem-app-grid">{filtered.map(app => <Link key={app.id} to={`/ecosystem/${app.id}`} className="ecosystem-card">
          <div className="ecosystem-card-heading"><AppAvatar image={app.image} icon={app.icon} /><div><strong>{app.name}</strong><TypeChip type={app.type} /></div></div>
          <p className="ecosystem-card-description">{app.description}</p><div className="flex gap-1 flex-wrap">{app.products.map(product => <ScopeTag key={product}>{categoryName(product)}</ScopeTag>)}</div>
          <div className="ecosystem-card-footer"><span>Updated {app.updatedAt.slice(0, 10)}</span><span className="ecosystem-card-arrow">View app <span aria-hidden="true"><AppIcon value="fa:external-link"/></span></span></div>
        </Link>)}</div> : <EmptyState title={apps.length ? "No matching applications" : "Your ecosystem starts here"} description={apps.length ? "Try a different keyword or clear the category filter." : "Published applications will appear here when they are ready to use."} action={apps.length ? <Btn onClick={() => { setQuery(""); setCat("all"); }}>Clear filters</Btn> : <Btn variant="primary" onClick={() => navigate("/my-apps?new=1")}>Register application</Btn>} />}
      </section>
    </>}
  </div>;
}
