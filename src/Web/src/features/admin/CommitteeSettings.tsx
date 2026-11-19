import { useEffect, useState } from "react";
import { api, ApiError } from "@/shared/lib/api";
import { useToast } from "@/shared/lib/toast";
import { Btn } from "@/shared/components/ui";
import { Field, Select, Skeleton } from "@/shared/components/design-system";
import { Alert } from "@/shared/components/feedback";
import type { CommitteeMemberDto, UserBriefDto } from "@/shared/lib/types";

/** Seats on the review committee. Every request uses the same committee (ApplicationWorkflow.SetCommitteeAsync). */
export const COMMITTEE_SIZE = 5;

const emptySeats = () => Array.from({ length: COMMITTEE_SIZE }, () => "");

/**
 * IT chooses the one review committee used by every request.
 * Saving applies to requests in review right away: decisions from removed members are discarded for the current cycle.
 * A requester who is on the committee sits out their own request, which then uses the other 4 members.
 */
export default function CommitteeSettings() {
  const [members, setMembers] = useState<CommitteeMemberDto[]>([]);
  const [users, setUsers] = useState<UserBriefDto[]>([]);
  const [seats, setSeats] = useState<string[]>(emptySeats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const toast = useToast();

  useEffect(() => {
    let active = true;
    Promise.all([api.get<CommitteeMemberDto[]>("/api/committee/members"), api.get<UserBriefDto[]>("/api/access/users")])
      .then(([current, people]) => {
        if (!active) return;
        setMembers(current);
        setUsers(people);
        setSeats(emptySeats().map((_, index) => current[index] ? String(current[index].userId) : ""));
      })
      .catch(() => { if (active) setError("Couldn't load the committee"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  const selected = seats.filter(Boolean).map(Number);
  const complete = selected.length === COMMITTEE_SIZE;
  const changed = selected.length !== members.length || members.some(member => !selected.includes(member.userId));

  async function save() {
    setSaving(true);
    try {
      await api.put("/api/committee/members", { userIds: selected });
      toast({ tone: "success", message: "Committee saved" });
      setAttempt(value => value + 1);
    } catch (err) { toast({ tone: "danger", message: err instanceof ApiError ? err.message : "Couldn't save the committee" }); }
    finally { setSaving(false); }
  }

  if (loading) return <Skeleton rows={5} />;
  if (error) return <Alert tone="danger" title={error}><Btn onClick={() => { setError(""); setLoading(true); setAttempt(value => value + 1); }}>Try again</Btn></Alert>;

  return <section className="portal-panel committee-settings">
    <header className="committee-settings-head">
      <h2>Review committee</h2>
    </header>
    {members.length < COMMITTEE_SIZE && <Alert tone="warning" title="Choose all 5 members">Requests can't be sent for review until the committee is complete.</Alert>}
    <div className="committee-seats">
      {seats.map((value, index) => <Field key={index}>
        Seat {index + 1}
        <Select aria-label={`Committee seat ${index + 1}`} value={value} onChange={event => { const next = event.target.value; setSeats(old => old.map((seat, seatIndex) => seatIndex === index ? next : seat)); }}>
          <option value="">Choose a person</option>
          {users.map(user => <option key={user.id} value={user.id} disabled={seats.some((seat, seatIndex) => seatIndex !== index && seat === String(user.id))}>{user.displayName ? `${user.displayName} (${user.email})` : user.email}</option>)}
        </Select>
      </Field>)}
    </div>
    <p className="rv-muted">A requester on the committee sits out their own request; the other 4 decide.</p>
    <div className="rv-actions"><Btn variant="primary" loading={saving} disabled={!complete || !changed} onClick={save}>Save committee</Btn>{changed && <Btn variant="ghost" disabled={saving} onClick={() => setSeats(emptySeats().map((_, index) => members[index] ? String(members[index].userId) : ""))}>Reset</Btn>}</div>
  </section>;
}
