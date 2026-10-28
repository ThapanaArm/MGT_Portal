import { useState } from "react";
import { AppIcon } from "./Icon";
import { ICON_OPTIONS, iconKey } from "./icon-catalog";
export { AppIcon } from "./Icon";

export default function IconPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const options = ICON_OPTIONS.filter(([key, label]) => `${key} ${label}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="rounded-xl border border-line bg-surface p-3">
    <div className="flex items-center justify-between gap-3 mb-3"><span className="text-sm font-semibold">Application icon</span><span className="inline-flex items-center gap-2 text-sm text-ink-dim">Selected <AppIcon value={value} /></span></div>
    <input aria-label="Search application icons" placeholder="Search icons, e.g. products, people, reports" value={query} onChange={event => setQuery(event.target.value)} className="mb-3 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
    <div role="group" aria-label="Select application icon" className="flex flex-wrap gap-2">{options.map(([key, label]) => <button key={key} type="button" title={label} aria-label={label} aria-pressed={iconKey(value) === key} onClick={() => onChange(`fa:${key}`)} className={`flex h-10 w-10 items-center justify-center rounded-lg border text-xl transition-colors ${iconKey(value) === key ? "border-teal bg-teal-soft text-teal-strong" : "border-line bg-surface text-ink-dim hover:bg-surface-2"}`}><AppIcon value={`fa:${key}`} /></button>)}</div>
    {!options.length && <p className="py-3 text-sm text-ink-dim">No icons found. Try another search.</p>}
  </div>;
}
