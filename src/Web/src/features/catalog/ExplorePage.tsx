import { Input, Select } from "@/shared/components/design-system";
import { AppIcon } from "@/shared/components/IconPicker";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/shared/lib/api";
import AudienceToggle from "@/features/catalog/components/AudienceToggle";
import EndpointCard from "@/features/catalog/components/EndpointCard";
import { EmptyRow } from "@/shared/components/ui";
import type { CategoryDto, EndpointDto } from "@/shared/lib/types";

const CATEGORY_ICONS: Record<string, string> = {
  sales: "fa:chart-line",
  purchase: "fa:credit-card",
  inventory: "fa:box",
  finance: "fa:receipt",
  hr: "fa:users",
};

const SUGGESTIONS = ["Sales", "Invoices", "Stock", "Purchase order approval", "Leave requests", "Payroll", "Customers"];

export default function ExplorePage() {
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [endpoints, setEndpoints] = useState<EndpointDto[]>([]);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [platform, setPlatform] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<CategoryDto[]>("/api/categories"),
      api.get<EndpointDto[]>("/api/categories/endpoints"),
    ])
      .then(([cats, eps]) => {
        setCategories(cats);
        setEndpoints(eps);
      })
      .finally(() => setLoading(false));
  }, []);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const platforms = useMemo(() => [...new Set(endpoints.map(endpoint => endpoint.sourcePlatform?.trim()).filter((name): name is string => !!name))].sort(), [endpoints]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return endpoints.filter((e) => {
      const cat = catById.get(e.categoryId);
      if (platform !== "all" && (e.sourcePlatform?.trim() || "unspecified") !== platform) return false;
      if (catFilter !== "all" && cat?.key !== catFilter) return false;
      if (!q) return true;
      const haystack = `${e.summary} ${e.scenario} ${e.sourcePlatform ?? ""} ${cat?.name ?? ""} ${cat?.description ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [endpoints, query, catFilter, catById, platform]);

  if (loading) return <div className="text-ink-faint text-[15.5px]">Loading...</div>;

  return (
    <div>
      <div className="explore-heading text-center mb-6 mt-2">
        <h1 className="text-[28px] font-bold text-balance">What data would you like to use?</h1>
        <p className="text-ink-dim text-[16px] mt-2">Explore data and services for your application.</p>

        <div className="max-w-[520px] mx-auto mt-5">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Customer sales, stock, invoices..."
            className="w-full border border-line-strong bg-surface rounded-xl px-4 py-3 text-[16.5px] shadow-sm"
          />
        </div>

        {!query && (
          <div className="flex items-center justify-center gap-1.5 flex-wrap mt-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                className="text-[14px] border border-line-strong bg-surface text-ink-dim rounded-full px-3 py-1 hover:bg-surface-2"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <AudienceToggle />
      <div className="workspace-filterbar"><label htmlFor="platform-filter" className="text-sm font-semibold">Source platform</label><Select id="platform-filter" value={platform} onChange={event => setPlatform(event.target.value)}><option value="all">All platforms</option>{platforms.map(name => <option key={name}>{name}</option>)}<option value="unspecified">Not specified</option></Select><span className="text-xs text-ink-dim">Platforms identify source systems; categories identify business areas.</span></div>

      <div className="flex items-center justify-center gap-1.5 flex-wrap mb-5">
        <button
          onClick={() => setCatFilter("all")}
          className={`text-[14.5px] font-semibold rounded-full px-3 py-1.5 border ${
            catFilter === "all" ? "bg-teal-soft border-teal text-teal-strong" : "border-line-strong bg-surface text-ink-dim hover:bg-surface-2"
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.key}
            onClick={() => setCatFilter(c.key)}
            className={`text-[14.5px] font-semibold rounded-full px-3 py-1.5 border ${
              catFilter === c.key ? "bg-teal-soft border-teal text-teal-strong" : "border-line-strong bg-surface text-ink-dim hover:bg-surface-2"
            }`}
          >
            <span className="inline-flex items-center gap-2"><AppIcon value={CATEGORY_ICONS[c.key] ?? "fa:box"} /> {c.name}</span>
          </button>
        ))}
      </div>

      <div className="text-[14px] text-ink-faint mb-2.5">Found {filtered.length} items</div>

      {filtered.map((e) => {
        const cat = catById.get(e.categoryId);
        if (!cat) return null;
        return <EndpointCard key={e.id} category={cat} endpoint={e} categoryLabel={cat.name} />;
      })}
      {!filtered.length && <EmptyRow>No results found. Try another keyword or describe what you want to do.</EmptyRow>}
    </div>
  );
}
