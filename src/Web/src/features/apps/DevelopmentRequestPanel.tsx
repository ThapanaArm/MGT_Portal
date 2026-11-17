import { useEditingGuard } from "@/shared/lib/editing-guard";
import { useState } from "react";
import DeploymentSummary from "./DeploymentSummary";
import RequestUpdateDialog from "./RequestUpdateDialog";
import { useNavigate, useSearchParams } from "react-router";
import { api, ApiError } from "@/shared/lib/api";
import { useAuth } from "@/shared/lib/auth";
import { useToast } from "@/shared/lib/toast";
import { Btn, Panel } from "@/shared/components/ui";
import { Field, Input, Select, Textarea, Badge } from "@/shared/components/design-system";
import { ProcessTracker } from "@/shared/components/ProcessTracker";
import type { AppDetailDto, AppType } from "@/shared/lib/types";
import { tierText } from "@/shared/lib/tiers";

export default function DevelopmentRequestPanel({ detail, initialTier, onChanged }: { detail: AppDetailDto; initialTier?: AppType; onChanged: () => void }) {
  const { user } = useAuth(); const toast = useToast(); const navigate = useNavigate();
  const a = detail.summary;
  const state = detail.development ?? (a.status === "draft" ? { stage: "draft", targetTier: initialTier ?? (a.products.length ? "tier2" as const : "tier1" as const), developers: [], branch: null, commit: null } : null);
  const owner = a.ownerEmail.toLowerCase() === user?.email.toLowerCase(), admin = user?.roleKey === "admin";
  const stage = state?.stage ?? (a.status === "pending" ? "review" : a.status === "draft" ? "draft" : "approved");
  const developing = stage === "development" || stage === "changes";
  const deploymentStatus = a.status === "active" && ["awaiting-deployment", "deployed", "live"].includes(stage) ? stage === "awaiting-deployment" ? "waiting" as const : "done" as const : undefined;
  const step = deploymentStatus ? 5 : ["draft", "setup", "development", "review", "approved"].indexOf(stage === "changes" ? "development" : stage === "suspended" ? "approved" : stage);
  const [tier, setTier] = useState<AppType>(state?.targetTier ?? (a.products.length ? "tier2" : "tier1"));
  const [emails, setEmails] = useState(state?.developers?.length ? state.developers.map(d => d.email).join("\n") : a.ownerEmail);
  const [team, setTeam] = useState((state?.developers?.length ?? 0) > 1);
  const [developers, setDevelopers] = useState(state?.developers ?? []);
  const [github, setGithub] = useState(a.github === "-" ? "" : a.github);
  const [branch, setBranch] = useState(state?.branch ?? "main"), [commit, setCommit] = useState("");
  const [searchParams] = useSearchParams();
  const [updateOpen, setUpdateOpen] = useState(searchParams.get("update") === "1");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  // The draft request is read-only until the requester presses Edit.
  const [editing, setEditing] = useState(false);
  const { requestExit } = useEditingGuard(editing);
  function resetDraft() {
    setTier(state?.targetTier ?? (a.products.length ? "tier2" : "tier1"));
    setEmails(state?.developers?.length ? state.developers.map(d => d.email).join("\n") : a.ownerEmail);
    setTeam((state?.developers?.length ?? 0) > 1);
    setError(""); setEditing(false);
  }
  const changesRequested = stage === "changes";
  const next = a.status === "suspended" ? "Approval suspended · Contact IT" : ["Requester · Complete access request", "IT · Prepare Git and requested API access", changesRequested ? "Requester · Fix the code and request deployment again" : "Requester · Push code and request deployment", "IT + committee · Review deployment", "Review complete", deploymentStatus === "done" ? "Deployment completed" : "IT · Deploy the approved version"][step];
  async function action(path: string, body: unknown, method: "put" | "post" = "put") {
    if (busy) return false; setBusy(true); setError("");
    try { await api[method](`/api/applications/${a.id}/${path}`, body); toast({ tone: "success", message: "Request updated" }); onChanged(); return true; }
    catch (e) { setError(e instanceof ApiError ? e.message : "Unable to update request"); return false; }
    finally { setBusy(false); }
  }
  const emailList = emails.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
  return <><ProcessTracker step={step} next={next} deploymentStatus={deploymentStatus} legacy={!state && step > 0} />{state && <Panel className="development-action-panel" title={stage === "draft" ? "01 · Development access request" : stage === "setup" ? "01 · IT preparation" : stage === "changes" ? "02 · Fix and request deployment again" : stage === "development" ? "02 · Request deployment" : stage === "review" ? "02 · Deployment approval" : stage === "suspended" ? "Approval suspended" : "Deployment and go live"}>
    {state?.parentApplicationId && <div className="development-note"><Badge tone="info">System update · {state.version}</Badge><p>{state.changeSummary}</p><Btn size="sm" onClick={() => navigate(`/my-apps/${state.parentApplicationId}`)}>View current live system</Btn></div>}
    {stage === "live" && !state?.parentApplicationId && <div className="release-toolbar"><Badge tone="success">Live · {state?.version ?? "Initial release"}</Badge>{state?.pendingUpdateId ? <Btn onClick={() => navigate(`/my-apps/${state.pendingUpdateId}`)}>View update in progress</Btn> : (owner || admin) && <Btn variant="primary" onClick={() => { setError(""); setUpdateOpen(true); }}>Request update</Btn>}</div>}
    {!!state?.releases?.length && <details className="development-access-summary"><summary>Release history · {state.releases.length}</summary>{[...state.releases].reverse().map(release => <div key={release.requestId}><strong>{release.version}</strong><span>{release.branch} · {release.commit}</span><span>Live by {release.liveBy} · {release.liveAt ? new Date(release.liveAt).toLocaleString("en-GB") : "Not recorded"}</span><p>{release.changeSummary}</p><Btn size="sm" onClick={() => navigate(`/my-apps/${release.requestId}`)}>View review and deployment</Btn></div>)}</details>}
    {stage === "draft" && owner && <form onSubmit={e => {
      e.preventDefault();
      if (!team && emailList.length !== 1) { setError("Solo mode requires one account."); setEditing(true); return; }
      if (team && emailList.length < 2) { setError("Add at least two accounts for collaboration."); setEditing(true); return; }
      void action("development-access", { targetTier: tier, emails: emailList, submit: true });
    }}>
      {editing ? <div className="development-fields">
        <Field>Requested tier<Select value={tier} onChange={e => setTier(e.target.value as AppType)}><option value="tier1" disabled={!!a.products.length}>{tierText("tier1")}</option><option value="tier2">{tierText("tier2")}</option>{admin && <option value="tier3">{tierText("tier3")}</option>}</Select></Field>
        <Field>Development mode<Select value={team ? "team" : "solo"} onChange={e => setTeam(e.target.value === "team")}><option value="solo">Solo</option><option value="team">Collaboration</option></Select></Field>
        <Field>Company Microsoft account{team ? <Textarea required rows={3} placeholder="One @megachem.co.th email per line" value={emails} onChange={e => setEmails(e.target.value)} /> : <Input type="email" required value={emails} onChange={e => setEmails(e.target.value)} />}</Field>
      </div> : <dl className="development-summary">
        <div><dt>Requested tier</dt><dd>{tierText(tier)}</dd></div>
        <div><dt>Development mode</dt><dd>{team ? "Collaboration" : "Solo"}</dd></div>
        <div><dt>Company Microsoft account{emailList.length > 1 ? "s" : ""}</dt><dd>{emailList.length ? emailList.map(e => <span key={e}>{e}</span>) : "—"}</dd></div>
      </dl>}
      <p className="development-note">Use these Microsoft accounts for Git. Collaboration lists access recipients; Portal invitations are not sent.</p>
      <div className="development-actions">
        {editing
          ? <><Btn type="button" disabled={busy} onClick={() => requestExit(resetDraft)}>Cancel</Btn><Btn type="button" disabled={busy} onClick={() => void action("development-access", { targetTier: tier, emails: emailList }).then(ok => { if (ok) setEditing(false); })}>Save draft</Btn></>
          : <Btn type="button" onClick={() => setEditing(true)}>Edit</Btn>}
        <Btn variant="primary" type="submit" loading={busy}>Request development access</Btn>
      </div>
    </form>}
    {stage === "draft" && !owner && <p className="development-note">Awaiting requester submission.</p>}
    {stage === "setup" && admin && <form onSubmit={e => { e.preventDefault(); void action("development-preparation", { github, developers, complete: true }); }}><Field>Git repository URL<Input type="url" required value={github} placeholder="https://github.com/company/repository" onChange={e => setGithub(e.target.value)} /></Field><div className="development-people">{developers.map((developer, index) => <div key={developer.email}><strong>{developer.email}</strong><label><input type="checkbox" checked={developer.gitReady} onChange={e => setDevelopers(items => items.map((item, i) => i === index ? { ...item, gitReady: e.target.checked } : item))} /> Git access prepared</label>{!!a.products.length && <label><input type="checkbox" checked={developer.apiReady} onChange={e => setDevelopers(items => items.map((item, i) => i === index ? { ...item, apiReady: e.target.checked } : item))} /> Requested API access prepared</label>}</div>)}</div><p className="development-note">Check each preparation item for every developer before handing over.</p><div className="development-actions"><Btn type="button" disabled={busy} onClick={() => void action("development-preparation", { github, developers })}>Save progress</Btn><Btn variant="primary" type="submit" loading={busy}>Hand over to developer</Btn></div></form>}
    {["awaiting-deployment", "deployed", "live"].includes(stage) && <DeploymentSummary state={state} />}
    {stage === "setup" && !admin && <p className="development-note">IT is preparing access for your team.</p>}
    {developing && <div>{owner && <form onSubmit={e => { e.preventDefault(); void action("deployment-request", { branch, commit }, "post"); }}><p className="development-note">Push your finished code to Git, then submit the version to review.</p><div className="development-fields"><Field>Branch<Input required maxLength={200} value={branch} onChange={e => setBranch(e.target.value)} /></Field><Field>Commit SHA<Input required pattern="[0-9a-fA-F]{7,40}" placeholder="a1b2c3d" title="Git commit SHA: 7–40 characters using 0–9 and a–f" value={commit} onInvalid={e => e.currentTarget.setCustomValidity("Enter a Git commit SHA: 7–40 characters using only 0–9 and a–f.")} onInput={e => e.currentTarget.setCustomValidity("")} onChange={e => setCommit(e.target.value)} /><small className="development-hint">The ID of the commit you pushed. Run <code>git rev-parse HEAD</code>, or copy it from the commit list on GitHub.</small></Field></div><Btn type="submit" variant="primary" loading={busy}>Request deployment</Btn></form>}</div>}
    {developing && !owner && <p className="development-note">The requester is developing the application.</p>}
    {(stage === "review" || stage === "approved") && <div className="development-actions"><Badge tone={stage === "approved" ? "success" : "info"}>{stage === "approved" ? "Approved for IT deployment" : "Awaiting IT and committee review"}</Badge>{state.branch && <code>{state.branch} · {state.commit}</code>}{stage === "review" && !owner && <Btn onClick={() => navigate("/reviews")}>Open review workbench</Btn>}</div>}
    {stage !== "draft" && <details className="development-access-summary"><summary>Development accounts · {developers.length}</summary>{developers.map(developer => <div key={developer.email}><strong>{developer.email}</strong><span>Git: {developer.gitReady ? "Ready" : "Pending"}{a.products.length ? ` · API: ${developer.apiReady ? "Ready" : "Pending"}` : ""}</span></div>)}</details>}
    {error && <p role="alert" className="text-danger text-sm mt-3">{error}</p>}
    {["approved", "awaiting-deployment", "deployed", "live", "suspended"].includes(stage) && admin && <div className="development-actions mt-4"><Btn disabled={busy} onClick={() => void action(a.status === "suspended" ? "publish" : "unpublish", {}, "post")}>{a.status === "suspended" ? "Reactivate approval" : "Suspend approval"}</Btn></div>}
  </Panel>}{updateOpen && <RequestUpdateDialog appId={a.id} appName={a.name} initialBranch={state?.branch ?? "main"} onClose={() => setUpdateOpen(false)} onSubmitted={id => { setUpdateOpen(false); navigate(`/my-apps/${id}`); }} />}</>;
}

