import type { ReactNode } from "react";
import "./filters.css";

export function FilterToolbar({ children, label = "Filters" }: { children: ReactNode; label?: string }) {
  return <section className="mgt-filter-toolbar" aria-label={label}>{children}</section>;
}
export function FilterChipGroup({ label, options, values, onChange }: { label: string; options: { value: string; label: string; count?: number }[]; values: string[]; onChange: (values: string[]) => void }) {
  return <fieldset className="mgt-filter-chip-group"><legend>{label}</legend><div>{options.map(option => <button type="button" key={option.value} aria-pressed={values.includes(option.value)} onClick={() => onChange(values.includes(option.value) ? values.filter(value => value !== option.value) : [...values,option.value])}>{option.label}{option.count !== undefined && <span>{option.count}</span>}</button>)}</div></fieldset>;
}
export function ActiveFilterChips({ items, onClear }: { items: { id: string; label: string; onRemove: () => void }[]; onClear: () => void }) {
  if (!items.length) return null;
  return <div className="mgt-active-filters" aria-label="Active filters"><span>Active filters</span>{items.map(item => <button type="button" key={item.id} onClick={item.onRemove} aria-label={`Remove filter: ${item.label}`}>{item.label}<span aria-hidden="true">×</span></button>)}<button type="button" className="mgt-filter-clear" onClick={onClear}>Clear all</button></div>;
}
