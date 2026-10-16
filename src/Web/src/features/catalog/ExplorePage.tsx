import { useEffect, useMemo, useState } from "react";
import { api } from "@/shared/lib/api";
import AudienceToggle from "@/features/catalog/components/AudienceToggle";
import EndpointCard from "@/features/catalog/components/EndpointCard";
import { EmptyRow } from "@/shared/components/ui";
import type { CategoryDto, EndpointDto } from "@/shared/lib/types";

const CATEGORY_ICONS: Record<string, string> = {
  sales: "📈",
  purchase: "🛍️",
  inventory: "📦",
  finance: "💰",
  hr: "👥",
};

const SUGGESTIONS = ["ยอดขาย", "ใบแจ้งหนี้", "สต๊อกสินค้า", "อนุมัติใบสั่งซื้อ", "ขอลา", "เงินเดือน", "ลูกค้า"];

export default function ExplorePage() {
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [endpoints, setEndpoints] = useState<EndpointDto[]>([]);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<CategoryDto[]>("/api/categories"),
      api.get<EndpointDto[]>("/api/categories/endpoints"),
    ])
      .then(([cats, eps]) => {
        setCategories(cats);
        setEndpoints(eps);
      })
      .finally(() => setLoading(false));
  }, []);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return endpoints.filter((e) => {
      const cat = catById.get(e.categoryId);
      if (catFilter !== "all" && cat?.key !== catFilter) return false;
      if (!q) return true;
      const haystack = `${e.summary} ${e.scenario} ${cat?.name ?? ""} ${cat?.description ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [endpoints, query, catFilter, catById]);

  if (loading) return <div className="text-ink-faint text-[15.5px]">กำลังโหลด...</div>;

  return (
    <div>
      <div className="text-center mb-6 mt-2">
        <h1 className="text-[28px] font-bold text-balance">คุณต้องการนำข้อมูลอะไรไปใช้?</h1>
        <p className="text-ink-dim text-[16px] mt-2">ค้นหาข้อมูลและบริการที่พร้อมนำไปพัฒนา Application</p>

        <div className="max-w-[520px] mx-auto mt-5">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="เช่น ยอดขายลูกค้า, สต๊อกสินค้า, ใบแจ้งหนี้..."
            className="w-full border border-line-strong bg-surface rounded-xl px-4 py-3 text-[16.5px] shadow-sm"
          />
        </div>

        {!query && (
          <div className="flex items-center justify-center gap-1.5 flex-wrap mt-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                className="text-[14px] border border-line-strong bg-surface text-ink-dim rounded-full px-3 py-1 hover:bg-surface-2"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <AudienceToggle />

      <div className="flex items-center justify-center gap-1.5 flex-wrap mb-5">
        <button
          onClick={() => setCatFilter("all")}
          className={`text-[14.5px] font-semibold rounded-full px-3 py-1.5 border ${
            catFilter === "all" ? "bg-teal-soft border-teal text-teal-strong" : "border-line-strong bg-surface text-ink-dim hover:bg-surface-2"
          }`}
        >
          ทั้งหมด
        </button>
        {categories.map((c) => (
          <button
            key={c.key}
            onClick={() => setCatFilter(c.key)}
            className={`text-[14.5px] font-semibold rounded-full px-3 py-1.5 border ${
              catFilter === c.key ? "bg-teal-soft border-teal text-teal-strong" : "border-line-strong bg-surface text-ink-dim hover:bg-surface-2"
            }`}
          >
            {CATEGORY_ICONS[c.key] ?? "📁"} {c.name}
          </button>
        ))}
      </div>

      <div className="text-[14px] text-ink-faint mb-2.5">พบ {filtered.length} รายการ</div>

      {filtered.map((e) => {
        const cat = catById.get(e.categoryId);
        if (!cat) return null;
        return <EndpointCard key={e.id} category={cat} endpoint={e} categoryLabel={cat.name} />;
      })}
      {!filtered.length && <EmptyRow>ไม่พบข้อมูลที่ตรงกับคำค้นหา ลองใช้คำอื่น เช่น ชื่อสิ่งที่อยากทำ</EmptyRow>}
    </div>
  );
}
