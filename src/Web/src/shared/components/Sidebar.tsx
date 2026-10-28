import { AppIcon } from "@/shared/components/Icon";
import { Children, useId, useState } from "react";
import { Link, useLocation } from "react-router";
/** MGT navigation item with a green active-page indicator. */
export function SidebarItem({ href, active, label, children, onClick }: { href: string; active: boolean; label: string; children: React.ReactNode; onClick?: React.MouseEventHandler<HTMLAnchorElement> }) {
  const parts = Children.toArray(children);
  return (
    <Link
      to={href}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`portal-nav-item flex items-center gap-2.5 px-3 py-2.5 rounded-[11px] border text-[15px] font-bold w-full transition-colors ${
        active
          ? "text-teal-strong border-line bg-[linear-gradient(90deg,var(--teal-soft),color-mix(in_srgb,var(--teal-soft)_40%,transparent))] shadow-[inset_3px_0_var(--green),0_6px_18px_rgba(35,104,196,0.07)]"
          : "text-ink-dim border-transparent hover:text-ink hover:bg-surface-2 hover:border-line"
      }`}
    >
      <span className="sidebar-item-icon">{parts[0]}</span>
      <span className="sidebar-item-copy">{parts.slice(1)}</span>
    </Link>
  );
}

/** Foldable navigation groups; navigating into a group reveals its current page. */
export function SidebarGroup({ label, active, collapsed, children }: { label: string; active: boolean; collapsed: boolean; children: React.ReactNode }) {
  const id = useId();
  const { pathname } = useLocation();
  const [closedAt, setClosedAt] = useState<string | null>(null);
  const open = collapsed || closedAt === null || (active && closedAt !== pathname);
  return <div className="sidebar-group" data-active={active}>
    {!collapsed && <button type="button" className="sidebar-group-toggle" aria-expanded={open} aria-controls={id} onClick={() => setClosedAt(open ? pathname : null)}>
      <span>{label}</span>
      <AppIcon value="fa:chevron-down"/>
    </button>}
    <div id={id} hidden={!open} className="sidebar-group-items">{children}</div>
  </div>;
}

/** Trailing navigation count. */
export function SidebarCount({ children, highlight = false }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <span
      data-highlight={highlight}
      className={`text-[11px] font-mono font-semibold rounded-full px-1.5 min-w-6 text-center ${
        highlight ? "text-white bg-brand" : "text-ink-faint bg-surface-2"
      }`}
    >
      {children}
    </span>
  );
}


export function SidebarFrame({children,collapsed=false,onToggle,home="/dashboard",caption="MGT HUB",id="portal-sidebar",onBrandClick}:{children:React.ReactNode;collapsed?:boolean;onToggle?:()=>void;home?:string;caption?:string;id?:string;onBrandClick?:React.MouseEventHandler<HTMLAnchorElement>}){return <aside id={id} aria-label="Main navigation" data-collapsed={collapsed} className="portal-sidebar flex flex-col flex-shrink-0">      <div className="sidebar-brand-header">
        {collapsed && onToggle ? <button type="button" className="sidebar-logo-toggle" onClick={onToggle} aria-controls={id} aria-expanded={false} aria-label="Expand sidebar" title="Expand sidebar">
          <img src="/mgt-logo.png" alt="" />
          <AppIcon value="fa:sidebar"/>
        </button> : <Link to={home} onClick={onBrandClick} className="sidebar-brand">
        <img src="/mgt-logo.png" alt="MGT — Do It Right" className="w-[148px] h-auto object-contain" />
        <span className="text-[12px] text-ink-faint font-extrabold tracking-[0.14em] uppercase">{caption}</span>
      </Link>}
      {onToggle && !collapsed && <button type="button" className="sidebar-collapse-button" onClick={onToggle} aria-controls={id} aria-expanded={!collapsed} aria-label="Collapse sidebar" title="Collapse sidebar">
        <AppIcon value="fa:sidebar"/>
      </button>}
      </div>
<nav className="sidebar-navigation" aria-label="Menu item">{children}</nav></aside>;}
