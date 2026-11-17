import type { CSSProperties } from "react";
import { AppIcon } from "@/shared/components/Icon";

export interface OrbitItem { icon: string; label: string }

const COLORS = ["#2f7bd0", "#89c64a", "#f2a65a", "#7a8cf0", "#e0789a", "#3fb8c6"];

/**
 * Light-theme hero illustration: a hub in the middle with labelled items orbiting slowly
 * (business areas on the API Catalog, apps on the MGT Ecosystem). Styles: .hero-orbit in styles/workspace.css.
 * Decorative only; the orbit stops when the user prefers reduced motion.
 * compact: for long labels (app names) — up to 5 items on one ring, labels cut with "…" so chips never overlap.
 */
export default function OrbitIllustration({ hub, items, compact = false, className = "" }: { hub: string; items: OrbitItem[]; compact?: boolean; className?: string }) {
  const shown = items.slice(0, compact ? 5 : 6);
  const step = 360 / Math.max(shown.length, 1);
  return (
    <div className={`hero-orbit ${compact ? "hero-orbit-compact" : ""} ${className}`} aria-hidden>
      <span className="hero-orbit-ring r1" /><span className="hero-orbit-ring r2" /><span className="hero-orbit-ring r3" />
      <div className="hero-orbit-hub"><AppIcon value={hub} /></div>
      <div className="hero-orbit-field">
        {shown.map((item, index) => (
          // Each item runs its own orbit (start angle --a, radius --r) and turns back by the same angle, so the
          // label always stays upright, even when items appear later than the hub (e.g. apps load after the page).
          <div key={`${item.label}-${index}`} className="hero-orbit-item" style={{ "--a": `${index * step - 90}deg`, "--r": `${compact ? 112 : index % 2 ? 116 : 84}px` } as CSSProperties}>
            <div className="hero-orbit-chip">
              <span style={{ background: COLORS[index % COLORS.length] }}><AppIcon value={item.icon} /></span>
              <em>{item.label}</em>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
