import { Input, Select, Textarea } from "@/shared/components/design-system";
import IconPicker, { AppIcon } from "@/shared/components/IconPicker";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { api } from "@/shared/lib/api";
import { notifyCategoriesUpdated } from "@/shared/lib/categories";
import { useToast } from "@/shared/lib/toast";
import { Btn, MethodBadge, Panel, ScopeTag } from "@/shared/components/ui";
import { FilterToolbar } from "@/shared/components/filters";
import type { CategoryDto, EndpointDto } from "@/shared/lib/types";

const SOURCE_PLATFORMS = ["SAP", "Zoho", "Supabase", "SQL Server"];

// Scope actions understood by the backend permission check (ApiPermissionService / Gateway).
const CATEGORY_ACTIONS = [["read", "Read"], ["write", "Write (create, update, delete, cancel)"], ["*", "Everything"]] as const;
const RESOURCE_ACTIONS = [
  ["read", "Read"], ["create", "Create"], ["update", "Update"], ["delete", "Delete"],
  ["cancel", "Cancel"], ["approve", "Approve / reject"], ["write", "Write (create, update, delete, cancel)"], ["*", "Everything"],
] as const;
// Resources the Gateway already enforces (SAP sales order, Zoho deals / quotes / orders).
const GATEWAY_RESOURCES: Record<string, string[]> = { sales: ["order", "deal", "quote"] };

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

interface FormState {
  method: string;
  path: string;
  summary: string;
  description: string;
  scope: string;
  respExample: string;
  icon: string;
  scenario: string;
  sourcePlatform: string;
}

const EMPTY_FORM: FormState = { method: "GET", path: "", summary: "", description: "", scope: "", respExample: "", icon: "fa:clipboard", scenario: "", sourcePlatform: "" };

export default function AdminApisPage() {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  // Category of the API being added or edited (drives the scope choices in the form).
  const [activeCat, setActiveCat] = useState<string>("");
  const [endpoints, setEndpoints] = useState<EndpointDto[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("category") ?? "");
  const [methodFilter, setMethodFilter] = useState("");
  const [platform, setPlatform] = useState("");

  // Every category's APIs in one list, so the table can be filtered across categories.
  const loadAll = async () => {
    const cats = await api.get<CategoryDto[]>("/api/categories");
    setCategories(cats);
    const lists = await Promise.all(cats.map((c) => api.get<EndpointDto[]>(`/api/categories/${c.key}/endpoints`)));
    setEndpoints(lists.flat());
  };
  useEffect(() => { void loadAll(); }, []);

  const categoryOf = (e: EndpointDto) => categories.find((c) => c.id === e.categoryId);
  const activeCategory = categories.find((c) => c.key === activeCat);
  const filtersActive = !!(query || categoryFilter || methodFilter);
  const text = query.trim().toLowerCase();
  const filtered = endpoints.filter((e) =>
    (!text || `${e.path} ${e.summary} ${e.scope}`.toLowerCase().includes(text))
    && (!categoryFilter || categoryOf(e)?.key === categoryFilter)
    && (!methodFilter || e.method === methodFilter));
  const platformTabs = [{ key: "", label: "All", count: filtered.length }, ...SOURCE_PLATFORMS.map((p) => ({ key: p, label: p, count: filtered.filter((e) => e.sourcePlatform === p).length }))];
  const shown = filtered.filter((e) => !platform || e.sourcePlatform === platform);

  // Scope = "<category>.read" for GET, "<category>.write" for POST/PUT/PATCH/DELETE.
  // Resource-level scopes (e.g. sales.order.create) come from the Gateway's live resources
  // plus any resource already used by an API in this category.
  const scopeFor = (method: string) => `${activeCat}.${method === "GET" ? "read" : "write"}`;
  const resources = Array.from(new Set([
    ...(GATEWAY_RESOURCES[activeCat] ?? []),
    ...endpoints.filter((e) => categoryOf(e)?.key === activeCat).map((e) => e.scope?.split(".") ?? [])
      .filter((parts) => parts.length >= 3 && parts[0] === activeCat && !parts[1].includes("{"))
      .map((parts) => parts[1]),
  ]));
  const scopeGroups: { label: string; options: { value: string; label: string }[] }[] = [
    { label: "Whole category", options: CATEGORY_ACTIONS.map(([action, label]) => ({ value: `${activeCat}.${action}`, label: `${activeCat}.${action} · ${label}` })) },
    ...resources.map((resource) => ({
      label: `Resource: ${resource}`,
      options: RESOURCE_ACTIONS.map(([action, label]) => ({ value: `${activeCat}.${resource}.${action}`, label: `${activeCat}.${resource}.${action} · ${label}` })),
    })),
  ];
  const knownScope = scopeGroups.some((group) => group.options.some((option) => option.value === form.scope));

  const openCreate = () => {
    const key = categoryFilter || categories[0]?.key || "";
    setActiveCat(key);
    setForm({ ...EMPTY_FORM, scope: `${key}.read` });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (e: EndpointDto) => {
    setActiveCat(categoryOf(e)?.key ?? "");
    setForm({
      method: e.method, path: e.path, summary: e.summary, description: e.description, scope: e.scope,
      respExample: e.respExample, icon: e.icon, scenario: e.scenario, sourcePlatform: e.sourcePlatform ?? "",
    });
    setEditingId(e.id);
    setShowForm(true);
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.path.trim() || !form.summary.trim() || !form.scope.trim()) {
      toast({ tone: "warning", message: "Enter a path, summary, and scope" });
      return;
    }
    if (editingId != null) {
      await api.put(`/api/categories/endpoints/${editingId}`, form);
      toast({ tone: "success", message: "API updated" });
    } else {
      await api.post(`/api/categories/${activeCat}/endpoints`, form);
      toast({ tone: "success", message: "API created" });
    }
    setShowForm(false);
    void loadAll();
    notifyCategoriesUpdated();
  };

  const remove = async (id: number) => {
    await api.del(`/api/categories/endpoints/${id}`);
    toast({ tone: "success", message: "API deleted" });
    void loadAll();
    notifyCategoriesUpdated();
  };

  return (
    <div>
      <div className="portal-page-heading admin-api-page-heading">
        <h1 className="text-[26px] font-bold">APIs</h1>
        {!showForm && <Btn variant="primary" startIcon={<AppIcon value="fa:plus" />} disabled={!categories.length} onClick={openCreate}>Add API</Btn>}
      </div>

      {!showForm && <>
        <FilterToolbar label="API filters">
          <div className="mgt-filter-search"><AppIcon value="fa:search" /><Input aria-label="Search APIs" placeholder="Search path, summary or scope..." value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          <label>Category<Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="">All categories</option>{categories.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</Select></label>
          <label>Method<Select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}><option value="">All methods</option>{METHODS.map((m) => <option key={m}>{m}</option>)}</Select></label>
          <Btn disabled={!filtersActive} onClick={() => { setQuery(""); setCategoryFilter(""); setMethodFilter(""); }}>Clear all</Btn>
        </FilterToolbar>
        <div className="admin-api-results-heading">
          <div className="admin-api-platforms" role="tablist" aria-label="Source platform">{platformTabs.map((tab) => <button key={tab.key || "all"} type="button" role="tab" aria-selected={platform === tab.key} onClick={() => setPlatform(tab.key)}>{tab.label}<span>{tab.count}</span></button>)}</div>
          <span role="status">{shown.length} of {endpoints.length} APIs</span>
        </div>
      </>}

      {showForm ? (
        <Panel title={editingId != null ? "Edit API" : "Add API"} hint={editingId != null ? `Category: ${activeCategory?.name ?? ""}` : undefined}>
          <form onSubmit={save} className="flex flex-col gap-2.5">
            {editingId == null && <div><label htmlFor="api-category" className="text-sm font-semibold block mb-2">Category</label><Select id="api-category" value={activeCat} onChange={(e) => { const key = e.target.value; setActiveCat(key); setForm({ ...form, scope: `${key}.${form.method === "GET" ? "read" : "write"}` }); }}>{categories.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</Select></div>}
            <div><label htmlFor="source-platform" className="text-sm font-semibold block mb-2">Source platform</label><Select id="source-platform" value={form.sourcePlatform} onChange={event => setForm({ ...form, sourcePlatform: event.target.value })} className="border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]"><option value="" disabled hidden>Select source platform</option>{SOURCE_PLATFORMS.map(platform => <option key={platform} value={platform}>{platform}</option>)}{form.sourcePlatform && !SOURCE_PLATFORMS.includes(form.sourcePlatform) && <option value={form.sourcePlatform}>{form.sourcePlatform}</option>}</Select></div>
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">Method</label>
              <Select value={form.method} onChange={(e) => {
                const method = e.target.value;
                // Follow the method only while the scope is still the automatic read/write choice.
                const scope = !form.scope || form.scope === scopeFor(form.method) ? scopeFor(method) : form.scope;
                setForm({ ...form, method, scope });
              }} className="border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]">
                {METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">Path</label>
              <Input value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })} placeholder="/example" className="w-full border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]" />
            </div>
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">Summary</label>
              <Input value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} className="w-full border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]" />
            </div>
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">Description</label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]" />
            </div>
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">Scope</label>
              <Select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} className="border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]">
                {form.scope && !knownScope && <option value={form.scope}>{form.scope} (current value)</option>}
                {scopeGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </optgroup>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">Icon (business view)</label>
              <IconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} />
            </div>
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">Use case (business view)</label>
              <Input
                value={form.scenario}
                onChange={(e) => setForm({ ...form, scenario: e.target.value })}
                placeholder="e.g. View a customer's sales history"
                className="w-full border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]"
              />
            </div>
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">Example response (JSON)</label>
              <Textarea
                value={form.respExample}
                onChange={(e) => setForm({ ...form, respExample: e.target.value })}
                placeholder='{ "id": "..." }'
                className="w-full min-h-[110px] border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15px] font-mono resize-y"
              />
            </div>
            <div className="flex gap-2 mt-1">
              <Btn type="submit" variant="primary">Save</Btn>
              <Btn type="button" onClick={() => setShowForm(false)}>Cancel</Btn>
            </div>
          </form>
        </Panel>
      ) : (
        <div className="portal-table-frame">
          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr>
                {["Icon", "Method", "Path", "Summary", "Category", "Source", "Scope", ""].map((h) => (
                  <th key={h} className="text-left text-ink-faint text-[13px] uppercase tracking-wide font-bold px-3.5 py-2.5 border-b border-line">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id}>
                  <td className="px-3.5 py-3 border-b border-line text-[19px]"><AppIcon value={e.icon} /></td>
                  <td className="px-3.5 py-3 border-b border-line"><MethodBadge method={e.method} /></td>
                  <td className="px-3.5 py-3 border-b border-line font-mono admin-api-path">{e.path}</td>
                  <td className="px-3.5 py-3 border-b border-line admin-api-summary">{e.summary}</td>
                  <td className="px-3.5 py-3 border-b border-line text-ink-dim">{categoryOf(e)?.name ?? "-"}</td>
                  <td className="px-3.5 py-3 border-b border-line text-ink-dim">{e.sourcePlatform || "-"}</td>
                  <td className="px-3.5 py-3 border-b border-line"><ScopeTag>{e.scope}</ScopeTag></td>
                  <td className="px-3.5 py-3 border-b border-line">
                    <div className="flex gap-1.5">
                      <Btn size="sm" onClick={() => openEdit(e)}>Edit</Btn>
                      <Btn size="sm" danger onClick={() => remove(e.id)}>Delete</Btn>
                    </div>
                  </td>
                </tr>
              ))}
              {!shown.length && (
                <tr>
                  <td colSpan={8} className="text-center text-ink-faint text-[15px] py-5">{endpoints.length ? "No APIs match these filters" : "No APIs yet"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
