"use client";

import { useAudience } from "@/lib/audience-context";

export default function AudienceToggle({ className = "mb-4" }: { className?: string }) {
  const { audience, setAudience } = useAudience();
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="inline-flex bg-surface-2 border border-line-strong rounded-lg p-0.5 gap-0.5">
        <button
          onClick={() => setAudience("business")}
          className={`px-3.5 py-1.5 rounded-md text-[15px] font-semibold ${audience === "business" ? "bg-surface text-teal-strong shadow-sm" : "text-ink-dim"}`}
        >
          🙋 ฉันอยากดูข้อมูล
        </button>
        <button
          onClick={() => setAudience("developer")}
          className={`px-3.5 py-1.5 rounded-md text-[15px] font-semibold ${audience === "developer" ? "bg-surface text-teal-strong shadow-sm" : "text-ink-dim"}`}
        >
          🧑‍💻 ฉันเป็นนักพัฒนา
        </button>
      </div>
    </div>
  );
}
