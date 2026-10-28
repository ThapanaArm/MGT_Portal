import { useMemo, useState } from "react";
import { AppIcon } from "@/shared/components/Icon";
import { Select, Tabs } from "@/shared/components/design-system";
import EndpointCard from "./EndpointCard";
import type { CategoryDto, EndpointDto } from "@/shared/lib/types";

// Swagger UI order: endpoints on the same path sit together, read methods before writes.
const METHOD_ORDER = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const methodRank = (method: string) => {
  const index = METHOD_ORDER.indexOf(method.toUpperCase());
  return index === -1 ? METHOD_ORDER.length : index;
};

/** Platform boxes in this order; anything else follows alphabetically, cards without a platform go last. */
const PLATFORM_ORDER = ["SAP", "Zoho", "Supabase"];
const PLATFORM_NOTES: Record<string, string> = {
  SAP: "SAP S/4HANA — sales orders written straight to SAP (API_SALES_ORDER_SRV)",
  Zoho: "Zoho CRM — deals, quotes and sales orders; Zoho approval and the RPA to SAP run as usual",
  Supabase: "Supabase — read-only copy of sales data for reports",
};
const platformOf = (endpoint: EndpointDto) => endpoint.sourcePlatform?.trim() || "Not specified";
const platformRank = (name: string) => {
  const index = PLATFORM_ORDER.indexOf(name);
  return index !== -1 ? index : name === "Not specified" ? 999 : PLATFORM_ORDER.length;
};

/**
 * Swagger-style operation list grouped into one box per source platform: one tinted row per endpoint,
 * coloured by HTTP method, with METHOD + path as the primary line and the service name as the supporting text.
 */
export default function CatalogServiceTable({ category, endpoints }: { category: CategoryDto; endpoints: EndpointDto[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [method, setMethod] = useState("all");
  const [platform, setPlatform] = useState("All");
  const groups = useMemo(() => {
    const rows = endpoints
      .filter((endpoint) => method === "all" || endpoint.method === method)
      .sort((a, b) => a.path.localeCompare(b.path) || methodRank(a.method) - methodRank(b.method));
    const byPlatform = new Map<string, EndpointDto[]>();
    for (const row of rows) byPlatform.set(platformOf(row), [...(byPlatform.get(platformOf(row)) ?? []), row]);
    return [...byPlatform.entries()].sort(([a], [b]) => platformRank(a) - platformRank(b) || a.localeCompare(b));
  }, [endpoints, method]);
  const platforms = groups.map(([name]) => name);
  const current = platform !== "All" && platforms.includes(platform) ? platform : "All";
  const shown = current === "All" ? groups : groups.filter(([name]) => name === current);
  const total = groups.reduce((sum, [, rows]) => sum + rows.length, 0);
  const countOf = (name: string) => (name === "All" ? total : groups.find(([g]) => g === name)?.[1].length ?? 0);

  const renderRow = (endpoint: EndpointDto) => {
    const isOpen = expanded === endpoint.id;
    return (
      <li key={endpoint.id} className={`op-block op-${endpoint.method.toLowerCase()} ${isOpen ? "is-open" : ""}`}>
        <div className="op-summary">
          <button
            type="button"
            className="op-summary-button"
            aria-expanded={isOpen}
            aria-controls={`service-detail-${endpoint.id}`}
            onClick={() => setExpanded((value) => (value === endpoint.id ? null : endpoint.id))}
          >
            <span className="op-method">{endpoint.method}</span>
            <code className="op-path">{endpoint.path}</code>
            <span className="op-name">{endpoint.summary}</span>
          </button>
          <button
            type="button"
            className="op-toggle"
            aria-label={`${isOpen ? "Close" : "View"} details: ${endpoint.summary}`}
            aria-expanded={isOpen}
            aria-controls={`service-detail-${endpoint.id}`}
            onClick={() => setExpanded((value) => (value === endpoint.id ? null : endpoint.id))}
          >
            <AppIcon value="fa:chevron-right" />
          </button>
        </div>
        {isOpen && (
          <div className="op-detail" id={`service-detail-${endpoint.id}`}>
            <EndpointCard category={category} endpoint={endpoint} detailsOnly />
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="catalog-table-panel">
      <div className="catalog-table-toolbar">
        <div className="catalog-table-caption"><AppIcon value="fa:code" /><strong>Service directory</strong><span>{total} services</span></div>
        <label>Method<Select value={method} onChange={(event) => setMethod(event.target.value)}><option value="all">All methods</option>{[...new Set(endpoints.map((endpoint) => endpoint.method))].sort((a, b) => methodRank(a) - methodRank(b)).map((value) => <option key={value}>{value}</option>)}</Select></label>
      </div>
      {platforms.length > 1 && (
        <div className="catalog-platform-tabs">
          <Tabs label="Platform" items={["All", ...platforms]} value={current} onChange={setPlatform}
            renderLabel={(item) => <>{item}<span className="catalog-platform-count">{countOf(item)}</span></>} />
        </div>
      )}

      {shown.map(([name, rows]) => (
        <section key={name} className="catalog-platform-section" aria-label={`${name} APIs`}>
          <div className="catalog-platform-head">
            <strong>{name}</strong>
            {PLATFORM_NOTES[name] && <span>{PLATFORM_NOTES[name]}</span>}
          </div>
          <ul className="op-list" aria-label={`${name} APIs in ${category.name}`}>{rows.map(renderRow)}</ul>
        </section>
      ))}
      {!total && <ul className="op-list"><li className="catalog-table-empty"><strong>No matching services</strong><p>Try another search or adjust your filters.</p></li></ul>}

      <div className="catalog-table-footer"><span>{total} {total === 1 ? "service" : "services"} · {groups.length} {groups.length === 1 ? "platform" : "platforms"}</span></div>
    </div>
  );
}
