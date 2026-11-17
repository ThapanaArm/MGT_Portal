import { useEditingGuard } from "@/shared/lib/editing-guard";
import { useState } from "react";
import { api, ApiError } from "@/shared/lib/api";
import { Btn } from "@/shared/components/ui";
import { Dialog, Field, Input, Textarea } from "@/shared/components/design-system";

export default function RequestUpdateDialog({ appId, appName, initialBranch = "main", onClose, onSubmitted }: { appId: number; appName: string; initialBranch?: string; onClose: () => void; onSubmitted: (id: number) => void }) {
  const { requestExit, complete } = useEditingGuard(true);
  const [version, setVersion] = useState("");
  const [summary, setSummary] = useState("");
  const [branch, setBranch] = useState(initialBranch);
  const [commit, setCommit] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try { const result = await api.post<{ id: number }>(`/api/applications/${appId}/system-updates`, { version, changeSummary: summary, branch, commit }); complete(() => onSubmitted(result.id)); }
    catch (error) { setError(error instanceof ApiError ? error.message : "Couldn't request the update"); }
    finally { setBusy(false); }
  }
  return <Dialog open title="Request system update" size="lg" onClose={() => { if (!busy) requestExit(onClose); }}><form className="system-update-form" onSubmit={submit}><p className="development-note"><strong>{appName}</strong><br />The current version remains live while this update is reviewed and deployed.</p><Field>New version<Input required maxLength={100} placeholder="e.g. 1.1.0" value={version} onChange={event => setVersion(event.target.value)} /></Field><Field>What changed<Textarea required maxLength={5000} rows={5} placeholder="Describe the improvements, fixes, and any impact on users." value={summary} onChange={event => setSummary(event.target.value)} /></Field><div className="development-fields"><Field>Branch<Input required maxLength={200} value={branch} onChange={event => setBranch(event.target.value)} /></Field><Field>Commit SHA<Input required pattern="[0-9a-fA-F]{7,40}" placeholder="e.g. a1b2c3d" value={commit} onChange={event => setCommit(event.target.value)} /><small>7–40 hexadecimal characters from the commit to deploy.</small></Field></div>{error && <p role="alert" className="text-danger">{error}</p>}<div className="example-form-footer"><Btn type="button" disabled={busy} onClick={() => requestExit(onClose)}>Cancel</Btn><Btn type="submit" variant="primary" loading={busy}>Submit update for review</Btn></div></form></Dialog>;
}

