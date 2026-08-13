"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { Btn, Panel, ScopeTag, StatusDot, EnvChip } from "@/components/ui";
import { AppAvatar } from "@/components/MediaPickers";
import { ShotsGallery } from "@/components/MediaPickers";
import AppForm, { AppFormValues } from "@/components/AppForm";
import type { AppDetailDto, AppType, CategoryDto } from "@/lib/types";

const APP_TYPES: AppType[] = ["registered", "verify", "official"];
const TYPE_LABEL: Record<AppType, string> = { registered: "Registered", verify: "Verify", official: "Official" };
const TYPE_DESC: Record<AppType, string> = {
  registered: "ลงทะเบียนแล้ว ยังไม่ผ่านการตรวจสอบ",
  verify: "ผ่านการยืนยันตัวตนและตรวจสอบเบื้องต้นแล้ว",
  official: "ได้รับการรับรองอย่างเป็นทางการ ใช้งาน Production เต็มรูปแบบ",
};
const ACTION_LABEL: Record<string, string> = { create: "Create New", review: "Send Review", update: "Updated", publish: "Publish", unpublish: "Unpublish" };
const ACTION_DOT: Record<string, string> = { create: "bg-teal", review: "bg-put", update: "bg-ink-faint", publish: "bg-post", unpublish: "bg-danger" };

function CredentialBlock({ appId, env, cred, isAdmin, emptyNote, onChanged }: {
  appId: number; env: "sandbox" | "production"; cred: { tokenId: string; tokenSecret: string } | undefined; isAdmin: boolean; emptyNote?: string; onChanged: () => void;
}) {
  const toast = useToast();
  const [revealed, setRevealed] = useState(false);

  const copy = (v: string) => {
    navigator.clipboard?.writeText(v).catch(() => {});
    toast("คัดลอกแล้ว");
  };

  const regenerate = async () => {
    await api.post(`/api/applications/${appId}/credentials/${env}/regenerate`);
    toast("สร้าง Credential ใหม่แล้ว");
    onChanged();
  };
  const revoke = async () => {
    await api.post(`/api/applications/${appId}/credentials/${env}/revoke`);
    toast("เพิกถอน Credential แล้ว");
    onChanged();
  };

  return (
    <div className="border border-line rounded-lg p-3 bg-paper">
      <h4 className="text-[11px] uppercase tracking-wide text-ink-faint font-bold mb-2.5 flex items-center gap-2">
        <EnvChip env={env} />
      </h4>
      {cred ? (
        <>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[11px] text-ink-faint w-[76px] flex-shrink-0">Token ID</span>
            <code className="font-mono text-[11.5px] bg-surface-2 rounded-md px-2 py-0.5 break-all flex-1 min-w-[110px]">{cred.tokenId}</code>
            <Btn size="sm" onClick={() => copy(cred.tokenId)}>คัดลอก</Btn>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-ink-faint w-[76px] flex-shrink-0">Token Secret</span>
            <code className="font-mono text-[11.5px] bg-surface-2 rounded-md px-2 py-0.5 break-all flex-1 min-w-[110px]">
              {revealed ? cred.tokenSecret : "••••••••••••••••"}
            </code>
            <Btn size="sm" onClick={() => setRevealed((r) => !r)}>{revealed ? "ซ่อน" : "แสดง"}</Btn>
            <Btn size="sm" onClick={() => copy(cred.tokenSecret)}>คัดลอก</Btn>
          </div>
          {isAdmin && (
            <div className="flex gap-1.5 mt-2.5 pt-2.5 border-t border-line">
              <Btn size="sm" onClick={regenerate}>สร้างใหม่ (Regenerate)</Btn>
              <Btn size="sm" danger onClick={revoke}>เพิกถอน (Revoke)</Btn>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="text-[12px] text-ink-faint">{emptyNote ?? "ยังไม่มี Credential"}</div>
          {isAdmin && (
            <div className="mt-2.5 pt-2.5 border-t border-line">
              <Btn size="sm" onClick={regenerate}>ออก Credential ใหม่</Btn>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function AppDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [detail, setDetail] = useState<AppDetailDto | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [editing, setEditing] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<AppType>("registered");

  const isAdmin = user?.roleKey === "admin";

  const load = useCallback(() => {
    api.get<AppDetailDto>(`/api/applications/${id}`).then((d) => {
      setDetail(d);
      setReviewTarget(d.summary.type);
    });
    api.get<CategoryDto[]>("/api/categories").then(setCategories);
  }, [id]);

  useEffect(load, [load]);

  if (!detail) return <div className="text-ink-faint text-[13px]">กำลังโหลด...</div>;
  const a = detail.summary;
  const categoryName = (key: string) => categories.find((c) => c.key === key)?.name ?? key;

  const sendReview = async () => {
    await api.post(`/api/applications/${id}/send-review`, { targetType: reviewTarget });
    toast("ส่ง Application เข้าสู่กระบวนการตรวจสอบโดยคณะกรรมการแล้ว");
    load();
  };
  const publish = async () => {
    await api.post(`/api/applications/${id}/publish`);
    toast("เผยแพร่ Application แล้ว");
    load();
  };
  const unpublish = async () => {
    await api.post(`/api/applications/${id}/unpublish`);
    toast("ยกเลิกการเผยแพร่ Application แล้ว");
    load();
  };

  const saveEdit = async (values: AppFormValues) => {
    try {
      await api.put(`/api/applications/${id}`, values);
      setEditing(false);
      toast("บันทึกการแก้ไขแล้ว");
      load();
    } catch (err) {
      throw new Error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  };

  const curIdx = APP_TYPES.indexOf(a.type);
  const credOf = (env: "sandbox" | "production") => detail.credentials.find((c) => c.env === env);

  return (
    <div>
      <Btn size="sm" onClick={() => router.push("/my-apps")}>
        ← กลับไปยัง My App
      </Btn>

      <div className="mt-3.5 mb-4.5">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-ink-faint font-bold mb-1.5">
          <span className="w-2 h-2 rounded-sm bg-teal" /> My App
        </div>
        <div className="flex items-center gap-3.5">
          <AppAvatar image={a.image} icon={a.icon} size="lg" />
          <h1 className="text-[22px] font-bold">{a.name}</h1>
        </div>
        <div className="flex items-center gap-2.5 mt-2 flex-wrap">
          <StatusDot status={a.status} />
          <span className="text-line-strong">·</span>
          <span className="font-mono text-[12px] text-ink-dim">
            ลงทะเบียนเมื่อ {a.createdAt.slice(0, 10)} · แก้ไขล่าสุด {a.updatedAt.slice(0, 10)} · โดย {a.ownerEmail}
          </span>
        </div>
        <div className="flex gap-2 mt-3.5 flex-wrap items-center">
          <Btn size="sm" onClick={() => setEditing((e) => !e)}>{editing ? "ปิดการแก้ไข" : "แก้ไข"}</Btn>
          {a.status === "draft" && (
            <>
              <select
                value={reviewTarget}
                onChange={(e) => setReviewTarget(e.target.value as AppType)}
                className="border border-line-strong bg-paper rounded-lg px-2.5 py-1.5 text-[12px]"
              >
                {APP_TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                ))}
              </select>
              <Btn size="sm" onClick={sendReview}>ส่งตรวจสอบ (Send Review)</Btn>
            </>
          )}
          {a.status === "pending" && (
            <span className="text-[12px] text-ink-dim font-semibold">
              รอผลการตรวจสอบจากคณะกรรมการ — ขอระดับ {TYPE_LABEL[a.reviewTarget ?? a.type]} (
              {detail.votes.filter((v) => v.approved).length}/3 เสียงที่ต้องการ)
            </span>
          )}
          {a.status === "active" && <Btn size="sm" danger onClick={unpublish}>ยกเลิกเผยแพร่ (Unpublish)</Btn>}
          {a.status === "suspended" && <Btn size="sm" onClick={publish}>เผยแพร่อีกครั้ง (Publish)</Btn>}
        </div>
      </div>

      {!editing && (
        <Panel title="API Credentials" hint="ใช้ Token ID และ Token Secret คู่นี้เพื่อขอ Access Token ผ่าน OAuth2 Client Credentials Flow — เก็บ Token Secret เป็นความลับ อย่าฝังในโค้ดฝั่ง Client">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CredentialBlock appId={a.id} env="sandbox" cred={credOf("sandbox")} isAdmin={isAdmin} onChanged={load} />
            <CredentialBlock
              appId={a.id}
              env="production"
              cred={credOf("production")}
              isAdmin={isAdmin}
              emptyNote={a.status === "active" ? undefined : "จะออก Production Credential ให้อัตโนมัติเมื่อ Application ผ่านการอนุมัติจากคณะกรรมการและมีสถานะ Active"}
              onChanged={load}
            />
          </div>
        </Panel>
      )}

      {!editing && <ShotsGallery shots={detail.screenshots} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          {editing ? (
            <AppForm
              title="แก้ไขข้อมูล Application"
              hint=""
              initial={{ name: a.name, description: a.description, subdomain: a.subdomain, github: a.github, products: a.products, image: a.image, icon: a.icon, screenshots: detail.screenshots }}
              categories={categories}
              submitLabel="บันทึกการแก้ไข"
              onSubmit={saveEdit}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <Panel title="Application Description"><div className="text-[12.5px] text-ink-dim">{a.description}</div></Panel>
              <Panel title="Subdomain">
                <div className="font-mono text-[12.5px] bg-surface border border-line rounded-lg px-3 py-2">
                  <code className="text-teal-strong">https://{a.subdomain}.megachem.co.th</code>
                </div>
              </Panel>
              <Panel title="Link Github">
                <a href={`https://${a.github}`} target="_blank" rel="noopener" className="font-mono text-[12.5px] text-teal-strong">
                  {a.github}
                </a>
              </Panel>
              <Panel title="API Products ที่ต้องการใช้งาน">
                <div className="flex gap-1.5 flex-wrap">
                  {a.products.map((p) => (
                    <ScopeTag key={p}>{categoryName(p)}</ScopeTag>
                  ))}
                </div>
              </Panel>
            </>
          )}
        </div>

        <div>
          <Panel title="Application Type" hint={TYPE_DESC[a.type]}>
            <div className="flex items-center mt-1.5">
              {APP_TYPES.map((t, i) => (
                <div key={t} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1.5 flex-1 text-center">
                    <span
                      className={`w-3.5 h-3.5 rounded-full border-2 ${
                        i < curIdx ? "bg-teal-soft border-teal" : i === curIdx ? "bg-teal border-teal" : "border-line-strong bg-surface"
                      }`}
                    />
                    <span className={`text-[10.5px] font-semibold ${i === curIdx ? "text-teal-strong" : "text-ink-faint"}`}>{TYPE_LABEL[t]}</span>
                  </div>
                  {i < APP_TYPES.length - 1 && <span className="w-6 h-0.5 bg-line-strong -mt-4" />}
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Status">
            <StatusDot status={a.status} />
            <div className="text-[12px] text-ink-dim mt-2.5 leading-relaxed">
              Active = ใช้งาน Production ได้ · Pending Review = รอตรวจสอบ · Draft = ยังไม่ส่งตรวจสอบ · Suspended = ถูกระงับการใช้งาน
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="ประวัติการเปลี่ยนแปลง (Activity Log)">
        <div className="flex flex-col">
          {detail.log.map((l, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center flex-shrink-0 pt-1">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ACTION_DOT[l.actionType]}`} />
                {i < detail.log.length - 1 && <span className="w-px flex-1 min-h-4.5 bg-line-strong my-1" />}
              </div>
              <div className="pb-4">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <b className="text-[12.5px]">{ACTION_LABEL[l.actionType]}</b>
                  <span className="font-mono text-[11px] text-ink-faint">{l.occurredAt.slice(0, 10)}</span>
                </div>
                <div className="text-[11.5px] text-ink-dim mt-0.5">
                  {l.actor}
                  {l.note ? ` · ${l.note}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
