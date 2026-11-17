import { useEffect, useState } from "react";
import { AppIcon } from "./Icon";
import { ICON_OPTIONS, iconKey } from "./icon-catalog";
import { SOLID_PREFIX, resolveFontAwesomeCode } from "./fa-code";
export { AppIcon } from "./Icon";

/** Pasted Font Awesome code that resolved to an icon, waiting for "Use icon". */
interface CodePreview { value: string; iconName: string; note?: string }

export default function IconPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState<CodePreview | null>(null);
  const [status, setStatus] = useState<{ error: boolean; text: string } | null>(null);
  const options = ICON_OPTIONS.filter(([key, label]) => `${key} ${label}`.toLowerCase().includes(query.trim().toLowerCase()));
  const custom = value.startsWith(SOLID_PREFIX) ? value.slice(SOLID_PREFIX.length) : null;

  // Pasted or typed code is only previewed here; nothing is selected until the user presses "Use icon".
  useEffect(() => {
    setPreview(null);
    if (!code.trim()) { setChecking(false); return; }
    let active = true;
    setChecking(true);
    const timer = window.setTimeout(() => {
      resolveFontAwesomeCode(code).then(result => {
        if (!active) return;
        if (!result.ok) { setStatus({ error: true, text: result.error }); return; }
        // Icons that are already in the list keep their short value, so nothing extra has to load.
        const builtIn = ICON_OPTIONS.find(([, , icon]) => icon.iconName === result.icon.iconName)?.[0];
        setPreview({ value: builtIn ? `fa:${builtIn}` : `${SOLID_PREFIX}${result.icon.iconName}`, iconName: result.icon.iconName, note: result.note });
        setStatus(null);
      }).catch(() => { if (active) setStatus({ error: true, text: "Couldn't load the Font Awesome icons. Try again." }); })
        .finally(() => { if (active) setChecking(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [code]);

  function applyPreview() {
    if (!preview) return;
    onChange(preview.value);
    setStatus({ error: false, text: `Selected "${preview.iconName}". Save the form to keep it.` });
    setCode("");
  }

  const button = (key: string, label: string, iconValue: string, pressed: boolean, onClick: () => void) =>
    <button key={key} type="button" title={label} aria-label={label} aria-pressed={pressed} onClick={onClick} className={`flex h-10 w-10 items-center justify-center rounded-lg border text-xl transition-colors ${pressed ? "border-teal bg-teal-soft text-teal-strong" : "border-line bg-surface text-ink-dim hover:bg-surface-2"}`}><AppIcon value={iconValue} /></button>;

  return <div className="rounded-xl border border-line bg-surface p-3">
    <div className="flex items-center justify-between gap-3 mb-3"><span className="text-sm font-semibold">Application icon</span><span className="inline-flex items-center gap-2 text-sm text-ink-dim">Selected <AppIcon value={value} /></span></div>
    <input aria-label="Search application icons" placeholder="Search icons, e.g. products, people, reports" value={query} onChange={event => setQuery(event.target.value)} className="mb-3 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
    <div role="group" aria-label="Select application icon" className="flex flex-wrap gap-2">
      {custom && button("custom", `Font Awesome: ${custom}`, value, true, () => undefined)}
      {options.map(([key, label]) => button(key, label, `fa:${key}`, iconKey(value) === key, () => onChange(`fa:${key}`)))}
    </div>
    {!options.length && <p className="py-3 text-sm text-ink-dim">No icons found. Try another search, or paste Font Awesome code below.</p>}
    <div className="mt-3 border-t border-line pt-3">
      <label htmlFor="fa-code-input" className="text-sm font-semibold">Or paste Font Awesome code</label>
      <p className="mt-1 mb-2 text-xs text-ink-dim">Open <a href="https://fontawesome.com/icons" target="_blank" rel="noreferrer" className="text-teal-strong">fontawesome.com/icons</a>, pick a Free Solid icon and copy its HTML or React code, e.g. <code>&lt;i class="fa-solid fa-flask"&gt;&lt;/i&gt;</code>.</p>
      <div className="flex gap-2">
        <input id="fa-code-input" value={code} placeholder='<i class="fa-solid fa-flask"></i>' autoComplete="off" spellCheck={false}
          onChange={event => { setCode(event.target.value); setStatus(null); }}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); applyPreview(); } }}
          className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2 font-mono text-sm" />
        <button type="button" disabled={!preview || checking} onClick={applyPreview} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50">{checking ? "Checking..." : "Use icon"}</button>
      </div>
      {preview && <div role="status" className="mt-2 flex items-center gap-3 rounded-lg border border-line bg-paper px-3 py-2 text-sm">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-teal bg-teal-soft text-lg text-teal-strong"><AppIcon value={preview.value} /></span>
        <span className="min-w-0 flex-1"><strong className="font-mono">{preview.iconName}</strong><span className="block text-xs text-ink-dim">{preview.note ?? "Preview. Press Use icon to select it."}</span></span>
      </div>}
      {status && <p role={status.error ? "alert" : "status"} className={`mt-2 text-xs ${status.error ? "text-danger" : "text-ink-dim"}`}>{status.text}</p>}
    </div>
  </div>;
}
