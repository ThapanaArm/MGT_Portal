import { useEffect, useState } from "react";
import { api, ApiError } from "@/shared/lib/api";
import { useToast } from "@/shared/lib/toast";
import { Btn, Panel } from "@/shared/components/ui";
import { Select } from "@/shared/components/design-system";
import type { CommitteeMemberDto, UserBriefDto } from "@/shared/lib/types";

export default function CommitteeAssignments({ members, onChanged }: { members: CommitteeMemberDto[]; onChanged: () => void }) {
  const [users, setUsers] = useState<UserBriefDto[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const toast = useToast();
  useEffect(() => { api.get<UserBriefDto[]>("/api/access/users").then(setUsers).catch(() => toast({ tone: "danger", message: "Unable to load committee account options" })); }, [toast]);
  async function save(member: CommitteeMemberDto) {
    setSaving(member.id);
    try {
      const selected = drafts[member.id] ?? String(member.userId ?? "");
      await api.put(`/api/committee/members/${member.id}/assignment`, { userId: selected ? Number(selected) : null });
      toast({ tone: "success", message: "Committee account assignment saved" }); onChanged();
    } catch (error) { toast({ tone: "danger", message: error instanceof ApiError ? error.message : "Unable to save committee assignment" }); }
    finally { setSaving(null); }
  }
  return <details className="review-assignments"><summary>Manage committee accounts · {members.filter(member => member.userId).length} / {members.length} assigned</summary><Panel title="Link each committee seat to a real account" hint="Assigned users can review application requests and record only their own decision. One account can hold one seat. A seat with a pending decision cannot be reassigned until that review finishes.">
    {members.map(member => <div className="review-assignment" key={member.id}><div><strong>{member.roleTitle}</strong><small>{member.email ?? "No account assigned"}</small></div><Select aria-label={`Account for ${member.roleTitle}`} value={drafts[member.id] ?? String(member.userId ?? "")} onChange={event => setDrafts(old => ({ ...old, [member.id]: event.target.value }))}><option value="">Unassigned</option>{users.map(user => <option key={user.id} value={user.id} disabled={members.some(other => other.id !== member.id && other.userId === user.id)}>{user.displayName} · {user.email}</option>)}</Select><Btn size="sm" loading={saving === member.id} disabled={(drafts[member.id] ?? String(member.userId ?? "")) === String(member.userId ?? "")} onClick={() => save(member)}>Save assignment</Btn></div>)}
  </Panel></details>;
}
