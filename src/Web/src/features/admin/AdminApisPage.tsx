import { Input,Select,Textarea } from "@/shared/components/design-system";
import IconPicker, { AppIcon } from "@/shared/components/IconPicker";
import { useEffect, useState } from "react";
import { api } from "@/shared/lib/api";
import { useToast } from "@/shared/lib/toast";
import { Btn, MethodBadge, Panel, ScopeTag } from "@/shared/components/ui";
import type { CategoryDto, EndpointDto } from "@/shared/lib/types";

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
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [activeCat, setActiveCat] = useState<string>("");
  const [endpoints, setEndpoints] = useState<EndpointDto[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    api.get<CategoryDto[]>("/api/categories").then((cats) => {
      setCategories(cats);
      if (cats.length) setActiveCat(cats[0].key);
    });
  }, []);

  const loadEndpoints = (key: string) => {
    if (!key) return;
    api.get<EndpointDto[]>(`/api/categories/${key}/endpoints`).then(setEndpoints);
  };

  useEffect(() => {
    loadEndpoints(activeCat);
    queueMicrotask(() => {
      setShowForm(false);
      setEditingId(null);
    });
  }, [activeCat]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (e: EndpointDto) => {
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
    loadEndpoints(activeCat);
  };

  const remove = async (id: number) => {
    await api.del(`/api/categories/endpoints/${id}`);
    toast({ tone: "success", message: "API deleted" });
    loadEndpoints(activeCat);
  };

  return (
    <div>
      <div className="portal-page-heading mb-3.5">
        <div className="flex items-center gap-2 text-[13.5px] uppercase tracking-wide text-ink-faint font-bold mb-1.5">
          <span className="w-2 h-2 rounded-sm bg-teal" /> Admin
        </div>
        <h1 className="text-[26px] font-bold">Manage APIs</h1>
        <p className="text-ink-dim text-[16px] mt-1.5 max-w-[62ch] leading-relaxed">
          Add, edit, or delete API endpoints in each category. Changes appear immediately in the API catalog.
        </p>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-3.5">
        {categories.map((c) => (
          <button
            key={c.key}
            onClick={() => setActiveCat(c.key)}
            className={`border rounded-full px-3.5 py-1.5 text-[15px] font-semibold ${
              activeCat === c.key ? "bg-teal-soft border-teal text-teal-strong" : "border-line-strong bg-surface text-ink-dim hover:bg-surface-2"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <Btn variant="primary" className="mb-3.5" onClick={() => (showForm ? setShowForm(false) : openCreate())}>
        <AppIcon value={showForm ? "fa:close" : "fa:plus"} /> {showForm ? "Cancel" : "Add API"}
      </Btn>

      {showForm ? (
        <Panel title={editingId != null ? "Edit API" : "Add API"} hint={`Category: ${categories.find((c) => c.key === activeCat)?.name ?? ""}`}>
          <form onSubmit={save} className="flex flex-col gap-2.5">
            <div><label htmlFor="source-platform" className="text-sm font-semibold block mb-2">Source platform</label><Input id="source-platform" maxLength={100} list="source-platform-options" placeholder="Choose or enter the source platform" value={form.sourcePlatform} onChange={event => setForm({ ...form, sourcePlatform: event.target.value })} /><datalist id="source-platform-options"><option value="SAP" /><option value="Zoho" /><option value="Fabric" /><option value="SalesApi" /></datalist><p className="text-xs text-ink-dim mt-2">Catalog metadata only. Leave blank until the source is verified.</p></div>
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">Method</label>
              <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]">
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
              <Input value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} placeholder="e.g. sales.read" className="w-full border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]" />
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
                {["Icon", "Method", "Path", "Summary", "Scope", ""].map((h) => (
                  <th key={h} className="text-left text-ink-faint text-[13px] uppercase tracking-wide font-bold px-3.5 py-2.5 border-b border-line">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {endpoints.map((e) => (
                <tr key={e.id}>
                  <td className="px-3.5 py-3 border-b border-line text-[19px]"><AppIcon value={e.icon} /></td>
                  <td className="px-3.5 py-3 border-b border-line"><MethodBadge method={e.method} /></td>
                  <td className="px-3.5 py-3 border-b border-line font-mono">{e.path}</td>
                  <td className="px-3.5 py-3 border-b border-line">{e.summary}</td>
                  <td className="px-3.5 py-3 border-b border-line"><ScopeTag>{e.scope}</ScopeTag></td>
                  <td className="px-3.5 py-3 border-b border-line">
                    <div className="flex gap-1.5">
                      <Btn size="sm" onClick={() => openEdit(e)}>Edit</Btn>
                      <Btn size="sm" danger onClick={() => remove(e.id)}>Delete</Btn>
                    </div>
                  </td>
                </tr>
              ))}
              {!endpoints.length && (
                <tr>
                  <td colSpan={6} className="text-center text-ink-faint text-[15px] py-5">No APIs in this category</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
