import { useId, useState } from "react";
import { Alert } from "@/shared/components/feedback";
import { Field, Input, Textarea, Stepper } from "@/shared/components/design-system";
import { ImageIconPicker, ShotsPicker } from "@/shared/components/MediaPickers";
import { Btn, Panel } from "@/shared/components/ui";
import { AUDIENCES, AUDIENCE_LABEL, TIERS, TIER_NAME, TIER_DESC, TIER_LABEL } from "@/shared/lib/tiers";
import { useAuth } from "@/shared/lib/auth";
import type { AppAudience, AppType, CategoryDto } from "@/shared/lib/types";

export interface AppFormValues { name: string; description: string; subdomain: string; github: string; products: string[]; image: string | null; icon: string; screenshots: string[]; audience: AppAudience; }
export default function AppForm({ title, hint, initial, initialTier, categories, submitLabel, onSubmit, onCancel }: { title: string; hint: string; initial: AppFormValues; initialTier?: AppType; categories: CategoryDto[]; submitLabel: string; onSubmit: (values: AppFormValues, preferredTier?: AppType) => Promise<void>; onCancel: () => void }) {
  const { user } = useAuth();
  const id = useId();
  const [values, setValues] = useState(initial);
  const [step, setStep] = useState(0);
  const [tier, setTier] = useState<AppType>(initial.products.length && (!initialTier || initialTier === "tier1") ? "tier2" : initialTier ?? "tier1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof AppFormValues>(key: K, value: AppFormValues[K]) => setValues(previous => ({ ...previous, [key]: value }));
  function advance() {
    if (!values.name.trim() || !values.description.trim()) { setError("Enter the application name and a description of its purpose."); return; }
    setError(""); setStep(value => Math.min(2, value + 1));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (step < 2) { advance(); return; }
    if (tier === "tier1" && values.products.length) { setError("Tier 1 cannot request API services. Choose Tier 2 or remove the selected services."); return; }
    setBusy(true); setError("");
    try { await onSubmit({ ...values, name: values.name.trim(), subdomain: values.subdomain.trim(), github: values.github.trim() }, tier); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to save this request"); }
    finally { setBusy(false); }
  }
  return <Panel title={title} hint={hint}><form onSubmit={submit} className="request-wizard"><Stepper steps={["Application details", "Audience and tier", "Review summary"]} current={step} />
    {error && <Alert tone="danger" title="Check your request">{error}</Alert>}
    {step === 0 && <div className="request-fields"><Field>Application name *<Input autoFocus required value={values.name} onChange={event => set("name", event.target.value)} placeholder="e.g. HR Management System" /></Field><Field>Purpose *<Textarea required rows={3} value={values.description} onChange={event => set("description", event.target.value)} placeholder="Describe the problem this application will solve" /></Field><Field>Requested subdomain<Input value={values.subdomain} onChange={event => set("subdomain", event.target.value)} placeholder="e.g. hrms" /><small>IT will configure the company domain after approval.</small></Field>{user?.roleKey === "admin" ? <Field>GitHub repository<Input value={values.github} onChange={event => set("github", event.target.value)} placeholder="https://github.com/company/repository" /><small>Provide the repository for IT review and offline deployment.</small></Field> : <div className="app-request-owned-note"><strong>Git repository: managed by IT</strong></div>}<details className="request-media"><summary>Branding and screenshots (optional)</summary><ImageIconPicker image={values.image} icon={values.icon} onImageChange={value => set("image", value)} onIconChange={value => set("icon", value)} /><ShotsPicker shots={values.screenshots} onChange={value => set("screenshots", value)} /></details></div>}
    {step === 1 && <div className="request-fields"><fieldset><legend>Who can use the application?</legend><div className="request-choices">{AUDIENCES.map(audience => <label key={audience}><Input type="radio" name={`${id}-audience`} checked={values.audience === audience} onChange={() => set("audience", audience)} />{AUDIENCE_LABEL[audience]}</label>)}</div></fieldset>
      <fieldset><legend>Application tier</legend><div className="tier-choice-grid">{TIERS.map(option => <label key={option} data-selected={tier === option} aria-disabled={option === "tier3" && user?.roleKey !== "admin"}><Input type="radio" name={`${id}-tier`} checked={tier === option} disabled={(option === "tier3" && user?.roleKey !== "admin") || (option === "tier1" && values.products.length > 0)} onChange={() => setTier(option)} /><strong>{TIER_LABEL[option]} · {TIER_NAME[option]}</strong><small>{TIER_DESC[option]}</small></label>)}</div></fieldset>
      <fieldset><legend>Required business services</legend><p className="review-note">Select the company services your application needs. Tier 1 applications do not connect to company APIs.</p><div className="request-choices">{categories.map(category => <label key={category.key}><Input type="checkbox" checked={values.products.includes(category.key)} onChange={() => { set("products", values.products.includes(category.key) ? values.products.filter(key => key !== category.key) : [...values.products, category.key]); if (tier === "tier1") setTier("tier2"); }} />{category.name}</label>)}</div></fieldset>
    </div>}
    {step === 2 && <><dl className="request-summary"><div><dt>Application</dt><dd>{values.name}</dd></div><div><dt>Purpose</dt><dd>{values.description}</dd></div><div><dt>Created by</dt><dd>{user?.email} · {user?.roleKey === "admin" ? "IT administrator" : "Business user"}</dd></div><div><dt>Audience</dt><dd>{AUDIENCE_LABEL[values.audience]}</dd></div><div><dt>Tier</dt><dd>{TIER_LABEL[tier]} · {TIER_NAME[tier]}</dd></div><div><dt>Subdomain</dt><dd>{values.subdomain || "Not provided"}</dd></div><div><dt>Repository</dt><dd>{values.github && values.github !== "-" ? values.github : "To be provided by IT"}</dd></div><div><dt>Business services</dt><dd>{values.products.map(key => categories.find(category => category.key === key)?.name ?? key).join(", ") || "None"}</dd></div></dl><Alert tone="info">{tier === "tier1" ? "Tier 1 does not require committee votes or IT code review." : "This request requires three committee approvals and a separate IT code review."} Saving does not deploy the application. Confirm submission from the request detail page.</Alert></>}
    <footer className="example-form-footer"><Btn type="button" disabled={busy} onClick={onCancel}>Cancel</Btn>{step > 0 && <Btn type="button" disabled={busy} onClick={() => { setError(""); setStep(value => value - 1); }}>Back</Btn>}<Btn type="submit" variant="primary" loading={busy}>{step < 2 ? "Continue" : submitLabel}</Btn></footer>
  </form></Panel>;
}
