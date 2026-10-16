import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "@/shared/lib/api";
import { useLocale } from "@/shared/lib/locale-context";
import { EmptyRow, ScopeTag, TypeChip } from "@/shared/components/ui";
import { AppAvatar } from "@/shared/components/MediaPickers";
import type { AppSummaryDto, CategoryDto } from "@/shared/lib/types";

export default function EcosystemPage() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const [apps, setApps] = useState<AppSummaryDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState<"updated" | "name">("updated");

  useEffect(() => {
    // catalog=true = แคตตาล็อกที่เผยแพร่แล้ว เปิดให้พนักงานทุกคนเห็นโดยตั้งใจ
    api.get<AppSummaryDto[]>("/api/applications?catalog=true").then(setApps);
    api.get<CategoryDto[]>("/api/categories").then(setCategories);
  }, []);

  const categoryName = (key: string) => categories.find((c) => c.key === key)?.name ?? key;

  const highlight = useMemo(() => {
    const officials = apps.filter((a) => a.type === "tier3");
    const rest = apps.filter((a) => a.type !== "tier3");
    return [...officials, ...rest].slice(0, 4);
  }, [apps]);

  const filtered = useMemo(() => {
    let list = apps.filter((a) => cat === "all" || a.products.includes(cat));
    if (query) list = list.filter((a) => (a.name + " " + a.description).toLowerCase().includes(query.toLowerCase()));
    return list.slice().sort((x, y) => (sort === "name" ? x.name.localeCompare(y.name) : y.updatedAt.localeCompare(x.updatedAt)));
  }, [apps, cat, query, sort]);

  return (
    <div>
      <div
        className="relative rounded-[14px] overflow-hidden p-9 mb-7 text-[#F3FBF9]"
        style={{ background: "linear-gradient(135deg, var(--brand-strong), var(--brand) 55%, var(--brand-strong))" }}
      >
        <div className="absolute left-0 right-0 bottom-0 h-1" style={{ background: "linear-gradient(90deg, var(--brand-strong), var(--amber))" }} />
        <div className="relative max-w-[620px]">
          <h1 className="text-[34px] font-bold">{t("ecosystem.title")}</h1>
          <p className="text-[16.5px] opacity-90 mt-2 leading-relaxed">{t("ecosystem.desc")}</p>
          <div className="flex gap-2.5 flex-wrap mt-4.5">
            <button onClick={() => navigate("/my-apps?new=1")} className="bg-brand text-white rounded-lg px-4 py-2.5 text-[16px] font-semibold">
              {t("ecosystem.registerApp")}
            </button>
            <button onClick={() => navigate("/getting-started")} className="bg-white/10 border border-white/28 text-white rounded-lg px-4 py-2.5 text-[16px] font-semibold hover:bg-white/18">
              {t("ecosystem.requestAccess")}
            </button>
          </div>
        </div>
      </div>

      {highlight.length > 0 && (
        <div className="mb-7">
          <h2 className="text-[19px] font-bold mb-3.5">{t("ecosystem.highlight")}</h2>
          <div className="flex gap-3.5 overflow-x-auto pb-1.5 scrollbar-thin">
            {highlight.map((a) => (
              <div key={a.id} onClick={() => navigate(`/ecosystem/${a.id}`)} className="flex-shrink-0 w-[250px] border border-line rounded-[14px] bg-surface overflow-hidden cursor-pointer hover:border-teal">
                <div className="h-24 flex items-center justify-center text-4xl p-3" style={{ background: "linear-gradient(135deg, var(--teal-soft), var(--amber-soft))" }}>
                  {a.image ? (
                    <div className="h-full aspect-square bg-white rounded-lg p-2 flex items-center justify-center">
                      <img src={a.image} className="max-w-full max-h-full object-contain" alt="" />
                    </div>
                  ) : (
                    a.icon
                  )}
                </div>
                <div className="p-3.5">
                  <b className="block text-[16px]">{a.name}</b>
                  <span className="block text-[14px] text-ink-dim mt-1">{categoryName(a.products[0])} · <TypeChip type={a.type} /></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2.5 flex-wrap mb-3">
        <h2 className="text-[19px] font-bold flex-1">{t("ecosystem.exploreApps")}</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("ecosystem.searchPlaceholder")}
          className="w-[260px] max-w-full border border-line-strong bg-surface rounded-lg px-3 py-2 text-[15.5px]"
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as "updated" | "name")} className="border border-line-strong bg-paper rounded-lg px-2.5 py-2 text-[15px]">
          <option value="updated">{t("ecosystem.sortUpdated")}</option>
          <option value="name">{t("ecosystem.sortName")}</option>
        </select>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-4">
        <button onClick={() => setCat("all")} className={`border rounded-full px-3.5 py-1.5 text-[15px] font-semibold ${cat === "all" ? "bg-teal-soft border-teal text-teal-strong" : "border-line-strong bg-surface text-ink-dim hover:bg-surface-2"}`}>
          {t("ecosystem.all")}
        </button>
        {categories.map((c) => (
          <button
            key={c.key}
            onClick={() => setCat(c.key)}
            className={`border rounded-full px-3.5 py-1.5 text-[15px] font-semibold ${cat === c.key ? "bg-teal-soft border-teal text-teal-strong" : "border-line-strong bg-surface text-ink-dim hover:bg-surface-2"}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {filtered.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filtered.map((a) => (
            <div key={a.id} onClick={() => navigate(`/ecosystem/${a.id}`)} className="border border-line rounded-[10px] bg-surface p-4 cursor-pointer hover:border-teal hover:bg-surface-2 flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                <AppAvatar image={a.image} icon={a.icon} />
                <div>
                  <b className="block text-[16px]">{a.name}</b>
                  <TypeChip type={a.type} />
                </div>
              </div>
              <p className="text-[14.5px] text-ink-dim leading-relaxed line-clamp-3 flex-1">{a.description}</p>
              <div className="flex gap-1 flex-wrap">
                {a.products.map((p) => (
                  <ScopeTag key={p}>{categoryName(p)}</ScopeTag>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyRow>{t("ecosystem.noResults")}</EmptyRow>
      )}
    </div>
  );
}
