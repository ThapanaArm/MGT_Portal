"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { Btn, EmptyRow, TypeChip, StatusDot, ScopeTag } from "@/components/ui";
import { AppAvatar } from "@/components/MediaPickers";
import AppForm, { AppFormValues } from "@/components/AppForm";
import type { AppSummaryDto, CategoryDto } from "@/lib/types";

const EMPTY: AppFormValues = { name: "", description: "", subdomain: "", github: "", products: [], image: null, icon: "📦", screenshots: [] };

export default function MyAppsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [apps, setApps] = useState<AppSummaryDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [showForm, setShowForm] = useState(searchParams.get("new") === "1");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([api.get<AppSummaryDto[]>("/api/applications"), api.get<CategoryDto[]>("/api/categories")])
      .then(([a, c]) => {
        setApps(a);
        setCategories(c);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    queueMicrotask(load);
  }, []);

  const categoryName = (key: string) => categories.find((c) => c.key === key)?.name ?? key;

  const create = async (values: AppFormValues) => {
    await api.post("/api/applications", values);
    setShowForm(false);
    toast("ลงทะเบียน Application สำเร็จ");
    load();
  };

  return (
    <div>
      <div className="mb-3.5">
        <div className="flex items-center gap-2 text-[13.5px] uppercase tracking-wide text-ink-faint font-bold mb-1.5">
          <span className="w-2 h-2 rounded-sm bg-teal" /> My App
        </div>
        <h1 className="text-[26px] font-bold">Application ของฉัน</h1>
        <p className="text-ink-dim text-[16px] mt-1.5 max-w-[62ch] leading-relaxed">
          รายการ Application ที่ลงทะเบียนไว้กับ MGT Hub พร้อมสถานะและระดับความน่าเชื่อถือ (Application
          Type)
        </p>
        <div className="mt-3.5">
          <Btn variant="primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "ยกเลิก" : "+ ลงทะเบียน Application ใหม่"}
          </Btn>
        </div>
      </div>

      {showForm ? (
        <AppForm
          title="ลงทะเบียน Application ใหม่"
          hint="กรอกข้อมูล Application ของคุณ — สถานะเริ่มต้นจะเป็น Draft และ Type เป็น Registered จนกว่าจะผ่านการตรวจสอบ"
          initial={EMPTY}
          categories={categories}
          submitLabel="ส่งลงทะเบียน"
          onSubmit={create}
          onCancel={() => setShowForm(false)}
        />
      ) : loading ? (
        <div className="text-ink-faint text-[15.5px]">กำลังโหลด...</div>
      ) : apps.length === 0 ? (
        <EmptyRow>ยังไม่มี Application — ลงทะเบียนรายการแรกของคุณด้านบน</EmptyRow>
      ) : (
        <div className="border border-line rounded-[10px] bg-surface overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-[15px]">
            <thead>
              <tr>
                {["Application", "Type", "Status", "API Products", "Created", "Updated", ""].map((h) => (
                  <th key={h} className="text-left text-ink-faint text-[13px] uppercase tracking-wide font-bold px-3.5 py-2.5 border-b border-line whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} onClick={() => router.push(`/my-apps/${a.id}`)} className="cursor-pointer hover:bg-surface-2">
                  <td className="px-3.5 py-3 border-b border-line">
                    <div className="flex items-center gap-2.5">
                      <AppAvatar image={a.image} icon={a.icon} size="sm" />
                      <div>
                        <b className="block text-[15.5px]">{a.name}</b>
                        <span className="block font-mono text-[13.5px] text-ink-faint">{a.subdomain}.megachem.co.th</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3.5 py-3 border-b border-line"><TypeChip type={a.type} /></td>
                  <td className="px-3.5 py-3 border-b border-line"><StatusDot status={a.status} /></td>
                  <td className="px-3.5 py-3 border-b border-line">
                    <div className="flex gap-1 flex-wrap">
                      {a.products.map((p) => (
                        <ScopeTag key={p}>{categoryName(p)}</ScopeTag>
                      ))}
                    </div>
                  </td>
                  <td className="px-3.5 py-3 border-b border-line font-mono text-[14px] text-ink-dim whitespace-nowrap">{a.createdAt.slice(0, 10)}</td>
                  <td className="px-3.5 py-3 border-b border-line font-mono text-[14px] text-ink-dim whitespace-nowrap">{a.updatedAt.slice(0, 10)}</td>
                  <td className="px-3.5 py-3 border-b border-line text-teal-strong font-semibold whitespace-nowrap">ดูรายละเอียด →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
