import { useEffect, useState } from "react";
import { AppIcon } from "@/shared/components/Icon";
import { Badge, Dialog, Field, Input, Select, Skeleton } from "@/shared/components/design-system";
import { Alert } from "@/shared/components/feedback";
import { api, ApiError } from "@/shared/lib/api";
import { useAuth } from "@/shared/lib/auth";
import { useToast } from "@/shared/lib/toast";
import { Btn, EmptyState, Panel } from "@/shared/components/ui";
import type { UserTokenDto } from "@/shared/lib/types";

const SCOPE_TEXT: Record<string, string> = { all: "All data", team: "Your department's data", salegroup: "Your sale group's data", self: "Only your own data" };
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB") : "Never");

/**
 * User tokens: apps send one with their own Token ID/Secret (header X-User-Token),
 * and the Gateway returns only the data this person may see.
 */
export default function TokensPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [tokens, setTokens] = useState<UserTokenDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [name, setName] = useState("");
  const [days, setDays] = useState("90");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<UserTokenDto | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => { let active = true; api.get<UserTokenDto[]>("/api/me/user-tokens").then(value => { if (active) { setTokens(value); setError(false); } }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [attempt]);
  const reload = () => setAttempt(value => value + 1);

  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const result = await api.post<{ token: UserTokenDto; value: string }>("/api/me/user-tokens", { name: name.trim(), days: Number(days) });
      setCreated(result.value); setName(""); reload();
    } catch (err) { toast({ tone: "danger", message: err instanceof ApiError ? err.message : "Couldn't create the token" }); }
    finally { setBusy(false); }
  }
  async function revoke() {
    if (!revoking) return; setBusy(true);
    try { await api.del(`/api/me/user-tokens/${revoking.id}`); toast({ tone: "success", message: "Token revoked" }); setRevoking(null); reload(); }
    catch (err) { toast({ tone: "danger", message: err instanceof ApiError ? err.message : "Couldn't revoke the token" }); }
    finally { setBusy(false); }
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast({ tone: "success", message: "Copied" }); } catch { toast({ tone: "danger", message: "Copy it manually" }); }
  }

  return <div>
    <div className="rv-heading"><h1>My tokens</h1></div>
    <p className="rv-muted mb-4">Apps send your token with each request, so you only get data you're allowed to see: <strong>{SCOPE_TEXT[user?.dataScope ?? "self"] ?? "Only your own data"}</strong>.</p>

    <Panel title="New token">
      <form className="token-form" onSubmit={create}>
        <Field>Name<Input required maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="Sales dashboard on my laptop" /></Field>
        <Field>Expires in<Select value={days} onChange={event => setDays(event.target.value)}>{[30, 90, 180, 365].map(value => <option key={value} value={value}>{value} days</option>)}</Select></Field>
        <Btn type="submit" variant="primary" loading={busy} startIcon={<AppIcon value="fa:plus" />}>Create token</Btn>
      </form>
      {created && <Alert tone="warning" title="Copy your token now. You won't see it again." onDismiss={() => setCreated(null)}>
        <div className="token-value"><code>{created}</code><Btn size="sm" onClick={() => void copy(created)}>Copy</Btn></div>
      </Alert>}
    </Panel>

    {loading ? <Skeleton rows={3} /> : error ? <Alert tone="danger" title="Couldn't load your tokens"><Btn onClick={reload}>Try again</Btn></Alert>
      : !tokens.length ? <EmptyState title="No tokens yet" description="Create a token, then give it to the app you use." />
      : <div className="portal-panel app-list" role="list" aria-label="Your tokens">
        <div className="app-list-head token-row" aria-hidden="true"><span>Token</span><span>Expires</span><span>Last used</span><span>Status</span><span /></div>
        {tokens.map(token => <div key={token.id} role="listitem" className="app-list-row token-row">
          <span className="app-list-app"><span><strong>{token.name}</strong><small><code>{token.prefix}…</code> · created {day(token.createdAt)}</small></span></span>
          <span className="app-list-date">{day(token.expiresAt)}</span>
          <span className="app-list-date">{day(token.lastUsedAt)}</span>
          <span><Badge tone={token.status === "active" ? "success" : "neutral"}>{token.status === "active" ? "Active" : token.status === "expired" ? "Expired" : "Revoked"}</Badge></span>
          <span>{token.status === "active" && <Btn size="sm" variant="ghost" danger onClick={() => setRevoking(token)}>Revoke</Btn>}</span>
        </div>)}
      </div>}

    <details className="rv-help"><summary>How apps use it</summary>
      <pre className="token-snippet">{`X-Token-Id: <app Token ID>
X-Token-Secret: <app Token Secret>
X-User-Token: mgtu_...   ← your token`}</pre>
    </details>

    <Dialog open={!!revoking} confirmation tone="danger" title="Revoke this token?" onClose={() => { if (!busy) setRevoking(null); }}>
      <p>Apps using “{revoking?.name}” stop working right away.</p>
      <div className="example-form-footer mt-6"><Btn disabled={busy} onClick={() => setRevoking(null)}>Cancel</Btn><Btn variant="primary" danger loading={busy} onClick={() => void revoke()}>Revoke</Btn></div>
    </Dialog>
  </div>;
}
