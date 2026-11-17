import { useState } from "react";
import { api, ApiError } from "@/shared/lib/api";
import { useToast } from "@/shared/lib/toast";
import { Btn } from "@/shared/components/ui";
import { Select } from "@/shared/components/design-system";
import { Alert } from "@/shared/components/feedback";
import type { AppSummaryDto, ReviewerDto, UserBriefDto, VoteDto } from "@/shared/lib/types";

/** Seats for new requests; older requests keep the size stored on the request (detail.committeeSize). */
export const DEFAULT_COMMITTEE_SIZE = 5;

/**
 * IT chooses this request's own committee (committeeSize people) and can replace anyone at any time.
 * Removing a member during a review discards their decision for the current cycle (ApplicationWorkflow.SetReviewersAsync).
 */
export default function AppReviewersEditor({ app, reviewers, votes, candidates, committeeSize = DEFAULT_COMMITTEE_SIZE, onSaved, onCancel }: { app: AppSummaryDto; reviewers: ReviewerDto[]; votes: VoteDto[]; candidates: UserBriefDto[]; committeeSize?: number; onSaved: () => void; onCancel?: () => void }) {
  const [seats, setSeats] = useState<string[]>(() => Array.from({ length: Math.max(committeeSize, reviewers.length) }, (_, index) => reviewers[index] ? String(reviewers[index].userId) : ""));
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const selected = seats.filter(Boolean).map(Number);
  const changed = selected.length !== reviewers.length || reviewers.some(reviewer => !selected.includes(reviewer.userId));
  const discarded = reviewers.filter(reviewer => !selected.includes(reviewer.userId) && votes.some(vote => vote.reviewerUserId === reviewer.userId && vote.decidedAt));
  // The requester cannot review their own request.
  const options = candidates.filter(candidate => candidate.email.toLowerCase() !== app.ownerEmail.toLowerCase());
  async function save() {
    setSaving(true);
    try {
      await api.put(`/api/applications/${app.id}/reviewers`, { userIds: selected });
      toast({ tone: "success", message: "Committee saved" });
      onSaved();
    } catch (error) { toast({ tone: "danger", message: error instanceof ApiError ? error.message : "Couldn't save the committee" }); }
    finally { setSaving(false); }
  }
  return <div className="rv-editor">
    {seats.map((value, index) => <Select key={index} aria-label={`Committee member ${index + 1} for ${app.name}`} value={value} onChange={event => { const next = event.target.value; setSeats(old => old.map((seat, seatIndex) => seatIndex === index ? next : seat)); }}><option value="">Choose person {index + 1}</option>{options.map(user => <option key={user.id} value={user.id} disabled={seats.some((seat, seatIndex) => seatIndex !== index && seat === String(user.id))}>{user.displayName || user.email}</option>)}</Select>)}
    {discarded.length > 0 && <Alert tone="warning" title="Their decision will be removed">{discarded.map(reviewer => reviewer.name).join(", ")}</Alert>}
    <div className="rv-actions"><Btn variant="primary" size="sm" loading={saving} disabled={!changed} onClick={save}>Save</Btn>{onCancel && <Btn size="sm" disabled={saving} onClick={onCancel}>Cancel</Btn>}</div>
  </div>;
}
