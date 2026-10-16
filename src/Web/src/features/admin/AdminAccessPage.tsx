import { useEffect, useState } from "react";
import { api } from "@/shared/lib/api";
import { useToast } from "@/shared/lib/toast";
import { Btn, Panel, ScopeTag } from "@/shared/components/ui";
import UserScopeTable from "@/features/admin/UserScopeTable";
import type { AccessGrantDto, CategoryDto, UserBriefDto } from "@/shared/lib/types";

const DURATIONS = [
  { label: "7 วัน", days: 7 },
  { label: "30 วัน", days: 30 },
  { label: "90 วัน", days: 90 },
  { label: "180 วัน", days: 180 },
  { label: "ไม่มีกำหนด", days: null as number | null },
];

interface FormState {
  userId: string;
  categoryId: string;
  level: "read" | "write";
  days: number | null;
  note: string;
}

const EMPTY_FORM: FormState = { userId: "", categoryId: "", level: "read", days: 30, note: "" };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

function StatusPill({ g }: { g: AccessGrantDto }) {
  if (g.revoked) return <span className="text-[13.5px] font-semibold text-ink-faint bg-surface-2 rounded-full px-2.5 py-0.5 whitespace-nowrap">ยกเลิกแล้ว</span>;
  if (g.isExpired) return <span className="text-[13.5px] font-semibold text-amber bg-amber-soft rounded-full px-2.5 py-0.5 whitespace-nowrap">หมดอายุ</span>;
  return <span className="text-[13.5px] font-semibold text-teal-strong bg-teal-soft rounded-full px-2.5 py-0.5 whitespace-nowrap">ใช้งานอยู่</span>;
}

export default function AdminAccessPage() {
  const toast = useToast();
  const [users, setUsers] = useState<UserBriefDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [grants, setGrants] = useState<AccessGrantDto[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadGrants = () => api.get<AccessGrantDto[]>("/api/access/grants").then(setGrants).catch(() => {});

  useEffect(() => {
    api.get<UserBriefDto[]>("/api/access/users").then(setUsers).catch(() => {});
    api.get<CategoryDto[]>("/api/categories").then((cats) => {
      setCategories(cats);
      setForm((f) => ({ ...f, categoryId: cats[0] ? String(cats[0].id) : "" }));
    });
    loadGrants();
  }, []);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, categoryId: categories[0] ? String(categories[0].id) : "" });
    setShowForm(true);
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.userId || !form.categoryId) {
      toast("กรุณาเลือกผู้ใช้และหมวดหมู่ API");
      return;
    }
    const category = categories.find((c) => String(c.id) === form.categoryId);
    if (!category) return;

    setSaving(true);
    try {
      await api.post("/api/access/grants", {
        userId: Number(form.userId),
        categoryId: Number(form.categoryId),
        scope: `${category.key}.${form.level}`,
        durationDays: form.days,
        note: form.note.trim() || null,
      });
      toast("ให้สิทธิ์เข้าถึง API สำเร็จ");
      setShowForm(false);
      loadGrants();
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (id: number) => {
    await api.post(`/api/access/grants/${id}/revoke`);
    toast("ยกเลิกสิทธิ์แล้ว");
    loadGrants();
  };

  return (
    <div>
      <div className="mb-3.5">
        <div className="flex items-center gap-2 text-[13.5px] uppercase tracking-wide text-ink-faint font-bold mb-1.5">
          <span className="w-2 h-2 rounded-sm bg-teal" /> Admin
        </div>
        <h1 className="text-[26px] font-bold">ควบคุมสิทธิ์ผู้ใช้งาน</h1>
        <p className="text-ink-dim text-[16px] mt-1.5 max-w-[68ch] leading-relaxed">
          สิทธิ์แบ่งเป็นสองชั้นที่แยกจากกัน — <b>ขอบเขตข้อมูล</b> คุมว่าเห็นข้อมูล<u>ของใคร</u>ได้บ้าง
          ส่วน <b>สิทธิ์ใช้งาน API</b> คุมว่าเรียก<u>หมวดหมู่ไหน</u>ได้ ทั้งสองอย่างต้องผ่านถึงจะเข้าถึงข้อมูลได้จริง
        </p>
      </div>

      <div className="mb-7">
        <h2 className="text-[19px] font-bold mb-1">1. ขอบเขตการเห็นข้อมูล (Data Scope)</h2>
        <p className="text-ink-dim text-[15px] mb-3.5 max-w-[68ch] leading-relaxed">
          Management เห็นทั้งหมด · Manager เห็นเฉพาะทีมตัวเอง · Employee เห็นเฉพาะของตัวเอง —
          หากบางตำแหน่งต้องเห็นกว้างกว่าระดับปกติ (เช่น ผู้ตรวจสอบภายใน) ให้ตั้งค่าที่ช่อง “เห็นทั้งหมด (เฉพาะราย)”
        </p>
        <UserScopeTable />
      </div>

      <h2 className="text-[19px] font-bold mb-1">2. สิทธิ์ใช้งาน API (Scope)</h2>
      <p className="text-ink-dim text-[15px] mb-3.5 max-w-[68ch] leading-relaxed">
        ให้สิทธิ์พนักงานรายบุคคลใช้งาน API หมวดหมู่ใดหมวดหมู่หนึ่งเพิ่มเติมนอกเหนือจากสิทธิ์ตามบทบาท (Role)
        พร้อมกำหนดระยะเวลาหมดอายุ — เมื่อครบกำหนดหรือถูกยกเลิก สิทธิ์จะหมดผลทันทีในการเข้าสู่ระบบครั้งถัดไป
      </p>

      <Btn variant="primary" className="mb-3.5" onClick={() => (showForm ? setShowForm(false) : openCreate())}>
        {showForm ? "ยกเลิก" : "+ ให้สิทธิ์ใหม่"}
      </Btn>

      {showForm && (
        <Panel title="ให้สิทธิ์เข้าถึง API" hint="เลือกผู้ใช้ หมวดหมู่ API ระดับสิทธิ์ และระยะเวลา">
          <form onSubmit={save} className="flex flex-col gap-2.5">
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">ผู้ใช้งาน</label>
              <select
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
                className="w-full border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]"
              >
                <option value="">-- เลือกผู้ใช้งาน --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} ({u.email}) — {u.roleName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">หมวดหมู่ API</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">ระดับสิทธิ์</label>
              <div className="flex gap-1.5">
                {(["read", "write"] as const).map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => setForm({ ...form, level: lv })}
                    className={`border rounded-lg px-3.5 py-1.5 text-[15px] font-semibold ${
                      form.level === lv ? "bg-teal-soft border-teal text-teal-strong" : "border-line-strong bg-surface text-ink-dim hover:bg-surface-2"
                    }`}
                  >
                    {lv === "read" ? "อ่านข้อมูล (read)" : "แก้ไขข้อมูล (write)"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">ระยะเวลา</label>
              <div className="flex flex-wrap gap-1.5">
                {DURATIONS.map((d) => (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => setForm({ ...form, days: d.days })}
                    className={`border rounded-lg px-3.5 py-1.5 text-[15px] font-semibold ${
                      form.days === d.days ? "bg-teal-soft border-teal text-teal-strong" : "border-line-strong bg-surface text-ink-dim hover:bg-surface-2"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">หมายเหตุ (ถ้ามี)</label>
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="เช่น สนับสนุนโครงการร่วมกับทีมขายชั่วคราว"
                className="w-full border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]"
              />
            </div>
            <div className="flex gap-2 mt-1">
              <Btn type="submit" variant="primary" disabled={saving}>บันทึก</Btn>
              <Btn type="button" onClick={() => setShowForm(false)}>ยกเลิก</Btn>
            </div>
          </form>
        </Panel>
      )}

      <div className="border border-line rounded-[10px] bg-surface overflow-x-auto">
        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr>
              {["ผู้ใช้งาน", "API", "ให้สิทธิ์เมื่อ", "หมดอายุ", "สถานะ", "ให้สิทธิ์โดย", ""].map((h) => (
                <th key={h} className="text-left text-ink-faint text-[13px] uppercase tracking-wide font-bold px-3.5 py-2.5 border-b border-line">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grants.map((g) => (
              <tr key={g.id}>
                <td className="px-3.5 py-3 border-b border-line">
                  <div className="font-semibold">{g.userDisplayName}</div>
                  <div className="text-ink-faint text-[13.5px]">{g.userEmail}</div>
                </td>
                <td className="px-3.5 py-3 border-b border-line">
                  <div className="mb-1">{g.categoryName}</div>
                  <ScopeTag>{g.scope}</ScopeTag>
                </td>
                <td className="px-3.5 py-3 border-b border-line whitespace-nowrap">{fmtDate(g.grantedAt)}</td>
                <td className="px-3.5 py-3 border-b border-line whitespace-nowrap">{g.expiresAt ? fmtDate(g.expiresAt) : "ไม่มีกำหนด"}</td>
                <td className="px-3.5 py-3 border-b border-line"><StatusPill g={g} /></td>
                <td className="px-3.5 py-3 border-b border-line text-ink-dim">{g.grantedByName}</td>
                <td className="px-3.5 py-3 border-b border-line">
                  {!g.revoked && (
                    <Btn size="sm" danger onClick={() => revoke(g.id)}>ยกเลิกสิทธิ์</Btn>
                  )}
                </td>
              </tr>
            ))}
            {!grants.length && (
              <tr>
                <td colSpan={7} className="text-center text-ink-faint text-[15px] py-5">ยังไม่มีการให้สิทธิ์ผู้ใช้งานเพิ่มเติม</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
