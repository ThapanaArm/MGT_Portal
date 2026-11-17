import { AppIcon } from "@/shared/components/Icon";
import { Bar, Chip, FloatingBadge, GlassCard, IllustrationBackdrop } from "@/shared/components/ApiIllustration";

/** App tiles shown in the launcher card: icon value and tile colour. */
const TILES: [string, string][] = [
  ["fa:chart-line", "linear-gradient(145deg, #4c94e5, #1d5fae)"],
  ["fa:truck", "linear-gradient(145deg, #89c64a, #4f8a1f)"],
  ["fa:flask", "linear-gradient(145deg, #7a8cf0, #4352b8)"],
  ["fa:users", "linear-gradient(145deg, #f2a65a, #c56a1c)"],
  ["fa:warehouse", "linear-gradient(145deg, #3fb8c6, #1c7a86)"],
  ["fa:robot", "linear-gradient(145deg, #e0789a, #a83c62)"],
];
const LABEL_WIDTHS = ["70%", "56%", "64%", "50%", "66%", "58%"];

/**
 * Decorative illustration for the MGT Ecosystem: a launcher of apps built inside the company.
 * Same backdrop and theme variables as ApiIllustration. Animation honours prefers-reduced-motion.
 */
export default function AppsIllustration({ count, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`api-illustration relative h-[268px] rounded-[26px] overflow-hidden select-none ${className}`} aria-hidden style={{ background: "var(--ill-bg)" }}>
      <IllustrationBackdrop green />

      <div className="relative h-full flex items-center justify-center">
        <div className="relative mgt-float">
          <GlassCard badge="APPROVED">
            {/* app grid */}
            <div className="relative grid grid-cols-3 gap-x-3 gap-y-2.5 px-4 py-3">
              {TILES.map(([icon, background], index) => (
                <div key={icon} className="flex flex-col items-center gap-1">
                  <span
                    className="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center text-white text-[16px]"
                    style={{ background, border: "1px solid rgba(255,255,255,.28)", boxShadow: "0 8px 18px -8px rgba(0,0,0,.45)" }}
                  >
                    <AppIcon value={icon} />
                  </span>
                  <Bar width={LABEL_WIDTHS[index]} height={5} />
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Floating "new app" badge */}
          <FloatingBadge icon="fa:plus" color="137,198,74" background="linear-gradient(145deg, #89c64a, #4f8a1f)" />

          {/* Count chip */}
          <Chip><span className="text-[12px] font-semibold">{count ? `${count} approved app${count === 1 ? "" : "s"}` : "Built by your colleagues"}</span></Chip>
        </div>
      </div>
    </div>
  );
}
