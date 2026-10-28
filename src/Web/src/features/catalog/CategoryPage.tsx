import { Input, Tabs } from "@/shared/components/design-system";
import { CopyButton } from "@/shared/components/CopyButton";
import { AppIcon } from "@/shared/components/IconPicker";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { api } from "@/shared/lib/api";
import { useEnv } from "@/features/catalog/env-context";
import AiCopyButton from "@/features/catalog/components/AiCopyButton";
import { buildCategoryMarkdown } from "@/features/catalog/aiSpec";
import { gatewayOrigin, isLiveEndpoint, CATEGORY_SPECS } from "@/features/catalog/gateway";
import { useAudience } from "@/features/catalog/audience-context";
import AudienceToggle from "@/features/catalog/components/AudienceToggle";
import CatalogServiceTable from "@/features/catalog/components/CatalogServiceTable";
import { EmptyRow } from "@/shared/components/ui";
import { Alert } from "@/shared/components/feedback";
import type { CategoryDto, EndpointDto } from "@/shared/lib/types";

const CATEGORY_ICONS: Record<string, string> = { sales: "fa:chart-line", purchase: "fa:credit-card", inventory: "fa:box", finance: "fa:receipt", hr: "fa:users" };
export default function CategoryPage() {
  const { category: key = "" } = useParams();
  const { env, setEnv } = useEnv();
  const { audience } = useAudience();
  const [category, setCategory] = useState<CategoryDto | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointDto[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) { setLoading(true); setError(false); setQuery(""); } });
    Promise.all([api.get<CategoryDto[]>("/api/categories"), api.get<EndpointDto[]>(`/api/categories/${key}/endpoints`)])
      .then(([cats, eps]) => { if (active) { setCategory(cats.find(cat => cat.key === key) ?? null); setEndpoints(eps); } })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [key]);
  const filtered = useMemo(() => endpoints.filter(endpoint => `${endpoint.path} ${endpoint.summary} ${endpoint.scenario} ${endpoint.sourcePlatform ?? ""}`.toLowerCase().includes(query.toLowerCase())), [endpoints, query]);
  if (loading) return <div className="text-ink-faint">Loading services...</div>;
  if (error) return <Alert tone="danger" title="Unable to load services">Please refresh the page to try again.</Alert>;
  if (!category) return <EmptyRow>Category not found</EmptyRow>;
  const perMinute = category.rateLimit.match(/\d+/)?.[0];
  const liveCount = endpoints.filter(endpoint => isLiveEndpoint(category.key, endpoint.method, endpoint.path)).length;
  const baseUrl = `${gatewayOrigin()}${category.basePath}`;
  const specs = CATEGORY_SPECS[category.key] ?? [];
  return <div className="catalog-category-page">
    <div className="category-topline"><span className="workspace-kicker">Company API Catalog</span><div className="category-topline-controls">{audience === "developer" && <><div className="audience-toolbar"><Tabs label="Environment" items={["Sandbox", "Production"]} value={env === "sandbox" ? "Sandbox" : "Production"} onChange={value => setEnv(value === "Sandbox" ? "sandbox" : "production")} /></div><span className="category-topline-divider" aria-hidden="true" /></>}<AudienceToggle className="" /></div></div>
    <header className="category-hero">
      <div className="category-hero-icon"><AppIcon value={CATEGORY_ICONS[category.key] ?? "fa:box"} /></div>
      <div className="category-hero-copy"><span className="category-eyebrow">Explore services</span><h1>{category.name}</h1><p>{category.description}</p><div className="category-hero-tags">{liveCount > 0 ? <span><AppIcon value="fa:globe" /> Live via MGT Gateway</span> : <span><AppIcon value="fa:flask" /> Documentation only</span>}{perMinute && <span>{perMinute} requests / minute</span>}</div></div>
      <div className="category-hero-count"><strong>{endpoints.length}</strong><span>Available APIs</span></div>
    </header>
    {audience === "developer" && <div className="category-developer-meta"><div className="category-base-url"><span>Base URL</span><code>{baseUrl}</code><CopyButton value={baseUrl} label="Copy URL" /></div>{env === "production" ? <p className="category-env-warning"><AppIcon value="fa:warning" /> Production — API calls affect live company data. Use a production token.</p> : <p className="category-env-warning"><AppIcon value="fa:info" /> Sandbox — use a sandbox token; requests reach test systems (SAP DEV).</p>}</div>}
    <section className="category-services">
      <div className="category-list-heading"><div><h2>Available services</h2><p>Choose a service to explore its details and sample data.</p></div><span>{filtered.length} of {endpoints.length} services</span></div>
      <div className="category-searchbar"><div className="category-search-input"><AppIcon value="fa:search" /><Input value={query} onChange={event => setQuery(event.target.value)} aria-label="Search services" placeholder={audience === "business" ? "Search services or use cases..." : "Search endpoints, paths, descriptions..."} className="w-full" /></div></div>
      {liveCount > 0 && <div className="category-ai-bar"><AiCopyButton text={() => buildCategoryMarkdown(category, endpoints)} label="Copy all for AI" size="md" /><p>Copies every {category.name} API with the rules, cURL and JSON examples as one Markdown brief — paste it into Claude to build your app.</p>{specs.map(spec => <a key={spec.path} href={`${gatewayOrigin()}${spec.path}`} target="_blank" rel="noreferrer"><AppIcon value="fa:external-link" /> {spec.label}</a>)}</div>}
      <CatalogServiceTable category={category} endpoints={filtered} />
    </section>
  </div>;
}
