import { useEffect, useRef, useState } from "react";
import { FilterToolbar, FilterChipGroup, ActiveFilterChips } from "@/shared/components/filters";
import { Input, Select, Field, Dialog, DataTable, Badge } from "@/shared/components/design-system";
import { Btn, Panel } from "@/shared/components/ui";
import { AppIcon } from "@/shared/components/Icon";
import { useExample } from "../example-context";
import { total, money, number } from "../data";

type Filters = { statuses: string[]; customer: string; from: string; to: string; min: string; max: string };
const empty: Filters = {statuses:[],customer:"",from:"",to:"",min:"",max:""};
const statuses = ["Draft","Pending confirmation","Confirmed"];
const variants = [
  { id:"chips",title:"Quick chips",icon:"fa:tag",hint:"Fast, multi-select status filters" },
  { id:"inline",title:"Inline toolbar",icon:"fa:search",hint:"Search and dropdowns in one row" },
  { id:"panel",title:"Advanced panel",icon:"fa:sliders",hint:"All conditions visible together" },
  { id:"popover",title:"Filter popover",icon:"fa:filter",hint:"Compact filters beside the trigger" },
  { id:"modal",title:"Centered modal",icon:"fa:sidebar",hint:"A focused, medium-size filter form" },
  { id:"drawer",title:"Filter drawer",icon:"fa:bars",hint:"More room for detailed conditions" },
];
function FilterFields({ value, onChange, customers }: {value:Filters; onChange:(value:Filters)=>void; customers:string[]}) {
  const update = (next:Partial<Filters>) => onChange({...value,...next});
  return <div className="example-filter-fields"><fieldset className="wide"><legend>Order status</legend><div className="example-filter-statuses">{statuses.map(status => <label key={status}><Input type="checkbox" checked={value.statuses.includes(status)} onChange={event => update({statuses:event.target.checked ? [...value.statuses,status] : value.statuses.filter(item => item!==status)})} />{status}</label>)}</div></fieldset><Field className="wide">Customer<Select value={value.customer} onChange={event => update({customer:event.target.value})}><option value="">All customers</option>{customers.map(customer => <option key={customer}>{customer}</option>)}</Select></Field><Field>Order date from<Input type="date" value={value.from} max={value.to || undefined} onChange={event => update({from:event.target.value})} /></Field><Field>Order date to<Input type="date" value={value.to} min={value.from || undefined} onChange={event => update({to:event.target.value})} /></Field><Field>Minimum total (THB)<Input type="number" min="0" step="0.01" value={value.min} placeholder="No minimum" onChange={event => update({min:event.target.value})} /></Field><Field>Maximum total (THB)<Input type="number" min={value.min || "0"} step="0.01" value={value.max} placeholder="No maximum" onChange={event => update({max:event.target.value})} /></Field></div>;
}
export default function FiltersPage() {
  const { orders } = useExample();
  const [variant,setVariant] = useState("chips");
  const [query,setQuery] = useState("");
  const [applied,setApplied] = useState<Filters>(empty);
  const [draft,setDraft] = useState<Filters>(empty);
  const updateApplied = (value:Filters) => { setApplied(value); setDraft(value); };
  const [open,setOpen] = useState(false);
  const [error,setError] = useState("");
  const popover = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open || variant !== "popover") return;
    const panel = popover.current;
    panel?.querySelector<HTMLInputElement>("input")?.focus();
    const dismiss = (event:PointerEvent) => { if (!panel?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown",dismiss);
    return () => document.removeEventListener("pointerdown",dismiss);
  },[open,variant]);
  const customers = [...new Set(orders.map(order => order.customer))].sort();
  const filtered = orders.filter(order => {
    const amount = total(order);
    return (!query.trim() || `${number(order.id)} ${order.customer} ${order.email}`.toLowerCase().includes(query.trim().toLowerCase())) && (!applied.statuses.length || applied.statuses.includes(order.status)) && (!applied.customer || order.customer === applied.customer) && (!applied.from || order.date >= applied.from) && (!applied.to || order.date <= applied.to) && (!applied.min || amount >= Number(applied.min)) && (!applied.max || amount <= Number(applied.max));
  }).sort((a,b) => b.date.localeCompare(a.date));
  const clear = () => { updateApplied(empty); setDraft(empty); setQuery(""); setError(""); };
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const apply = (event:React.FormEvent) => { event.preventDefault(); if ((draft.from && draft.to && draft.from > draft.to) || (draft.min && draft.max && Number(draft.min) > Number(draft.max))) { setError("The start must be less than or equal to the end of the range."); return; } updateApplied(draft); setError(""); close(); };
  const filterCount = applied.statuses.length + [applied.customer,applied.from,applied.to,applied.min,applied.max].filter(Boolean).length;
  const active = [
    ...(query ? [{id:"search",label:`Search: ${query}`,onRemove:()=>setQuery("")}] : []),
    ...applied.statuses.map(status => ({id:status,label:status,onRemove:()=>updateApplied({...applied,statuses:applied.statuses.filter(item=>item!==status)})})),
    ...([ ["customer","Customer"],["from","From"],["to","To"],["min","Min THB"],["max","Max THB"] ] as const).filter(([key])=>applied[key]).map(([key,label])=>({id:key,label:`${label}: ${applied[key]}`,onRemove:()=>updateApplied({...applied,[key]:""})})),
  ];
  const fields = <FilterFields value={draft} onChange={setDraft} customers={customers} />;
  const form = <form onSubmit={apply}>{fields}{error && <p role="alert" className="text-danger text-xs mt-4">{error}</p>}<div className="example-filter-actions"><Btn type="button" onClick={()=>{setDraft(empty);setError("");}}>Reset fields</Btn>{variant !== "panel" && <Btn type="button" onClick={close}>Cancel</Btn>}<Btn variant="primary" type="submit">Apply filters</Btn></div></form>;
  return <>
    <div className="example-filter-variants" role="group" aria-label="Filter examples">{variants.map(item => <button key={item.id} type="button" aria-pressed={variant===item.id} onClick={()=>{setVariant(item.id);setOpen(false);setDraft(applied);setError("");}}><AppIcon value={item.icon} /><strong>{item.title}</strong><small>{item.hint}</small></button>)}</div>
    <FilterToolbar label="Sales order filters"><div className="mgt-filter-search"><AppIcon value="fa:search" /><Input aria-label="Search example orders" placeholder="Search order number, customer, or email..." value={query} onChange={event=>setQuery(event.target.value)} /></div>
      {variant === "inline" && <><label>Status<Select value={applied.statuses.length > 1 ? "__multiple" : applied.statuses[0] || ""} onChange={event=>updateApplied({...applied,statuses:event.target.value ? [event.target.value] : []})}><option value="">All statuses</option>{applied.statuses.length > 1 && <option value="__multiple" disabled>Multiple statuses ({applied.statuses.length})</option>}{statuses.map(status=><option key={status}>{status}</option>)}</Select></label><label>Customer<Select value={applied.customer} onChange={event=>updateApplied({...applied,customer:event.target.value})}><option value="">All customers</option>{customers.map(customer=><option key={customer}>{customer}</option>)}</Select></label></>}
      {(variant === "popover" || variant === "drawer" || variant === "modal") && <div className="example-filter-popover"><button ref={trigger} type="button" className="portal-button" aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setDraft(applied);setError("");setOpen(value=>!value);}}><AppIcon value="fa:filter" /> Filters{filterCount > 0 ? ` (${filterCount})` : ""}</button>{open && variant === "popover" && <div ref={popover} role="dialog" aria-label="Filter sales orders" className="example-filter-popover-panel" onKeyDown={event=>{if(event.key==="Escape"){event.stopPropagation();close();}}} onBlur={event=>{if(event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget!==trigger.current)setOpen(false);}}><h3>Filter sales orders</h3>{form}</div>}</div>}
      <Btn disabled={!active.length} onClick={clear}>Clear all</Btn>
    </FilterToolbar>
    {variant === "chips" && <Panel className="mt-4"><FilterChipGroup label="Order status · select one or more" options={statuses.map(status=>({value:status,label:status,count:orders.filter(order=>order.status===status).length}))} values={applied.statuses} onChange={values=>updateApplied({...applied,statuses:values})} /></Panel>}
    {variant === "panel" && <Panel title="Advanced filters" hint="Combine conditions, then apply them to the table." className="mt-4">{form}</Panel>}
    <ActiveFilterChips items={active} onClear={clear} />
    <div className="example-filter-results-heading"><h2>Sales order results</h2><span role="status">{filtered.length} of {orders.length} orders · example data</span></div>
    <DataTable rows={filtered} rowKey={order=>String(order.id)} empty="No orders match these filters. Remove a filter or clear all to see more results." columns={[{key:"id",title:"Order",render:order=><><strong>{number(order.id)}</strong><small>{order.date}</small></>},{key:"customer",title:"Customer",render:order=><>{order.customer}<small>{order.email}</small></>},{key:"status",title:"Status",render:order=><Badge tone={order.status==="Confirmed"?"success":order.status==="Draft"?"neutral":"warning"}>{order.status}</Badge>},{key:"total",title:"Total (THB)",align:"right",render:order=>money(total(order))}]} />
    <Dialog drawer={variant==="drawer"} size="md" open={open && (variant==="drawer" || variant==="modal")} title="Filter sales orders" onClose={close}>{form}</Dialog>
  </>;
}
