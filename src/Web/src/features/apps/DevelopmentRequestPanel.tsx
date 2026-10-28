import { useState } from "react";
import { useNavigate } from "react-router";
import { api, ApiError } from "@/shared/lib/api";
import { useAuth } from "@/shared/lib/auth";
import { useToast } from "@/shared/lib/toast";
import { Btn, Panel } from "@/shared/components/ui";
import { Field, Input, Select, Textarea, Badge } from "@/shared/components/design-system";
import { ProcessTracker } from "@/shared/components/ProcessTracker";
import type { AppDetailDto, AppType } from "@/shared/lib/types";

export default function DevelopmentRequestPanel({ detail, onChanged }: { detail: AppDetailDto; onChanged: () => void }) {
  const { user } = useAuth(); const toast = useToast(); const navigate = useNavigate();
  const a = detail.summary;
  const state = detail.development ?? (a.status === "draft" ? { stage: "draft", targetTier: a.products.length ? "tier2" as const : "tier1" as const, developers: [], branch: null, commit: null } : null);
  const owner = a.ownerEmail.toLowerCase() === user?.email.toLowerCase(), admin = user?.roleKey === "admin";
  const stage = state?.stage ?? (a.status === "pending" ? "review" : a.status === "draft" ? "draft" : "approved");
  const step = ["draft", "setup", "development", "review", "approved"].indexOf(stage);
  const [tier, setTier] = useState<AppType>(state?.targetTier ?? (a.products.length ? "tier2" : "tier1"));
  const [emails, setEmails] = useState(state?.developers?.length ? state.developers.map(d => d.email).join("\n") : a.ownerEmail);
  const [team, setTeam] = useState((state?.developers?.length ?? 0) > 1);
  const [developers, setDevelopers] = useState(state?.developers ?? []);
  const [github, setGithub] = useState(a.github === "-" ? "" : a.github);
  const [branch, setBranch] = useState(state?.branch ?? "main"), [commit, setCommit] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const next = a.status === "suspended" ? "Approval suspended · Contact IT" : ["Requester · Complete access request", "IT · Prepare Git and requested API access", "Requester · Push code and request deployment", "IT + committee · Review deployment", "IT · Arrange deployment separately"][step];
  async function action(path: string, body: unknown, method: "put" | "post" = "put") {
    if (busy) return; setBusy(true); setError("");
    try { await api[method](`/api/applications/${a.id}/${path}`, body); toast({ tone: "success", message: "Request updated" }); onChanged(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Unable to update request"); }
    finally { setBusy(false); }
  }
  const emailList = emails.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
  return <><ProcessTracker step={step} next={next} legacy={!state && step > 0} />{state && <Panel className="development-action-panel" title={stage === "draft" ? "01 · Development access request" : stage === "setup" ? "01 · IT preparation" : stage === "development" ? "02 · Request deployment" : stage === "review" ? "02 · Deployment approval" : "Deployment approved"}>
    {stage === "draft" && owner && <form onSubmit={e => { e.preventDefault(); if (!team && emailList.length !== 1) { setError("Solo mode requires one account."); return; } if (team && emailList.length < 2) { setError("Add at least two accounts for collaboration."); return; } void action("development-access", { targetTier: tier, emails: emailList, submit: true }); }}><div className="development-fields"><Field>Requested tier<Select value={tier} onChange={e => setTier(e.target.value as AppType)}><option value="tier1" disabled={!!a.products.length}>Tier 1 · Personal</option><option value="tier2">Tier 2 · Internal</option>{admin && <option value="tier3">Tier 3 · Official IT</option>}</Select></Field><Field>Development mode<Select value={team ? "team" : "solo"} onChange={e => setTeam(e.target.value === "team")}><option value="solo">Solo</option><option value="team">Collaboration</option></Select></Field><Field>Company Microsoft account{team ? <Textarea required rows={3} placeholder="One @megachem.co.th email per line" value={emails} onChange={e => setEmails(e.target.value)} /> : <Input type="email" required value={emails} onChange={e => setEmails(e.target.value)} />}</Field></div><p className="development-note">Use these Microsoft accounts for Git. Collaboration lists access recipients; Portal invitations are not sent.</p><div className="development-actions"><Btn type="button" disabled={busy} onClick={() => void action("development-access", { targetTier: tier, emails: emailList })}>Save draft</Btn><Btn variant="primary" type="submit" loading={busy}>Request development access</Btn></div></form>}
    {stage === "draft" && !owner && <p className="development-note">Awaiting requester submission.</p>}
    {stage === "setup" && admin && <form onSubmit={e => { e.preventDefault(); void action("development-preparation", { github, developers, complete: true }); }}><Field>Git repository URL<Input type="url" required value={github} placeholder="https://github.com/company/repository" onChange={e => setGithub(e.target.value)} /></Field><div className="development-people">{developers.map((developer, index) => <div key={developer.email}><strong>{developer.email}</strong><label><input type="checkbox" checked={developer.gitReady} onChange={e => setDevelopers(items => items.map((item, i) => i === index ? { ...item, gitReady: e.target.checked } : item))} /> Git access prepared</label>{!!a.products.length && <label><input type="checkbox" checked={developer.apiReady} onChange={e => setDevelopers(items => items.map((item, i) => i === index ? { ...item, apiReady: e.target.checked } : item))} /> Requested API access prepared</label>}</div>)}</div><p className="development-note">Record preparation completed by IT. This form does not issue tokens or send email.</p><div className="development-actions"><Btn type="button" disabled={busy} onClick={() => void action("development-preparation", { github, developers })}>Save progress</Btn><Btn variant="primary" type="submit" loading={busy}>Hand over to developer</Btn></div></form>}
    {stage === "setup" && !admin && <p className="development-note">IT is preparing access for your team.</p>}
    {stage === "development" && owner && <form onSubmit={e => { e.preventDefault(); void action("deployment-request", { branch, commit }, "post"); }}><p className="development-note">Push your finished code to Git, then submit the version to review.</p><div className="development-fields"><Field>Branch<Input required maxLength={200} value={branch} onChange={e => setBranch(e.target.value)} /></Field><Field>Commit SHA<Input required pattern="[0-9a-fA-F]{7,40}" placeholder="e.g. a1b2c3d" value={commit} onChange={e => setCommit(e.target.value)} /></Field></div><Btn type="submit" variant="primary" loading={busy}>Request deployment</Btn></form>}
    {stage === "development" && !owner && <p className="development-note">The requester is developing the application.</p>}
    {(stage === "review" || stage === "approved") && <div className="development-actions"><Badge tone={stage === "approved" ? "success" : "info"}>{stage === "approved" ? "Approved for IT deployment" : "Awaiting IT and committee review"}</Badge>{state.branch && <code>{state.branch} · {state.commit}</code>}{stage === "review" && !owner && <Btn onClick={() => navigate("/reviews")}>Open review workbench</Btn>}</div>}
    {stage !== "draft" && <details className="development-access-summary"><summary>Development accounts · {developers.length}</summary>{developers.map(developer => <div key={developer.email}><strong>{developer.email}</strong><span>Git: {developer.gitReady ? "Ready" : "Pending"}{a.products.length ? ` · API: ${developer.apiReady ? "Ready" : "Pending"}` : ""}</span></div>)}</details>}
    {error && <p role="alert" className="text-danger text-sm mt-3">{error}</p>}
    {stage === "approved" && admin && <div className="development-actions mt-4"><Btn disabled={busy} onClick={() => void action(a.status === "suspended" ? "publish" : "unpublish", {}, "post")}>{a.status === "suspended" ? "Reactivate approval" : "Suspend approval"}</Btn></div>}
  </Panel>}</>;
}
