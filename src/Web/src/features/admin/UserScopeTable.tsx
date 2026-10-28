import { Select } from "@/shared/components/design-system";
import { useEffect, useState } from "react";
import { api } from "@/shared/lib/api";
import { useToast } from "@/shared/lib/toast";
import { Btn } from "@/shared/components/ui";
import type { DataScope, OrgLevel, TeamDto, UserBriefDto } from "@/shared/lib/types";

const LEVELS: { value: OrgLevel; label: string; hint: string }[] = [
  { value: "employee", label: "Employee", hint: "Own data only" },
  { value: "manager", label: "Manager", hint: "Team data only" },
  { value: "management", label: "Management", hint: "All data" },
];

const SCOPE_META: Record<DataScope, { label: string; className: string }> = {
  self: { label: "Own data", className: "bg-surface-2 text-ink-dim" },
  team: { label: "Team data", className: "bg-put-soft text-put" },
  all: { label: "All", className: "bg-teal-soft text-teal-strong" },
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
      toast({ tone: "warning", message: "Managers must have an assigned team" });
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
      toast(`Updated data scope for ${u.displayName} successfully`);
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
            {["User", "Organization level", "Team", "Individual visibility override", "Effective scope", ""].map((h) => (
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
                  <Select value={d.level} onChange={(e) => patch(u.id, { level: e.target.value as OrgLevel })} className={selectCls}>
                    {LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>{l.label} — {l.hint}</option>
                    ))}
                  </Select>
                </td>
                <td className="px-3.5 py-3 border-b border-line min-w-[130px]">
                  <Select value={d.teamId} onChange={(e) => patch(u.id, { teamId: e.target.value })} className={selectCls}>
                    <option value="">— Not assigned —</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </Select>
                </td>
                <td className="px-3.5 py-3 border-b border-line min-w-[130px]">
                  <Select value={d.override} onChange={(e) => patch(u.id, { override: e.target.value })} className={selectCls}>
                    <option value="">Use organization level</option>
                    <option value="all">Override: All data</option>
                    <option value="team">Override: Team data</option>
                    <option value="self">Override: Own data</option>
                  </Select>
                </td>
                <td className="px-3.5 py-3 border-b border-line">
                  <ScopeChip scope={u.effectiveDataScope} />
                </td>
                <td className="px-3.5 py-3 border-b border-line">
                  <Btn size="sm" variant="primary" disabled={!dirty || savingId === u.id} onClick={() => save(u)}>
                    {savingId === u.id ? "Saving..." : "Save"}
                  </Btn>
                </td>
              </tr>
            );
          })}
          {!users.length && (
            <tr>
              <td colSpan={6} className="text-center text-ink-faint text-[13.5px] py-5">No users found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
