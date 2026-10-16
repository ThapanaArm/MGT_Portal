import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { api, ApiError } from "@/shared/lib/api";
import { useAuth } from "@/shared/lib/auth";
import { useToast } from "@/shared/lib/toast";
import { Btn, Panel, ScopeTag, StatusDot, EnvChip } from "@/shared/components/ui";
import { AppAvatar } from "@/shared/components/MediaPickers";
import { ShotsGallery } from "@/shared/components/MediaPickers";
import AppForm, { AppFormValues } from "@/features/apps/AppForm";
import { AUDIENCE_LABEL, TIERS, TIER_DESC, TIER_LABEL, TIER_NAME, tierCanUseApis } from "@/shared/lib/tiers";
import type { AppDetailDto, AppType, CategoryDto } from "@/shared/lib/types";
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
      <h4 className="text-[13.5px] uppercase tracking-wide text-ink-faint font-bold mb-2.5 flex items-center gap-2">
        <EnvChip env={env} />
      </h4>
      {cred ? (
        <>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[13.5px] text-ink-faint w-[76px] flex-shrink-0">Token ID</span>
            <code className="font-mono text-[14px] bg-surface-2 rounded-md px-2 py-0.5 break-all flex-1 min-w-[110px]">{cred.tokenId}</code>
            <Btn size="sm" onClick={() => copy(cred.tokenId)}>คัดลอก</Btn>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13.5px] text-ink-faint w-[76px] flex-shrink-0">Token Secret</span>
            <code className="font-mono text-[14px] bg-surface-2 rounded-md px-2 py-0.5 break-all flex-1 min-w-[110px]">
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
          <div className="text-[14.5px] text-ink-faint">{emptyNote ?? "ยังไม่มี Credential"}</div>
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
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [detail, setDetail] = useState<AppDetailDto | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [editing, setEditing] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<AppType>("tier1");

  const isAdmin = user?.roleKey === "admin";

  const load = useCallback(() => {
    api.get<AppDetailDto>(`/api/applications/${id}`).then((d) => {
      setDetail(d);
      // App ที่เลือก API ไว้ขอ Tier 1 ไม่ได้ จึงตั้งค่าเริ่มต้นเป็น Tier 2
      const s = d.summary;
      setReviewTarget(s.products.length > 0 && !tierCanUseApis(s.type) ? "tier2" : s.type);
    });
    api.get<CategoryDto[]>("/api/categories").then(setCategories);
  }, [id]);

  useEffect(load, [load]);

  if (!detail) return <div className="text-ink-faint text-[15.5px]">กำลังโหลด...</div>;
  const a = detail.summary;
  const categoryName = (key: string) => categories.find((c) => c.key === key)?.name ?? key;

  /** เรียก API แล้วแสดงผล — ถ้า backend ปฏิเสธ (เช่น Tier 1 ขอ API) ให้แสดงข้อความจาก backend */
  const run = async (call: () => Promise<unknown>, okMessage: string) => {
    try {
      await call();
      toast(okMessage);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "ทำรายการไม่สำเร็จ");
    }
    load();
  };

  const sendReview = () =>
    run(
      () => api.post(`/api/applications/${id}/send-review`, { targetType: reviewTarget }),
      tierCanUseApis(reviewTarget)
        ? "ส่งให้คณะกรรมการและ IT พิจารณาแล้ว"
        : "อนุมัติอัตโนมัติแล้ว (Tier 1)",
    );
  const publish = () => run(() => api.post(`/api/applications/${id}/publish`), "เปิดใช้งาน Application อีกครั้งแล้ว");
  const unpublish = () => run(() => api.post(`/api/applications/${id}/unpublish`), "ระงับ Application และปิด credential แล้ว");

  const saveEdit = async (values: AppFormValues) => {
    try {
      await api.put(`/api/applications/${id}`, values);
      setEditing(false);
      toast("บันทึกการแก้ไขแล้ว");
      load();
    } catch (err) {
      throw new Error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ", { cause: err });
    }
  };

  const approved = a.status === "active" || a.status === "suspended";
  const curIdx = approved ? TIERS.indexOf(a.type) : -1;
  const approvedVotes = detail.votes.filter((v) => v.approved).length;
  const codeReviewText = detail.codeReview ? (detail.codeReview.approved ? "ผ่าน" : "ไม่ผ่าน") : "ยังไม่รีวิว";
  // ออก/เพิกถอน credential ได้เฉพาะ App Tier 2/3 ที่ Active (backend ตรวจซ้ำ)
  const canManageCreds = isAdmin && a.status === "active" && tierCanUseApis(a.type);
  const credentialNote =
    approved && !tierCanUseApis(a.type)
      ? "App Tier 1 ไม่ต่อ API จึงไม่มี credential"
      : "จะออก credential ให้อัตโนมัติเมื่อได้รับอนุมัติ Tier 2/3";
  const credOf = (env: "sandbox" | "production") => detail.credentials.find((c) => c.env === env);

  return (
    <div>
      <Btn size="sm" onClick={() => navigate("/my-apps")}>
        ← กลับไปยัง My App
      </Btn>

      <div className="mt-3.5 mb-4.5">
        <div className="flex items-center gap-2 text-[13.5px] uppercase tracking-wide text-ink-faint font-bold mb-1.5">
          <span className="w-2 h-2 rounded-sm bg-teal" /> My App
        </div>
        <div className="flex items-center gap-3.5">
          <AppAvatar image={a.image} icon={a.icon} size="lg" />
          <h1 className="text-[26px] font-bold">{a.name}</h1>
        </div>
        <div className="flex items-center gap-2.5 mt-2 flex-wrap">
          <StatusDot status={a.status} />
          <span className="text-line-strong">·</span>
          <span className="font-mono text-[14.5px] text-ink-dim">
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
                className="border border-line-strong bg-paper rounded-lg px-2.5 py-1.5 text-[14.5px]"
              >
                {TIERS.map((t) => (
                  <option key={t} value={t} disabled={!tierCanUseApis(t) && a.products.length > 0}>
                    {TIER_LABEL[t]} · {TIER_NAME[t]}
                  </option>
                ))}
              </select>
              <Btn size="sm" onClick={sendReview}>ส่งตรวจสอบ (Send Review)</Btn>
            </>
          )}
          {a.status === "pending" && (
            <span className="text-[14.5px] text-ink-dim font-semibold">
              รอผลการพิจารณา — ขอระดับ {TIER_LABEL[a.reviewTarget ?? a.type]} · กรรมการ {approvedVotes}/{detail.requiredVotes} เสียง
              {detail.requiresCodeReview && <> · IT รีวิวโค้ด: {codeReviewText}</>}
            </span>
          )}
          {a.status === "active" && <Btn size="sm" danger onClick={unpublish}>ยกเลิกเผยแพร่ (Unpublish)</Btn>}
          {a.status === "suspended" && <Btn size="sm" onClick={publish}>เผยแพร่อีกครั้ง (Publish)</Btn>}
        </div>
      </div>

      {!editing && (
        <Panel title="API Credentials" hint="ใช้ Token ID และ Token Secret คู่นี้เพื่อขอ Access Token ผ่าน OAuth2 Client Credentials Flow — เก็บ Token Secret เป็นความลับ อย่าฝังในโค้ดฝั่ง Client">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CredentialBlock appId={a.id} env="sandbox" cred={credOf("sandbox")} isAdmin={canManageCreds} emptyNote={credentialNote} onChanged={load} />
            <CredentialBlock
              appId={a.id}
              env="production"
              cred={credOf("production")}
              isAdmin={canManageCreds}
              emptyNote={credentialNote}
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
              initial={{ name: a.name, description: a.description, subdomain: a.subdomain, github: a.github, products: a.products, image: a.image, icon: a.icon, screenshots: detail.screenshots, audience: a.audience }}
              categories={categories}
              submitLabel="บันทึกการแก้ไข"
              onSubmit={saveEdit}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <Panel title="Application Description"><div className="text-[15px] text-ink-dim">{a.description}</div></Panel>
              <Panel title="Subdomain">
                <div className="font-mono text-[15px] bg-surface border border-line rounded-lg px-3 py-2">
                  <code className="text-teal-strong">https://{a.subdomain}.megachem.co.th</code>
                </div>
              </Panel>
              <Panel title="ใครใช้ App ได้">
                <div className="text-[15px] text-ink-dim">{AUDIENCE_LABEL[a.audience] ?? a.audience}</div>
              </Panel>
              <Panel title="Link Github">
                <a href={`https://${a.github}`} target="_blank" rel="noopener" className="font-mono text-[15px] text-teal-strong">
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
          <Panel title="Tier" hint={approved ? TIER_DESC[a.type] : "ยังไม่ได้รับอนุมัติ — เลือก Tier ตอนส่งตรวจสอบ"}>
            <div className="flex items-center mt-1.5">
              {TIERS.map((t, i) => (
                <div key={t} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1.5 flex-1 text-center">
                    <span
                      className={`w-3.5 h-3.5 rounded-full border-2 ${
                        i < curIdx ? "bg-teal-soft border-teal" : i === curIdx ? "bg-teal border-teal" : "border-line-strong bg-surface"
                      }`}
                    />
                    <span className={`text-[13px] font-semibold ${i === curIdx ? "text-teal-strong" : "text-ink-faint"}`}>{TIER_LABEL[t]}</span>
                  </div>
                  {i < TIERS.length - 1 && <span className="w-6 h-0.5 bg-line-strong -mt-4" />}
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Status">
            <StatusDot status={a.status} />
            <div className="text-[14.5px] text-ink-dim mt-2.5 leading-relaxed">
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
                  <b className="text-[15px]">{ACTION_LABEL[l.actionType]}</b>
                  <span className="font-mono text-[13.5px] text-ink-faint">{l.occurredAt.slice(0, 10)}</span>
                </div>
                <div className="text-[14px] text-ink-dim mt-0.5">
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
