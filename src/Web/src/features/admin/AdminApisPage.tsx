import { useEffect, useState } from "react";
import { api } from "@/shared/lib/api";
import { useToast } from "@/shared/lib/toast";
import { Btn, MethodBadge, Panel, ScopeTag } from "@/shared/components/ui";
import type { CategoryDto, EndpointDto } from "@/shared/lib/types";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const ICON_CHOICES = ["📋", "🔍", "➕", "✅", "🔄", "🗑️", "📦", "🚚", "🏬", "🧾", "💳", "📊", "🪪", "🗓️", "💰", "🏭"];

interface FormState {
  method: string;
  path: string;
  summary: string;
  description: string;
  scope: string;
  respExample: string;
  icon: string;
  scenario: string;
}

const EMPTY_FORM: FormState = { method: "GET", path: "", summary: "", description: "", scope: "", respExample: "", icon: "📋", scenario: "" };

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
      respExample: e.respExample, icon: e.icon, scenario: e.scenario,
    });
    setEditingId(e.id);
    setShowForm(true);
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.path.trim() || !form.summary.trim() || !form.scope.trim()) {
      toast("กรุณากรอก Path, Summary และ Scope ให้ครบ");
      return;
    }
    if (editingId != null) {
      await api.put(`/api/categories/endpoints/${editingId}`, form);
      toast("แก้ไข API สำเร็จ");
    } else {
      await api.post(`/api/categories/${activeCat}/endpoints`, form);
      toast("เพิ่ม API ใหม่สำเร็จ");
    }
    setShowForm(false);
    loadEndpoints(activeCat);
  };

  const remove = async (id: number) => {
    await api.del(`/api/categories/endpoints/${id}`);
    toast("ลบ API แล้ว");
    loadEndpoints(activeCat);
  };

  return (
    <div>
      <div className="mb-3.5">
        <div className="flex items-center gap-2 text-[13.5px] uppercase tracking-wide text-ink-faint font-bold mb-1.5">
          <span className="w-2 h-2 rounded-sm bg-teal" /> Admin
        </div>
        <h1 className="text-[26px] font-bold">จัดการ API</h1>
        <p className="text-ink-dim text-[16px] mt-1.5 max-w-[62ch] leading-relaxed">
          เพิ่ม แก้ไข หรือลบ API endpoint ในแต่ละหมวดหมู่ — การเปลี่ยนแปลงจะมีผลกับหน้าหมวดหมู่ API ทันที
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
        {showForm ? "ยกเลิก" : "+ เพิ่ม API ใหม่"}
      </Btn>

      {showForm ? (
        <Panel title={editingId != null ? "แก้ไข API" : "เพิ่ม API ใหม่"} hint={`หมวดหมู่: ${categories.find((c) => c.key === activeCat)?.name ?? ""}`}>
          <form onSubmit={save} className="flex flex-col gap-2.5">
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">Method</label>
              <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]">
                {METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">Path</label>
              <input value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })} placeholder="/example" className="w-full border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]" />
            </div>
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">Summary (สั้น)</label>
              <input value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} className="w-full border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]" />
            </div>
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">Description (ละเอียด)</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]" />
            </div>
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">Scope</label>
              <input value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} placeholder="เช่น sales.read" className="w-full border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]" />
            </div>
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">Icon (แสดงในมุมมองผู้ใช้ทั่วไป)</label>
              <div className="flex flex-wrap gap-1.5">
                {ICON_CHOICES.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setForm({ ...form, icon: ic })}
                    className={`w-8.5 h-8.5 rounded-lg border text-base flex items-center justify-center ${ic === form.icon ? "border-teal bg-teal-soft" : "border-line-strong bg-surface hover:bg-surface-2"}`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">สถานการณ์ใช้งาน (สำหรับผู้ใช้ทั่วไป)</label>
              <input
                value={form.scenario}
                onChange={(e) => setForm({ ...form, scenario: e.target.value })}
                placeholder="เช่น อยากรู้ยอดขายลูกค้ารายนี้ย้อนหลัง → ใช้อันนี้"
                className="w-full border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]"
              />
            </div>
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">ตัวอย่าง Response (JSON)</label>
              <textarea
                value={form.respExample}
                onChange={(e) => setForm({ ...form, respExample: e.target.value })}
                placeholder='{ "id": "..." }'
                className="w-full min-h-[110px] border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15px] font-mono resize-y"
              />
            </div>
            <div className="flex gap-2 mt-1">
              <Btn type="submit" variant="primary">บันทึก</Btn>
              <Btn type="button" onClick={() => setShowForm(false)}>ยกเลิก</Btn>
            </div>
          </form>
        </Panel>
      ) : (
        <div className="border border-line rounded-[10px] bg-surface overflow-x-auto">
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
                  <td className="px-3.5 py-3 border-b border-line text-[19px]">{e.icon}</td>
                  <td className="px-3.5 py-3 border-b border-line"><MethodBadge method={e.method} /></td>
                  <td className="px-3.5 py-3 border-b border-line font-mono">{e.path}</td>
                  <td className="px-3.5 py-3 border-b border-line">{e.summary}</td>
                  <td className="px-3.5 py-3 border-b border-line"><ScopeTag>{e.scope}</ScopeTag></td>
                  <td className="px-3.5 py-3 border-b border-line">
                    <div className="flex gap-1.5">
                      <Btn size="sm" onClick={() => openEdit(e)}>แก้ไข</Btn>
                      <Btn size="sm" danger onClick={() => remove(e.id)}>ลบ</Btn>
                    </div>
                  </td>
                </tr>
              ))}
              {!endpoints.length && (
                <tr>
                  <td colSpan={6} className="text-center text-ink-faint text-[15px] py-5">ยังไม่มี API ในหมวดนี้</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
