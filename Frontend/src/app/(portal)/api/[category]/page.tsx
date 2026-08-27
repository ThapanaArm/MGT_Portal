"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useEnv, ENV_HOST } from "@/lib/env-context";
import { useAudience } from "@/lib/audience-context";
import AudienceToggle from "@/components/AudienceToggle";
import EndpointCard from "@/components/EndpointCard";
import { EmptyRow, EnvChip } from "@/components/ui";
import type { CategoryDto, EndpointDto } from "@/lib/types";

const CATEGORY_ICONS: Record<string, string> = {
  sales: "📈",
  purchase: "🛍️",
  inventory: "📦",
  finance: "💰",
  hr: "👥",
};

export default function CategoryPage() {
  const { category: key } = useParams<{ category: string }>();
  const { env, setEnv } = useEnv();
  const { audience } = useAudience();
  const [category, setCategory] = useState<CategoryDto | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointDto[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    queueMicrotask(() => setLoading(true));
    Promise.all([
      api.get<CategoryDto[]>("/api/categories").then((cats) => cats.find((c) => c.key === key) ?? null),
      api.get<EndpointDto[]>(`/api/categories/${key}/endpoints`),
    ])
      .then(([cat, eps]) => {
        setCategory(cat);
        setEndpoints(eps);
      })
      .finally(() => setLoading(false));
  }, [key]);

  const filtered = useMemo(
    () => endpoints.filter((e) => (e.path + " " + e.summary + " " + e.scenario).toLowerCase().includes(query.toLowerCase())),
    [endpoints, query]
  );

  if (loading) return <div className="text-ink-faint text-[15.5px]">กำลังโหลด...</div>;
  if (!category) return <div className="text-ink-faint text-[15.5px]">ไม่พบหมวดหมู่นี้</div>;

  const perMinute = category.rateLimit.match(/\d+/)?.[0];

  return (
    <div>
      <AudienceToggle />

      {audience === "business" ? (
        <div className="mb-4 border border-line rounded-[10px] bg-surface p-4 flex gap-3.5 items-start">
          <span className="text-[32px] flex-shrink-0">{CATEGORY_ICONS[category.key] ?? "📁"}</span>
          <div className="flex-1">
            <h1 className="text-[21px] font-bold mb-1">{category.name}</h1>
            <p className="text-ink-dim text-[15.5px] leading-relaxed">{category.description}</p>
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <span className="text-[13.5px] bg-teal-soft text-teal-strong rounded-full px-2.5 py-1 font-semibold">
                🧪 โหมดทดลอง — ข้อมูลไม่จริง เล่นได้ ไม่ต้องกลัวพัง
              </span>
              {perMinute && (
                <span className="text-[13.5px] text-ink-faint">เรียกดูได้สูงสุด {perMinute} ครั้ง/นาที</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
            <div>
              <div className="flex items-center gap-2 text-[13.5px] uppercase tracking-wide text-ink-faint font-bold mb-1.5">
                <span className="w-2 h-2 rounded-sm bg-teal" /> หมวดหมู่ API
              </div>
              <h1 className="text-[26px] font-bold">{category.name}</h1>
            </div>
            <div className="flex bg-surface-2 border border-line-strong rounded-lg p-0.5 gap-0.5">
              {(["sandbox", "production"] as const).map((e) => (
                <button
                  key={e}
                  onClick={() => setEnv(e)}
                  className={`px-3 py-1.5 rounded-md text-[14.5px] font-semibold ${
                    env === e ? (e === "sandbox" ? "bg-surface text-teal-strong shadow-sm" : "bg-amber-soft text-amber") : "text-ink-dim"
                  }`}
                >
                  {e === "sandbox" ? "Sandbox" : "Production"}
                </button>
              ))}
            </div>
          </div>
          <p className="text-ink-dim text-[16px] mb-3.5 max-w-[62ch] leading-relaxed">{category.description}</p>

          <div className="flex items-center gap-2.5 bg-surface border border-line rounded-lg px-3 py-2 mb-2 font-mono text-[15px] flex-wrap">
            <span className="text-ink-faint font-sans text-[13.5px] uppercase tracking-wide">Base URL</span>
            <code className="text-teal-strong">https://{ENV_HOST[env]}{category.basePath}</code>
            <EnvChip env={env} />
            <span className="text-ink-faint font-sans text-[13.5px] uppercase tracking-wide ml-auto">Rate Limit</span>
            <code>{category.rateLimit}</code>
          </div>

          {env === "production" && (
            <div className="flex items-center gap-2 bg-amber-soft text-amber border border-line rounded-lg px-3 py-2.5 text-[15px] mb-4">
              ⚠️ <span>โหมด Production — การเรียก API จริงจะมีผลกับข้อมูลจริงของบริษัท ใช้ Token ระดับ Production เท่านั้น</span>
            </div>
          )}
        </>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={audience === "business" ? "ค้นหาสิ่งที่อยากทำ เช่น ยอดขาย ใบแจ้งหนี้..." : "ค้นหา endpoint, path, คำอธิบาย..."}
        className="w-full border border-line-strong bg-surface rounded-lg px-3 py-2 text-[15.5px] mb-3.5"
      />

      {filtered.map((e) => (
        <EndpointCard key={e.id} category={category} endpoint={e} />
      ))}
      {!filtered.length && <EmptyRow>ไม่พบ endpoint ที่ตรงกับคำค้นหา</EmptyRow>}
    </div>
  );
}
