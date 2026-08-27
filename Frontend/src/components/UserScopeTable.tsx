"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { Btn } from "@/components/ui";
import type { DataScope, OrgLevel, TeamDto, UserBriefDto } from "@/lib/types";

const LEVELS: { value: OrgLevel; label: string; hint: string }[] = [
  { value: "employee", label: "Employee", hint: "เห็นเฉพาะของตัวเอง" },
  { value: "manager", label: "Manager", hint: "เห็นเฉพาะของทีมตัวเอง" },
  { value: "management", label: "Management", hint: "เห็นทั้งหมด" },
];

const SCOPE_META: Record<DataScope, { label: string; className: string }> = {
  self: { label: "เฉพาะตัวเอง", className: "bg-surface-2 text-ink-dim" },
  team: { label: "ทั้งทีม", className: "bg-put-soft text-put" },
  all: { label: "ทั้งหมด", className: "bg-teal-soft text-teal-strong" },
};

function ScopeChip({ scope }: { scope: DataScope }) {
  const m = SCOPE_META[scope];
  return (
    <span className={`text-[12px] font-bold rounded-full px-2.5 py-0.5 whitespace-nowrap ${m.className}`}>
      {m.label}
    </span>
  );
}

interface Draft {
  level: OrgLevel;
  teamId: string;
  override: string;
}

const toDraft = (u: UserBriefDto): Draft => ({
  level: u.level,
  teamId: u.teamId != null ? String(u.teamId) : "",
  override: u.dataScopeOverride ?? "",
});

const isDirty = (u: UserBriefDto, d: Draft) =>
  d.level !== u.level ||
  d.teamId !== (u.teamId != null ? String(u.teamId) : "") ||
  d.override !== (u.dataScopeOverride ?? "");

export default function UserScopeTable() {
  const toast = useToast();
  const [users, setUsers] = useState<UserBriefDto[]>([]);
  const [teams, setTeams] = useState<TeamDto[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = async () => {
    const [us, ts] = await Promise.all([
      api.get<UserBriefDto[]>("/api/access/users"),
      api.get<TeamDto[]>("/api/access/teams"),
    ]);
    setUsers(us);
    setTeams(ts);
    setDrafts(Object.fromEntries(us.map((u) => [u.id, toDraft(u)])));
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const patch = (id: number, part: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...part } }));

  const save = async (u: UserBriefDto) => {
    const d = drafts[u.id];
    if (d.level === "manager" && !d.teamId) {
      toast("ระดับ Manager ต้องระบุทีมที่ดูแล");
      return;
    }
    setSavingId(u.id);
    try {
      const updated = await api.put<UserBriefDto>(`/api/access/users/${u.id}/data-scope`, {
        level: d.level,
        teamId: d.teamId ? Number(d.teamId) : null,
        dataScopeOverride: d.override || null,
      });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
      setDrafts((prev) => ({ ...prev, [u.id]: toDraft(updated) }));
      toast(`อัปเดตขอบเขตข้อมูลของ ${u.displayName} แล้ว`);
    } finally {
      setSavingId(null);
    }
  };

  const selectCls = "border border-line-strong bg-paper rounded-lg px-2 py-1.5 text-[13.5px] w-full";

  return (
    <div className="border border-line rounded-[10px] bg-surface overflow-x-auto">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr>
            {["ผู้ใช้งาน", "ระดับองค์กร", "ทีม", "เห็นทั้งหมด (เฉพาะราย)", "ขอบเขตที่มีผล", ""].map((h) => (
              <th key={h} className="text-left text-ink-faint text-[11.5px] uppercase tracking-wide font-bold px-3.5 py-2.5 border-b border-line whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const d = drafts[u.id];
            if (!d) return null;
            const dirty = isDirty(u, d);
            return (
              <tr key={u.id}>
                <td className="px-3.5 py-3 border-b border-line">
                  <div className="font-semibold">{u.displayName}</div>
                  <div className="text-ink-faint text-[12px]">{u.email}</div>
                </td>
                <td className="px-3.5 py-3 border-b border-line min-w-[150px]">
                  <select value={d.level} onChange={(e) => patch(u.id, { level: e.target.value as OrgLevel })} className={selectCls}>
                    {LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>{l.label} — {l.hint}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3.5 py-3 border-b border-line min-w-[130px]">
                  <select value={d.teamId} onChange={(e) => patch(u.id, { teamId: e.target.value })} className={selectCls}>
                    <option value="">— ไม่ระบุ —</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3.5 py-3 border-b border-line min-w-[130px]">
                  <select value={d.override} onChange={(e) => patch(u.id, { override: e.target.value })} className={selectCls}>
                    <option value="">ตามระดับ</option>
                    <option value="all">บังคับ: เห็นทั้งหมด</option>
                    <option value="team">บังคับ: ทั้งทีม</option>
                    <option value="self">บังคับ: เฉพาะตัวเอง</option>
                  </select>
                </td>
                <td className="px-3.5 py-3 border-b border-line">
                  <ScopeChip scope={u.effectiveDataScope} />
                </td>
                <td className="px-3.5 py-3 border-b border-line">
                  <Btn size="sm" variant="primary" disabled={!dirty || savingId === u.id} onClick={() => save(u)}>
                    {savingId === u.id ? "กำลังบันทึก..." : "บันทึก"}
                  </Btn>
                </td>
              </tr>
            );
          })}
          {!users.length && (
            <tr>
              <td colSpan={6} className="text-center text-ink-faint text-[13.5px] py-5">ยังไม่มีผู้ใช้งาน</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
