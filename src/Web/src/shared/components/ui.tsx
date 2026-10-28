import "@/styles/buttons.css";
import type { AppStatus, AppType, CredEnv } from "@/shared/lib/types";
import { AppIcon } from "./IconPicker";

export function Panel({ title, hint, children, className = "" }: { title?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`portal-panel ${className}`}>
      {(title || hint) && <div className="portal-panel-heading">
        {title && <h3 className="portal-panel-title">{title}</h3>}
        {hint && <div className="portal-panel-hint">{hint}</div>}
      </div>}
      {children}
    </div>
  );
}

/** MGT buttons: use one blue primary action per section, green for secondary actions, and outlined ghost buttons. */
export function Btn({
  variant = "ghost",
  size = "md",
  danger = false,
  loading = false,
  startIcon,
  endIcon,
  iconOnly = false,
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost"; size?: "md" | "sm" | "lg"; danger?: boolean; loading?: boolean; startIcon?: React.ReactNode; endIcon?: React.ReactNode; iconOnly?: boolean }) {
  return <button className={`portal-button portal-button-${variant} ${size === "sm" ? "portal-button-sm" : size === "lg" ? "portal-button-lg" : ""} ${danger ? "portal-button-danger" : ""} ${iconOnly ? "portal-button-icon-only" : ""} ${className}`} {...props} disabled={loading || props.disabled} aria-busy={loading || undefined}>{loading ? <span className="mgt-button-spinner" aria-hidden="true" /> : startIcon && <span className="portal-button-icon" aria-hidden="true">{startIcon}</span>}<span className="portal-button-label">{children}</span>{endIcon && <span className="portal-button-icon" aria-hidden="true">{endIcon}</span>}</button>;
}

const METHOD_STYLE: Record<string, string> = {
  GET: "bg-get-soft text-get",
  POST: "bg-post-soft text-post",
  PUT: "bg-put-soft text-put",
  PATCH: "bg-patch-soft text-patch",
  DELETE: "bg-delete-soft text-delete",
};

export function MethodBadge({ method }: { method: string }) {
  return (
    <span className={`portal-method font-mono text-[13.5px] font-bold tracking-wide rounded-md px-2 py-1 w-14 text-center inline-block flex-shrink-0 ${METHOD_STYLE[method] || "bg-surface-2 text-ink-dim"}`}>
      {method}
    </span>
  );
}

const TYPE_META: Record<AppType, { label: string; className: string }> = {
  tier1: { label: "Tier 1", className: "bg-surface-2 text-ink-dim" },
  tier2: { label: "Tier 2", className: "bg-put-soft text-put" },
  tier3: { label: "Tier 3", className: "bg-teal-soft text-teal-strong" },
};

export function TypeChip({ type }: { type: AppType }) {
  const m = TYPE_META[type] ?? { label: type, className: "bg-surface-2 text-ink-dim" };
  return <span className={`portal-chip text-[13px] font-bold tracking-wide rounded-full px-2.5 py-0.5 whitespace-nowrap ${m.className}`}>{m.label}</span>;
}

const STATUS_META: Record<AppStatus, { label: string; dot: string }> = {
  active: { label: "Approved", dot: "bg-post" },
  pending: { label: "Pending Review", dot: "bg-put" },
  draft: { label: "Draft", dot: "bg-ink-faint" },
  suspended: { label: "Suspended", dot: "bg-danger" },
};

export function StatusDot({ status }: { status: AppStatus }) {
  const m = STATUS_META[status];
  return (
    <span className="portal-status inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full inline-block ${m.dot}`} />
      <span className="text-[14px] text-ink-dim font-semibold">{m.label}</span>
    </span>
  );
}

const ENV_META: Record<CredEnv, { label: string; className: string }> = {
  sandbox: { label: "Sandbox", className: "bg-teal-soft text-teal-strong" },
  production: { label: "Production", className: "bg-amber-soft text-amber" },
};

export function EnvChip({ env }: { env: CredEnv }) {
  const m = ENV_META[env];
  return <span className={`portal-chip text-[13px] font-bold tracking-wide rounded-full px-2.5 py-0.5 whitespace-nowrap ${m.className}`}>{m.label}</span>;
}

export function ScopeTag({ children }: { children: React.ReactNode }) {
  return <span className="portal-scope text-[13px] font-mono bg-surface-2 text-ink-dim rounded-full px-2 py-0.5 whitespace-nowrap">{children}</span>;
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div className="text-[15px] text-ink-faint text-center py-4.5">{children}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="workspace-empty"><span className="workspace-empty-icon" aria-hidden="true"><AppIcon value="fa:box" /></span><h2>{title}</h2><p>{description}</p>{action}</div>;
}
