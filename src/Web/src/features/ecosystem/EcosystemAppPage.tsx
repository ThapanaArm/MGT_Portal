import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { api } from "@/shared/lib/api";
import { useToast } from "@/shared/lib/toast";
import { Btn, Panel, ScopeTag, TypeChip } from "@/shared/components/ui";
import { AppAvatar, ShotsGallery } from "@/shared/components/MediaPickers";
import type { AppDetailDto, CategoryDto } from "@/shared/lib/types";

export default function EcosystemAppPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [detail, setDetail] = useState<AppDetailDto | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);

  useEffect(() => {
    api.get<AppDetailDto>(`/api/applications/${id}`).then(setDetail);
    api.get<CategoryDto[]>("/api/categories").then(setCategories);
  }, [id]);

  if (!detail) return <div className="text-ink-faint text-[15.5px]">กำลังโหลด...</div>;
  const a = detail.summary;
  const categoryName = (key: string) => categories.find((c) => c.key === key)?.name ?? key;

  const share = () => {
    navigator.clipboard?.writeText(`https://${a.subdomain}.megachem.co.th`).catch(() => {});
    toast("คัดลอกลิงก์ Application แล้ว");
  };

  return (
    <div>
      <Btn size="sm" onClick={() => navigate("/ecosystem")}>
        ← กลับไปยัง MGT Ecosystem
      </Btn>

      <div className="mt-3.5 mb-5 flex items-center gap-4 flex-wrap">
        <AppAvatar image={a.image} icon={a.icon} size="lg" />
        <div>
          <h1 className="text-[26px] font-bold mb-1.5">{a.name}</h1>
          <TypeChip type={a.type} />
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">
          <Btn variant="primary" onClick={() => toast("เปิด Application (จำลอง) — ระบบจริงจะพาไปยัง Subdomain ของ Application")}>
            เปิดใช้งาน
          </Btn>
          <Btn onClick={share}>แชร์</Btn>
        </div>
      </div>

      <ShotsGallery shots={detail.screenshots} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <Panel title="เกี่ยวกับ Application นี้"><div className="text-[15px] text-ink-dim">{a.description}</div></Panel>
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
          <Panel title="ผู้พัฒนา"><div className="text-[15px] text-ink-dim">{a.ownerEmail}</div></Panel>
          <Panel title="หมวดหมู่ API ที่ใช้งาน">
            <div className="flex gap-1.5 flex-wrap">
              {a.products.map((p) => (
                <ScopeTag key={p}>{categoryName(p)}</ScopeTag>
              ))}
            </div>
          </Panel>
          <Panel title="อัปเดตล่าสุด"><div className="font-mono text-[15px] text-ink-dim">{a.updatedAt.slice(0, 10)}</div></Panel>
        </div>
      </div>
    </div>
  );
}
