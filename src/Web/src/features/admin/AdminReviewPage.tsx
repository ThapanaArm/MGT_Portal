import { useEffect, useState } from "react";
import { api } from "@/shared/lib/api";
import { useToast } from "@/shared/lib/toast";
import { Btn, EmptyRow, Panel, ScopeTag } from "@/shared/components/ui";
import { AppAvatar } from "@/shared/components/MediaPickers";
import type { AppDetailDto, AppSummaryDto, CategoryDto, CommitteeMemberDto } from "@/shared/lib/types";

const TYPE_LABEL: Record<string, string> = { registered: "Registered", verify: "Verify", official: "Official" };
const THRESHOLD: Record<string, number> = { registered: 1, verify: 2, official: 3 };

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
  const need = THRESHOLD[target] ?? 3;
  const approvedCount = detail.votes.filter((v) => v.approved).length;
  const categoryName = (key: string) => categories.find((c) => c.key === key)?.name ?? key;

  const vote = async (memberId: number) => {
    await api.post(`/api/applications/${app.id}/vote`, { committeeMemberId: memberId });
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
          ขอระดับ {TYPE_LABEL[target]}
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

      <div className="flex items-center justify-between mt-3.5 flex-wrap gap-2">
        <span className="text-[14px] text-ink-dim font-semibold">
          อนุมัติแล้ว {approvedCount}/3 เสียง · ต้องการอย่างน้อย {need} เสียงสำหรับระดับ {TYPE_LABEL[target]}
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
          คณะกรรมการ 3 ท่านร่วมพิจารณาอนุมัติ Application แต่ละรายการ — เกณฑ์การอนุมัติขึ้นกับระดับ (Application
          Type) ที่ขอ: Official ต้องได้ 3/3 เสียง, Verify ต้องได้ 2/3 เสียง, Registered ต้องได้ 1/3 เสียง
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
