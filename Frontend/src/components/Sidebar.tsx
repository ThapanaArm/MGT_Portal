"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { CategoryDto } from "@/lib/types";

const CATEGORY_ICONS: Record<string, string> = {
  sales: "📈",
  purchase: "🛍️",
  inventory: "📦",
  finance: "💰",
  hr: "👥",
};

function NavItem({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] w-full ${
        active ? "bg-teal-soft text-teal-strong font-semibold" : "text-ink hover:bg-surface-2"
      }`}
    >
      {children}
    </Link>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [appCount, setAppCount] = useState(0);

  useEffect(() => {
    api.get<CategoryDto[]>("/api/categories").then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    api.get<{ id: number }[]>("/api/applications").then((apps) => setAppCount(apps.length)).catch(() => {});
    if (user?.roleKey === "admin") {
      api
        .get<{ status: string }[]>("/api/applications?status=pending")
        .then((apps) => setPendingCount(apps.length))
        .catch(() => {});
    }
  }, [user, pathname]);

  return (
    <aside className="bg-surface border-r border-line px-3.5 py-4.5 flex flex-col gap-5 sticky top-0 h-screen overflow-y-auto w-[236px] flex-shrink-0">
      <div className="px-1.5">
        <div className="bg-white rounded-lg px-3 py-2.5 flex items-center justify-center border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mgt-logo.png" alt="MGT — Do It Right" className="w-full h-auto max-h-[34px] object-contain" />
        </div>
        <div className="text-[10px] text-ink-faint font-mono text-center mt-1.5 tracking-wide uppercase">API Portal</div>
      </div>

      <div className="flex flex-col gap-0.5">
        <NavItem href="/ecosystem" active={pathname === "/ecosystem" || pathname.startsWith("/ecosystem/")}>
          ✨ MGT Ecosystem
        </NavItem>
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="text-[10.5px] uppercase tracking-wide text-ink-faint px-2.5 mb-1.5 font-bold">นักพัฒนา</div>
        <NavItem href="/getting-started" active={pathname === "/getting-started"}>
          {"</>"} เริ่มต้นใช้งาน
        </NavItem>
      </div>

      <div className="flex flex-col gap-0.5">
        <NavItem href="/explore" active={pathname === "/explore"}>
          🔍 ค้นหาข้อมูล
        </NavItem>
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="text-[10.5px] uppercase tracking-wide text-ink-faint px-2.5 mb-1.5 font-bold">หมวดหมู่ API</div>
        {categories.map((c) => (
          <NavItem key={c.key} href={`/api/${c.key}`} active={pathname === `/api/${c.key}`}>
            <span>{CATEGORY_ICONS[c.key] ?? "📁"}</span>
            <span className="flex-1">{c.name}</span>
            <span className="text-[10.5px] font-mono text-ink-faint bg-surface-2 rounded-full px-1.5">
              {c.endpointCount}
            </span>
          </NavItem>
        ))}
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="text-[10.5px] uppercase tracking-wide text-ink-faint px-2.5 mb-1.5 font-bold">My App</div>
        <NavItem href="/my-apps" active={pathname === "/my-apps" || pathname.startsWith("/my-apps/")}>
          <span>🗂️</span>
          <span className="flex-1">My App</span>
          <span className="text-[10.5px] font-mono text-ink-faint bg-surface-2 rounded-full px-1.5">{appCount}</span>
        </NavItem>
      </div>

      {user?.roleKey === "admin" && (
        <div className="flex flex-col gap-0.5">
          <div className="text-[10.5px] uppercase tracking-wide text-ink-faint px-2.5 mb-1.5 font-bold">Admin</div>
          <NavItem href="/admin/apis" active={pathname === "/admin/apis"}>
            ⚙️ จัดการ API
          </NavItem>
          <NavItem href="/admin/review" active={pathname === "/admin/review"}>
            <span>🛡️</span>
            <span className="flex-1">ตรวจสอบ Application</span>
            {pendingCount > 0 && (
              <span className="text-[10.5px] font-mono text-teal-strong bg-surface rounded-full px-1.5">{pendingCount}</span>
            )}
          </NavItem>
          <NavItem href="/admin/access" active={pathname === "/admin/access"}>
            🔐 ควบคุมสิทธิ์ผู้ใช้
          </NavItem>
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        <div className="text-[10.5px] uppercase tracking-wide text-ink-faint px-2.5 mb-1.5 font-bold">บัญชีของฉัน</div>
        <NavItem href="/tokens" active={pathname === "/tokens"}>
          🔑 Token ของฉัน
        </NavItem>
      </div>

      <div className="mt-auto border-t border-line pt-3 flex flex-col gap-2">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-surface-2">
          <div className="w-6.5 h-6.5 rounded-full bg-amber-soft text-amber flex items-center justify-center text-[11px] font-bold flex-shrink-0">
            {user?.displayName?.slice(0, 2) ?? "--"}
          </div>
          <div className="min-w-0">
            <b className="block text-[12px] truncate">{user?.roleName}</b>
            <span className="block text-[10.5px] text-ink-dim truncate">{user?.email}</span>
          </div>
        </div>
        <button
          onClick={() => {
            logout();
            router.push("/login");
          }}
          className="text-[12.5px] border border-line-strong rounded-lg py-1.5 hover:bg-surface-2"
        >
          ออกจากระบบ
        </button>
      </div>
    </aside>
  );
}
