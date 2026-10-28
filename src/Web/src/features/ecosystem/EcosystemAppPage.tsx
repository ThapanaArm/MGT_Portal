import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { api } from "@/shared/lib/api";
import { useToast } from "@/shared/lib/toast";
import { Btn, Panel, ScopeTag, TypeChip } from "@/shared/components/ui";
import { AppAvatar, ShotsGallery } from "@/shared/components/MediaPickers";
import type { AppDetailDto, CategoryDto } from "@/shared/lib/types";

export default function EcosystemAppPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const [detail, setDetail] = useState<AppDetailDto | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);

  useEffect(() => {
    api.get<AppDetailDto>(`/api/applications/${id}`).then(setDetail);
    api.get<CategoryDto[]>("/api/categories").then(setCategories);
  }, [id]);

  if (!detail) return <div className="text-ink-faint text-[15.5px]">Loading...</div>;
  const a = detail.summary;
  const categoryName = (key: string) => categories.find((c) => c.key === key)?.name ?? key;

  const share = () => {
    navigator.clipboard?.writeText(`${window.location.origin}/ecosystem/${a.id}`).catch(() => {});
    toast({ tone: "success", message: "Catalog link copied" });
  };

  return (
    <div>
<div className="portal-page-heading mb-5 flex items-center gap-4 flex-wrap">
        <AppAvatar image={a.image} icon={a.icon} size="lg" />
        <div>
          <h1 className="text-[26px] font-bold mb-1.5">{a.name}</h1>
          <TypeChip type={a.type} />
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">
          <span className="text-sm text-ink-dim max-w-[32ch]">This request is approved. Contact the application owner for availability; IT handles deployment separately.</span>
          <Btn onClick={share}>Share</Btn>
        </div>
      </div>

      <ShotsGallery shots={detail.screenshots} />

      <div className="portal-detail-grid grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <Panel title="About this application"><div className="text-[15px] text-ink-dim">{a.description}</div></Panel>
          <Panel title="Subdomain">
            <div className="font-mono text-[15px] bg-surface border border-line rounded-lg px-3 py-2">
              <code className="text-teal-strong">https://{a.subdomain}.megachem.co.th</code>
            </div>
          </Panel>
          <Panel title="Repository">
            <a href={`https://${a.github}`} target="_blank" rel="noopener" className="font-mono text-[15px] text-teal-strong">
              {a.github}
            </a>
          </Panel>
        </div>
        <div>
          <Panel title="Developer"><div className="text-[15px] text-ink-dim">{a.ownerEmail}</div></Panel>
          <Panel title="API categories used">
            <div className="flex gap-1.5 flex-wrap">
              {a.products.map((p) => (
                <ScopeTag key={p}>{categoryName(p)}</ScopeTag>
              ))}
            </div>
          </Panel>
          <Panel title="Last updated"><div className="font-mono text-[15px] text-ink-dim">{a.updatedAt.slice(0, 10)}</div></Panel>
        </div>
      </div>
    </div>
  );
}
