import type { ReactNode } from "react";
import { AppIcon } from "@/shared/components/Icon";

/**
 * Decorative API illustration. Colours come from the --ill-* variables in styles/workspace.css,
 * so it follows the light / dark theme. Animation honours prefers-reduced-motion.
 */
export default function ApiIllustration({ className = "" }: { className?: string }) {
  return (
    <div className={`api-illustration relative h-[268px] rounded-[26px] overflow-hidden select-none ${className}`} aria-hidden style={{ background: "var(--ill-bg)" }}>
      <IllustrationBackdrop />

      <div className="relative h-full flex items-center justify-center">
        <div className="relative mgt-float">
          {/* Glass request card */}
          <GlassCard badge="200 OK">
            {/* request line */}
            <div className="relative px-3.5 pt-3.5 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-[11.5px] font-extrabold tracking-wider rounded px-1.5 py-[3px]" style={{ color: "#0b2038", background: "#8dc2ff" }}>
                  GET
                </span>
                <span className="font-mono text-[14px]" style={{ color: "var(--ill-ink)" }}>/v1/sales/orders</span>
              </div>

              {/* response skeleton */}
              <div className="mt-3.5 flex flex-col gap-[7px]">
                <div className="flex gap-1.5">
                  <Bar width="34%" /><Bar width="22%" color="var(--ill-accent-bar)" /><Bar width="18%" soft />
                </div>
                <div className="flex gap-1.5">
                  <Bar width="26%" soft /><Bar width="42%" />
                </div>
                <div className="flex gap-1.5">
                  <Bar width="20%" color="rgba(137,198,74,.5)" /><Bar width="30%" soft /><Bar width="16%" />
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Floating security badge */}
          <FloatingBadge icon="fa:lock" color="76,148,229" background="linear-gradient(145deg, #4c94e5, #164f9b)" />

          {/* Scope chip */}
          <Chip><span className="font-mono text-[12px]">sales.read</span></Chip>
        </div>
      </div>
    </div>
  );
}

/** Aurora blobs, fine grid and drifting specks shared by the hero illustrations. */
export function IllustrationBackdrop({ green = false }: { green?: boolean }) {
  return <>
    <div className="absolute rounded-full" style={{ width: 280, height: 280, left: -80, top: -110, opacity: "var(--ill-blob-opacity)", background: green ? "radial-gradient(circle, rgba(137,198,74,.32), transparent 62%)" : "radial-gradient(circle, rgba(76,148,229,.5), transparent 62%)", filter: "blur(34px)" }} />
    <div className="absolute rounded-full" style={{ width: 240, height: 240, right: -70, bottom: -100, opacity: "var(--ill-blob-opacity)", background: "radial-gradient(circle, rgba(34,95,174,.75), transparent 62%)", filter: "blur(36px)" }} />
    <div className="absolute rounded-full" style={{ width: 160, height: 160, right: 30, top: -60, opacity: "var(--ill-blob-opacity)", background: green ? "radial-gradient(circle, rgba(76,148,229,.45), transparent 62%)" : "radial-gradient(circle, rgba(137,198,74,.3), transparent 62%)", filter: "blur(32px)" }} />

    {/* fine grid, faded at the edges */}
    <div
      className="absolute inset-0 opacity-[0.16]"
      style={{
        backgroundImage: "linear-gradient(var(--ill-grid) 1px, transparent 1px), linear-gradient(90deg, var(--ill-grid) 1px, transparent 1px)",
        backgroundSize: "34px 34px",
        maskImage: "radial-gradient(115% 85% at 50% 42%, #000 38%, transparent 76%)",
        WebkitMaskImage: "radial-gradient(115% 85% at 50% 42%, #000 38%, transparent 76%)",
      }}
    />

    {/* drifting light specks */}
    <span className="absolute w-1 h-1 rounded-full mgt-float-soft" style={{ left: "12%", top: "26%", background: "var(--ill-speck)" }} />
    <span className="absolute w-1.5 h-1.5 rounded-full bg-[#8dc2ff]/70 mgt-float" style={{ right: "13%", top: "20%" }} />
    <span className="absolute w-1 h-1 rounded-full bg-[#89c64a]/70 mgt-float-soft" style={{ right: "20%", bottom: "16%" }} />
  </>;
}

/** Glass window with three dots and a green status badge. */
export function GlassCard({ badge, children }: { badge: string; children: ReactNode }) {
  return (
    <div
      className="relative w-[286px] rounded-[18px] overflow-hidden"
      style={{ background: "var(--ill-glass)", border: "1px solid var(--ill-glass-border)", boxShadow: "var(--ill-shadow)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
    >
      {/* light sweep across the glass */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 bottom-0 w-16 mgt-sweep" style={{ background: "linear-gradient(90deg, transparent, var(--ill-sweep), transparent)" }} />
      </div>
      {/* title bar */}
      <div className="relative flex items-center gap-1.5 px-3.5 py-2.5" style={{ borderBottom: "1px solid var(--ill-line)" }}>
        <span className="w-[7px] h-[7px] rounded-full" style={{ background: "var(--ill-dot)" }} />
        <span className="w-[7px] h-[7px] rounded-full" style={{ background: "var(--ill-dot)" }} />
        <span className="w-[7px] h-[7px] rounded-full" style={{ background: "var(--ill-dot)" }} />
        <span className="ml-auto text-[11.5px] font-bold tracking-[0.12em] rounded-full px-2 py-[3px]" style={{ color: "var(--ill-ok-ink)", background: "var(--ill-ok-bg)", border: "1px solid rgba(137,198,74,.35)" }}>
          {badge}
        </span>
      </div>
      {children}
    </div>
  );
}

/** Skeleton line inside a glass card. */
export function Bar({ width, soft = false, color, height = 7 }: { width: string; soft?: boolean; color?: string; height?: number }) {
  return <span className="rounded-full" style={{ width, height, background: color ?? (soft ? "var(--ill-skel-soft)" : "var(--ill-skel)") }} />;
}

/** Glowing square badge floating at the card's bottom-right corner. color = "r,g,b" of the glow. */
export function FloatingBadge({ icon, color, background }: { icon: string; color: string; background: string }) {
  return (
    <div className="absolute -right-5 -bottom-5 mgt-float-soft">
      <span className="absolute inset-0 rounded-[18px] mgt-ring" style={{ background: `rgba(${color},.45)` }} />
      <div
        className="relative w-[58px] h-[58px] rounded-[18px] flex items-center justify-center text-white"
        style={{ background, border: "1px solid rgba(255,255,255,.35)", boxShadow: `0 14px 30px -6px rgba(0,0,0,.35), 0 0 34px rgba(${color},.4)` }}
      >
        <AppIcon value={icon} className="w-6 h-6" />
      </div>
    </div>
  );
}

/** Small glass chip floating at the card's top-left corner. */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <div
      className="absolute -left-4 -top-4 flex items-center gap-1.5 rounded-full px-2.5 py-1 mgt-float-soft"
      style={{ color: "var(--ill-chip-ink)", background: "var(--ill-chip)", border: "1px solid var(--ill-chip-border)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", boxShadow: "0 10px 24px -8px rgba(0,0,0,.3)" }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#89c64a" }} />
      {children}
    </div>
  );
}
