import { Input,Select } from "@/shared/components/design-system";
import { AppIcon } from "@/shared/components/Icon";
import { useEffect, useState } from "react";
import { api } from "@/shared/lib/api";
import { useToast } from "@/shared/lib/toast";
import { Btn, Panel, ScopeTag } from "@/shared/components/ui";
import UserScopeTable from "@/features/admin/UserScopeTable";
import type { AccessGrantDto, CategoryDto, UserBriefDto } from "@/shared/lib/types";

const DURATIONS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "180 days", days: 180 },
  { label: "No expiration", days: null as number | null },
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
  return new Date(iso).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

function StatusPill({ g }: { g: AccessGrantDto }) {
  if (g.revoked) return <span className="text-[13.5px] font-semibold text-ink-faint bg-surface-2 rounded-full px-2.5 py-0.5 whitespace-nowrap">Revoked</span>;
  if (g.isExpired) return <span className="text-[13.5px] font-semibold text-amber bg-amber-soft rounded-full px-2.5 py-0.5 whitespace-nowrap">Expired</span>;
  return <span className="text-[13.5px] font-semibold text-teal-strong bg-teal-soft rounded-full px-2.5 py-0.5 whitespace-nowrap">Active</span>;
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
      toast({ tone: "warning", message: "Select a user and API category" });
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
      toast({ tone: "success", message: "API access granted" });
      setShowForm(false);
      loadGrants();
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (id: number) => {
    await api.post(`/api/access/grants/${id}/revoke`);
    toast({ tone: "success", message: "Access revoked" });
    loadGrants();
  };

  return (
    <div>
      <div className="portal-page-heading mb-3.5">
        <div className="flex items-center gap-2 text-[13.5px] uppercase tracking-wide text-ink-faint font-bold mb-1.5">
          <span className="w-2 h-2 rounded-sm bg-teal" /> Admin
        </div>
        <h1 className="text-[26px] font-bold">Access Control</h1>
        <p className="text-ink-dim text-[16px] mt-1.5 max-w-[68ch] leading-relaxed">
          Access is controlled by two independent layers. <b>Data scope</b> determines whose data is visible.
          <b>API access</b> determines which categories can be called. Both checks must pass to access data.
        </p>
      </div>

      <div className="mb-7">
        <h2 className="text-[19px] font-bold mb-1">1. Data visibility scope</h2>
        <p className="text-ink-dim text-[15px] mb-3.5 max-w-[68ch] leading-relaxed">
          Management can view all data, managers can view their team's data, and employees can view their own data.
          Use individual overrides for roles that need wider visibility, such as internal auditors.
        </p>
        <UserScopeTable />
      </div>

      <h2 className="text-[19px] font-bold mb-1">2. API access (Scope)</h2>
      <p className="text-ink-dim text-[15px] mb-3.5 max-w-[68ch] leading-relaxed">
        Grant individual employees access to additional API categories beyond their role permissions.
        Set an expiration date. Expired or revoked permissions no longer apply on the next sign-in.
      </p>

      <Btn variant="primary" className="mb-3.5" onClick={() => (showForm ? setShowForm(false) : openCreate())}>
        <AppIcon value={showForm ? "fa:close" : "fa:plus"} /> {showForm ? "Cancel" : "Grant access"}
      </Btn>

      {showForm && (
        <Panel title="Grant API access" hint="Choose a user, API category, permission level, and duration.">
          <form onSubmit={save} className="flex flex-col gap-2.5">
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">User</label>
              <Select
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
                className="w-full border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]"
              >
                <option value="">-- Select user --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} ({u.email}) — {u.roleName}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">API category</label>
              <Select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">Permission level</label>
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
                    {lv === "read" ? "Read" : "Write"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">Duration</label>
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
              <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">Notes (optional)</label>
              <Input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="e.g. Temporary support for a sales team project"
                className="w-full border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]"
              />
            </div>
            <div className="flex gap-2 mt-1">
              <Btn type="submit" variant="primary" disabled={saving}>Save</Btn>
              <Btn type="button" onClick={() => setShowForm(false)}>Cancel</Btn>
            </div>
          </form>
        </Panel>
      )}

      <div className="portal-table-frame">
        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr>
              {["User", "API", "Granted", "Expired", "Status", "Granted by", ""].map((h) => (
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
                <td className="px-3.5 py-3 border-b border-line whitespace-nowrap">{g.expiresAt ? fmtDate(g.expiresAt) : "No expiration"}</td>
                <td className="px-3.5 py-3 border-b border-line"><StatusPill g={g} /></td>
                <td className="px-3.5 py-3 border-b border-line text-ink-dim">{g.grantedByName}</td>
                <td className="px-3.5 py-3 border-b border-line">
                  {!g.revoked && (
                    <Btn size="sm" danger onClick={() => revoke(g.id)}>Revoke access</Btn>
                  )}
                </td>
              </tr>
            ))}
            {!grants.length && (
              <tr>
                <td colSpan={7} className="text-center text-ink-faint text-[15px] py-5">No additional access grants</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
