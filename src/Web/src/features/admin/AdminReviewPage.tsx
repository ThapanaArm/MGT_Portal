import { useEffect, useState } from "react";
import { api, ApiError } from "@/shared/lib/api";
import { useToast } from "@/shared/lib/toast";
import { Btn, EmptyRow, Panel, ScopeTag } from "@/shared/components/ui";
import { AppAvatar } from "@/shared/components/MediaPickers";
import { TIER_LABEL } from "@/shared/lib/tiers";
import type { AppDetailDto, AppSummaryDto, CategoryDto, CommitteeMemberDto } from "@/shared/lib/types";

function ReviewCard({ app, categories, members, onChanged }: { app: AppSummaryDto; categories: CategoryDto[]; members: CommitteeMemberDto[]; onChanged: () => void }) {
  const toast = useToast();
  const [detail, setDetail] = useState<AppDetailDto | null>(null);

  const load = () => api.get<AppDetailDto>(`/api/applications/${app.id}`).then(setDetail);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.id]);

  if (!detail) return null;

  const target = app.reviewTarget ?? app.type;
  const need = detail.requiredVotes;
  const approvedCount = detail.votes.filter((v) => v.approved).length;
  const review = detail.codeReview;
  const categoryName = (key: string) => categories.find((c) => c.key === key)?.name ?? key;

  const vote = async (memberId: number) => {
    await api.post(`/api/applications/${app.id}/vote`, { committeeMemberId: memberId });
    await load();
    onChanged();
  };

  /** IT บันทึกผลรีวิวโค้ด — ด่านแยกจากการโหวต ต้องผ่านทั้งสองอย่างจึงจะ Active */
  const recordCodeReview = async (approved: boolean) => {
    const note = approved ? null : window.prompt("เหตุผลที่ไม่ผ่าน (ส่งให้ผู้ขอ)") ?? null;
    try {
      await api.post(`/api/applications/${app.id}/code-review`, { approved, note });
      toast(approved ? "บันทึก IT code review: ผ่าน" : "บันทึก IT code review: ไม่ผ่าน");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
    await load();
    onChanged();
  };

  const reject = async () => {
    await api.post(`/api/applications/${app.id}/reject`);
    toast(`ปฏิเสธคำขอของ ${app.name} แล้ว`);
    onChanged();
  };

  return (
    <Panel>
      <div className="flex items-center justify-between gap-2.5 flex-wrap mb-1">
        <div className="flex items-center gap-2.5">
          <AppAvatar image={app.image} icon={app.icon} size="sm" />
          <h3 className="text-[16.5px] font-bold">{app.name}</h3>
        </div>
        <span className="text-[13px] font-bold tracking-wide rounded-full px-2.5 py-0.5 bg-teal-soft text-teal-strong whitespace-nowrap">
          ขอระดับ {TIER_LABEL[target] ?? target}
        </span>
      </div>
      <div className="text-[14.5px] text-ink-dim mb-2.5">{app.description}</div>
      <div className="flex gap-1.5 flex-wrap mb-1">
        {app.products.map((p) => (
          <ScopeTag key={p}>{categoryName(p)}</ScopeTag>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2.5">
        {members.map((m) => {
          const voted = detail.votes.find((v) => v.committeeMemberId === m.id)?.approved ?? false;
          return (
            <button
              key={m.id}
              onClick={() => vote(m.id)}
              className={`flex items-center gap-2.5 border rounded-lg px-2.5 py-2 text-left ${voted ? "bg-teal-soft border-teal" : "border-line-strong bg-paper hover:border-teal"}`}
            >
              <span className={`w-4.5 h-4.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-[13.5px] text-white ${voted ? "bg-teal border-teal" : "border-line-strong bg-surface"}`}>
                {voted ? "✓" : ""}
              </span>
              <span>
                <b className="block text-[15px]">{m.name}</b>
                <span className="block text-[13.5px] text-ink-faint">{m.roleTitle}</span>
              </span>
            </button>
          );
        })}
      </div>

      {detail.requiresCodeReview && (
        <div className="flex items-center justify-between gap-2 flex-wrap mt-3 border border-line rounded-lg px-3 py-2.5 bg-paper">
          <span className="text-[14.5px]">
            <b>IT รีวิวโค้ด:</b>{" "}
            {review ? (
              <span className={review.approved ? "text-post font-semibold" : "text-danger font-semibold"}>
                {review.approved ? "ผ่าน" : "ไม่ผ่าน"}
              </span>
            ) : (
              <span className="text-ink-faint">ยังไม่รีวิว</span>
            )}
            {review && <span className="text-ink-faint text-[13.5px]"> · {review.reviewerEmail}{review.note ? ` · ${review.note}` : ""}</span>}
          </span>
          <span className="flex gap-1.5">
            <Btn size="sm" onClick={() => recordCodeReview(true)}>โค้ดผ่าน</Btn>
            <Btn size="sm" danger onClick={() => recordCodeReview(false)}>ไม่ผ่าน</Btn>
          </span>
        </div>
      )}

      <div className="flex items-center justify-between mt-3.5 flex-wrap gap-2">
        <span className="text-[14px] text-ink-dim font-semibold">
          อนุมัติแล้ว {approvedCount}/{need} เสียง{detail.requiresCodeReview ? " · ต้องผ่าน IT รีวิวโค้ดด้วย" : ""} · ระดับ {TIER_LABEL[target] ?? target}
        </span>
        <Btn size="sm" danger onClick={reject}>ปฏิเสธคำขอ</Btn>
      </div>
    </Panel>
  );
}

export default function AdminReviewPage() {
  const [pending, setPending] = useState<AppSummaryDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [members, setMembers] = useState<CommitteeMemberDto[]>([]);

  const load = () => api.get<AppSummaryDto[]>("/api/applications?status=pending").then(setPending);

  useEffect(() => {
    load();
    api.get<CategoryDto[]>("/api/categories").then(setCategories);
    api.get<CommitteeMemberDto[]>("/api/committee/members").then(setMembers);
  }, []);

  return (
    <div>
      <div className="mb-3.5">
        <div className="flex items-center gap-2 text-[13.5px] uppercase tracking-wide text-ink-faint font-bold mb-1.5">
          <span className="w-2 h-2 rounded-sm bg-teal" /> Admin
        </div>
        <h1 className="text-[26px] font-bold">ตรวจสอบ Application</h1>
        <p className="text-ink-dim text-[16px] mt-1.5 max-w-[62ch] leading-relaxed">
          คำขอ Tier 2 และ Tier 3 ต้องได้กรรมการครบ 3 เสียงและผ่าน IT รีวิวโค้ด จึงจะ Active และได้ credential —
          Tier 1 (ไม่ต่อ API) อนุมัติอัตโนมัติจึงไม่ขึ้นในหน้านี้
        </p>
      </div>

      {pending.length ? (
        pending.map((a) => <ReviewCard key={a.id} app={a} categories={categories} members={members} onChanged={load} />)
      ) : (
        <EmptyRow>ไม่มี Application ที่รอการตรวจสอบในขณะนี้</EmptyRow>
      )}
    </div>
  );
}
