import { SidebarFrame, SidebarItem as NavItem, SidebarGroup as NavGroup, SidebarCount as NavCount } from "@/shared/components/Sidebar";
import { AppIcon } from "@/shared/components/IconPicker";
import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { useAuth } from "@/shared/lib/auth";
import { useLocale } from "@/shared/lib/locale-context";
import { api } from "@/shared/lib/api";
import type { CategoryDto, CommitteeMemberDto } from "@/shared/lib/types";

const CATEGORY_ICONS: Record<string, string> = {
  sales: "fa:chart-line",
  purchase: "fa:credit-card",
  inventory: "fa:box",
  finance: "fa:receipt",
  hr: "fa:users",
};

export default function Sidebar({ collapsed = false, onToggle }: { collapsed?: boolean; onToggle?: () => void }) {
  const { user } = useAuth();
  const { t } = useLocale();
  const { pathname } = useLocation();
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [appCount, setAppCount] = useState(0);
  const [committee, setCommittee] = useState(false);

  useEffect(() => {
    api.get<CategoryDto[]>("/api/categories").then(setCategories).catch(() => {});
  }, []);

  useEffect(() => { api.get<CommitteeMemberDto[]>("/api/committee/members").then(members => setCommittee(members.some(member => member.userId === user?.id))).catch(() => setCommittee(false)); }, [user?.id, pathname]);

  useEffect(() => {
    api.get<{ id: number }[]>("/api/applications").then((apps) => setAppCount(apps.length)).catch(() => {});
    if (user?.roleKey === "admin" || committee) {
      api
        .get<{ status: string }[]>("/api/applications/review-queue")
        .then((apps) => setPendingCount(apps.length))
        .catch(() => {});
    }
  }, [user, pathname, committee]);

  return (
    <SidebarFrame collapsed={collapsed} onToggle={onToggle} caption={t("nav.brandCaption")}>
      <NavItem label="Dashboard" href="/dashboard" active={pathname === "/dashboard"}><AppIcon value="fa:chart-column" /> Dashboard</NavItem>


      <div className="flex flex-col gap-0.5">
        <NavItem label={t("nav.ecosystem")} href="/ecosystem" active={pathname === "/ecosystem" || pathname.startsWith("/ecosystem/")}>
          <AppIcon value="fa:globe" /> {t("nav.ecosystem")}
        </NavItem>
      </div>

      <div className="flex flex-col gap-0.5">
        <NavItem label={t("nav.myApp")} href="/my-apps" active={pathname === "/my-apps" || pathname.startsWith("/my-apps/")}>
          <AppIcon value="fa:clipboard" />
          <span className="flex-1">{t("nav.myApp")}</span>
          <NavCount>{appCount}</NavCount>
        </NavItem>
      </div>

      <NavGroup label={t("nav.developerSection")} active={pathname === "/getting-started" || pathname === "/design-system"} collapsed={collapsed}>
        <NavItem label={t("nav.gettingStarted")} href="/getting-started" active={pathname === "/getting-started"}>
          <AppIcon value="fa:code" /> {t("nav.gettingStarted")}
        </NavItem>
        <NavItem label={t("nav.designSystem")} href="/design-system" active={pathname === "/design-system"}>
          <AppIcon value="fa:tools" /> {t("nav.designSystem")}
        </NavItem>
      </NavGroup>

      <div className="flex flex-col gap-0.5">
        <NavItem label={t("nav.exploreData")} href="/explore" active={pathname === "/explore"}>
          <AppIcon value="fa:search" /> {t("nav.exploreData")}
        </NavItem>
      </div>

      <NavGroup label={t("nav.apiCategories")} active={pathname.startsWith("/catalog/")} collapsed={collapsed}>
        {categories.map((c) => (
          <NavItem label={c.name} key={c.key} href={`/catalog/${c.key}`} active={pathname === `/catalog/${c.key}`}>
            <AppIcon value={CATEGORY_ICONS[c.key] ?? "fa:box"} />
            <span className="flex-1">{c.name}</span>
            <NavCount>{c.endpointCount}</NavCount>
          </NavItem>
        ))}
      </NavGroup>



      {(user?.roleKey === "admin" || committee) && <NavItem label="Requests and reviews" href="/reviews" active={pathname === "/reviews"}><AppIcon value="fa:check" /><span className="flex-1">Requests and reviews</span>{pendingCount > 0 && <NavCount highlight>{pendingCount}</NavCount>}</NavItem>}
      {user?.roleKey === "admin" && (
        <NavGroup label={t("nav.adminSection")} active={pathname.startsWith("/admin/")} collapsed={collapsed}>
          <NavItem label={t("nav.manageApis")} href="/admin/apis" active={pathname === "/admin/apis"}>
            <AppIcon value="fa:gear" /> {t("nav.manageApis")}
          </NavItem>
          <NavItem label={t("nav.accessControl")} href="/admin/access" active={pathname === "/admin/access"}>
            <AppIcon value="fa:users" /> {t("nav.accessControl")}
          </NavItem>
        </NavGroup>
      )}



    </SidebarFrame>
  );
}
