import type { AppStatus, AppType, CredEnv } from "@/shared/lib/types";

export function Panel({ title, hint, children, className = "" }: { title?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface border border-line rounded-[10px] p-[18px] mb-4 ${className}`}>
      {title && <h3 className="text-[16.5px] font-bold mb-1">{title}</h3>}
      {hint && <div className="text-[14.5px] text-ink-dim mb-3.5">{hint}</div>}
      {children}
    </div>
  );
}

export function Btn({
  variant = "ghost",
  size = "md",
  danger = false,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost"; size?: "md" | "sm"; danger?: boolean }) {
  const base = "inline-flex items-center gap-2 justify-center rounded-lg font-semibold cursor-pointer transition active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed";
  const sizing = size === "sm" ? "text-[15px] px-2.5 py-1.5" : "text-[16px] px-4 py-2.5";
  const variants =
    variant === "primary"
      ? "bg-brand text-white hover:brightness-110"
      : danger
        ? "bg-transparent border border-line-strong text-danger hover:bg-danger-soft"
        : "bg-transparent border border-line-strong text-ink hover:bg-surface-2";
  return <button className={`${base} ${sizing} ${variants} ${className}`} {...props} />;
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
    <span className={`font-mono text-[13.5px] font-bold tracking-wide rounded-md px-2 py-1 w-14 text-center inline-block flex-shrink-0 ${METHOD_STYLE[method] || "bg-surface-2 text-ink-dim"}`}>
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
  return <span className={`text-[13px] font-bold tracking-wide rounded-full px-2.5 py-0.5 whitespace-nowrap ${m.className}`}>{m.label}</span>;
}

const STATUS_META: Record<AppStatus, { label: string; dot: string }> = {
  active: { label: "Active", dot: "bg-post" },
  pending: { label: "Pending Review", dot: "bg-put" },
  draft: { label: "Draft", dot: "bg-ink-faint" },
  suspended: { label: "Suspended", dot: "bg-danger" },
};

export function StatusDot({ status }: { status: AppStatus }) {
  const m = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5">
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
  return <span className={`text-[13px] font-bold tracking-wide rounded-full px-2.5 py-0.5 whitespace-nowrap ${m.className}`}>{m.label}</span>;
}

export function ScopeTag({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] font-mono bg-surface-2 text-ink-dim rounded-full px-2 py-0.5 whitespace-nowrap">{children}</span>;
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div className="text-[15px] text-ink-faint text-center py-4.5">{children}</div>;
}
