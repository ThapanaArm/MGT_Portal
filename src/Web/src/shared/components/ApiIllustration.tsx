import { AppIcon } from "@/shared/components/Icon";
/** Decorative API illustration. Animation honours prefers-reduced-motion. */
export default function ApiIllustration({ className = "" }: { className?: string }) {
  return (
    <div
            className={`api-illustration relative h-[268px] rounded-[26px] overflow-hidden select-none ${className}`}
            aria-hidden
            style={{ background: "linear-gradient(135deg, #06131f, #0b2947 58%, #13505e)" }}
          >
            {/* aurora blobs */}
            <div className="absolute rounded-full" style={{ width: 280, height: 280, left: -80, top: -110, background: "radial-gradient(circle, rgba(76,148,229,.5), transparent 62%)", filter: "blur(34px)" }} />
            <div className="absolute rounded-full" style={{ width: 240, height: 240, right: -70, bottom: -100, background: "radial-gradient(circle, rgba(34,95,174,.75), transparent 62%)", filter: "blur(36px)" }} />
            <div className="absolute rounded-full" style={{ width: 160, height: 160, right: 30, top: -60, background: "radial-gradient(circle, rgba(137,198,74,.3), transparent 62%)", filter: "blur(32px)" }} />

            {/* fine grid, faded at the edges */}
            <div
              className="absolute inset-0 opacity-[0.16]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
                backgroundSize: "34px 34px",
                maskImage: "radial-gradient(115% 85% at 50% 42%, #000 38%, transparent 76%)",
                WebkitMaskImage: "radial-gradient(115% 85% at 50% 42%, #000 38%, transparent 76%)",
              }}
            />

            {/* drifting light specks */}
            <span className="absolute w-1 h-1 rounded-full bg-white/60 mgt-float-soft" style={{ left: "12%", top: "26%" }} />
            <span className="absolute w-1.5 h-1.5 rounded-full bg-[#8dc2ff]/70 mgt-float" style={{ right: "13%", top: "20%" }} />
            <span className="absolute w-1 h-1 rounded-full bg-[#89c64a]/70 mgt-float-soft" style={{ right: "20%", bottom: "16%" }} />

            <div className="relative h-full flex items-center justify-center">
              <div className="relative mgt-float">
                {/* Glass request card */}
                <div
                  className="relative w-[286px] rounded-[18px] overflow-hidden"
                  style={{
                    background: "rgba(255,255,255,.09)",
                    border: "1px solid rgba(255,255,255,.2)",
                    boxShadow: "0 26px 55px -14px rgba(0,0,0,.65)",
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                  }}
                >
                  {/* light sweep across the glass */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div
                      className="absolute top-0 bottom-0 w-16 mgt-sweep"
                      style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.14), transparent)" }}
                    />
                  </div>

                  {/* title bar */}
                  <div className="relative flex items-center gap-1.5 px-3.5 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,.12)" }}>
                    <span className="w-[7px] h-[7px] rounded-full bg-white/25" />
                    <span className="w-[7px] h-[7px] rounded-full bg-white/25" />
                    <span className="w-[7px] h-[7px] rounded-full bg-white/25" />
                    <span
                      className="ml-auto text-[11.5px] font-bold tracking-[0.12em] rounded-full px-2 py-[3px]"
                      style={{ color: "#aeda83", background: "rgba(137,198,74,.14)", border: "1px solid rgba(137,198,74,.3)" }}
                    >
                      200 OK
                    </span>
                  </div>

                  {/* request line */}
                  <div className="relative px-3.5 pt-3.5 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[11.5px] font-extrabold tracking-wider rounded px-1.5 py-[3px]" style={{ color: "#0b2038", background: "#8dc2ff" }}>
                        GET
                      </span>
                      <span className="font-mono text-[14px] text-white/90">/v1/sales/orders</span>
                    </div>

                    {/* response skeleton */}
                    <div className="mt-3.5 flex flex-col gap-[7px]">
                      <div className="flex gap-1.5">
                        <span className="h-[7px] rounded-full bg-white/22" style={{ width: "34%" }} />
                        <span className="h-[7px] rounded-full" style={{ width: "22%", background: "rgba(141,194,255,.55)" }} />
                        <span className="h-[7px] rounded-full bg-white/14" style={{ width: "18%" }} />
                      </div>
                      <div className="flex gap-1.5">
                        <span className="h-[7px] rounded-full bg-white/14" style={{ width: "26%" }} />
                        <span className="h-[7px] rounded-full bg-white/22" style={{ width: "42%" }} />
                      </div>
                      <div className="flex gap-1.5">
                        <span className="h-[7px] rounded-full" style={{ width: "20%", background: "rgba(137,198,74,.5)" }} />
                        <span className="h-[7px] rounded-full bg-white/14" style={{ width: "30%" }} />
                        <span className="h-[7px] rounded-full bg-white/22" style={{ width: "16%" }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating security badge */}
                <div className="absolute -right-5 -bottom-5 mgt-float-soft">
                  <span className="absolute inset-0 rounded-[18px] mgt-ring" style={{ background: "rgba(76,148,229,.45)" }} />
                  <div
                    className="relative w-[58px] h-[58px] rounded-[18px] flex items-center justify-center"
                    style={{
                      background: "linear-gradient(145deg, #4c94e5, #164f9b)",
                      border: "1px solid rgba(255,255,255,.35)",
                      boxShadow: "0 14px 30px -6px rgba(0,0,0,.55), 0 0 34px rgba(76,148,229,.45)",
                    }}
                  >
                    <AppIcon value="fa:lock" className="w-6 h-6"/>
                  </div>
                </div>

                {/* Scope chip */}
                <div
                  className="absolute -left-4 -top-4 flex items-center gap-1.5 rounded-full px-2.5 py-1 mgt-float-soft"
                  style={{
                    background: "rgba(255,255,255,.12)",
                    border: "1px solid rgba(255,255,255,.24)",
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                    boxShadow: "0 10px 24px -8px rgba(0,0,0,.5)",
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#89c64a" }} />
                  <span className="font-mono text-[12px] text-white/85">sales.read</span>
                </div>
              </div>
            </div>
          </div>
  );
}
