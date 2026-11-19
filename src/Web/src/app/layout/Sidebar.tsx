import { SidebarFrame, SidebarItem as NavItem, SidebarGroup as NavGroup, SidebarCount as NavCount } from "@/shared/components/Sidebar";
import { AppIcon } from "@/shared/components/IconPicker";
import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { useAuth } from "@/shared/lib/auth";
import { useLocale } from "@/shared/lib/locale-context";
import { api } from "@/shared/lib/api";
import type { CommitteeStatusDto } from "@/shared/lib/types";

import { categoryIcon, useCategories } from "@/shared/lib/categories";

export default function Sidebar({ collapsed = false, onToggle }: { collapsed?: boolean; onToggle?: () => void }) {
  const { user } = useAuth();
  const { t } = useLocale();
  const { pathname, search } = useLocation();
  const reviewTab = pathname === "/reviews" ? new URLSearchParams(search).get("tab") ?? "deployment" : null;
  const categories = useCategories();
  const [pendingCount, setPendingCount] = useState(0);
  const [appCount, setAppCount] = useState(0);
  const [committee, setCommittee] = useState(false);
  const [prepCount, setPrepCount] = useState(0);
  const [deployCount, setDeployCount] = useState(0);
  const [bookingCount, setBookingCount] = useState(0);

  useEffect(() => { api.get<CommitteeStatusDto>("/api/committee/me").then(status => setCommittee(status.isReviewer)).catch(() => setCommittee(false)); }, [user?.id, pathname]);

  useEffect(() => {
    api.get<{ id: number; status: string; processStage?: string | null }[]>("/api/applications").then((apps) => {
      setAppCount(apps.length);
      if (user?.roleKey === "admin") {
        // Same lists as the App Management tabs: waiting for IT preparation, and approved but not live yet.
        setPrepCount(apps.filter((app) => app.processStage === "setup").length);
        setDeployCount(apps.filter((app) => app.status === "active" && ["awaiting-deployment", "deployed"].includes(app.processStage ?? "")).length);
      }
    }).catch(() => {});
    if (user?.roleKey === "admin") api.get<{ requested: number }>("/api/calendar/summary").then(summary => setBookingCount(summary.requested)).catch(() => {});
    if (user?.roleKey === "admin" || committee) {
      api
        .get<{ status: string }[]>("/api/applications/review-queue")
        .then((apps) => setPendingCount(apps.length))
        .catch(() => {});
    }
  }, [user, pathname, committee]);

  return (
    <SidebarFrame collapsed={collapsed} onToggle={onToggle} caption={t("nav.brandCaption")}>


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

      <NavItem label="IT Calendar" href="/calendar" active={pathname === "/calendar"}>
        <AppIcon value="fa:calendar" /><span className="flex-1">IT Calendar</span>{bookingCount > 0 && <NavCount highlight>{bookingCount}</NavCount>}
      </NavItem>

      <div className="flex flex-col gap-0.5">
        <NavItem label={t("nav.gettingStarted")} href="/getting-started" active={pathname === "/getting-started"}>
          <AppIcon value="fa-solid:book-open" /> {t("nav.gettingStarted")}
        </NavItem>
      </div>

      <NavGroup label="Web APIs" icon={<AppIcon value="fa:code" />} active={pathname === "/explore" || pathname.startsWith("/catalog/")} collapsed={collapsed}>
        <NavItem label={t("nav.exploreData")} href="/explore" active={pathname === "/explore"}>
          <AppIcon value="fa:search" /> {t("nav.exploreData")}
        </NavItem>
        {categories.map((c) => (
          <NavItem label={c.name} key={c.key} href={`/catalog/${c.key}`} active={pathname === `/catalog/${c.key}`}>
            <AppIcon value={categoryIcon(c)} />
            <span className="flex-1">{c.name}</span>
            <NavCount>{c.endpointCount}</NavCount>
          </NavItem>
        ))}
      </NavGroup>



      {user?.roleKey === "admin" ? (
        <NavGroup label="App Management" icon={<AppIcon value="fa:check" />} active={pathname === "/reviews"} collapsed={collapsed}>
          <NavItem label="Review queue" href="/reviews?tab=reviews" active={reviewTab === "reviews"}>
            <AppIcon value="fa:users" /><span className="flex-1">Review queue</span>{pendingCount > 0 && <NavCount highlight>{pendingCount}</NavCount>}
          </NavItem>
          <NavItem label="IT preparation" href="/reviews?tab=preparation" active={reviewTab === "preparation"}>
            <AppIcon value="fa:tools" /><span className="flex-1">IT preparation</span>{prepCount > 0 && <NavCount highlight>{prepCount}</NavCount>}
          </NavItem>
          <NavItem label="Deployment" href="/reviews?tab=deployment" active={reviewTab === "deployment"}>
            <AppIcon value="fa:rotate" /><span className="flex-1">Deployment</span>{deployCount > 0 && <NavCount highlight>{deployCount}</NavCount>}
          </NavItem>
        </NavGroup>
      ) : committee && <NavItem label="Requests and reviews" href="/reviews" active={pathname === "/reviews"}><AppIcon value="fa:check" /><span className="flex-1">Requests and reviews</span>{pendingCount > 0 && <NavCount highlight>{pendingCount}</NavCount>}</NavItem>}
      {user?.roleKey === "admin" && (
        <NavGroup label={t("nav.manageApis")} icon={<AppIcon value="fa:code" />} active={pathname === "/admin/apis" || pathname === "/admin/categories"} collapsed={collapsed}>
          <NavItem label="Categories" href="/admin/categories" active={pathname === "/admin/categories"}>
            <AppIcon value="fa:sitemap" /> Categories
          </NavItem>
          <NavItem label="APIs" href="/admin/apis" active={pathname === "/admin/apis"}>
            <AppIcon value="fa:gear" /> APIs
          </NavItem>
        </NavGroup>
      )}
      {user?.roleKey === "admin" && (
        <NavGroup label="Administration" icon={<AppIcon value="fa:gear" />} active={pathname.startsWith("/admin/") && pathname !== "/admin/apis" && pathname !== "/admin/categories"} collapsed={collapsed}>
          <NavItem label={t("nav.accessControl")} href="/admin/access" active={pathname === "/admin/access"}>
            <AppIcon value="fa:users" /> {t("nav.accessControl")}
          </NavItem>
          <NavItem label="Committee" href="/admin/committee" active={pathname === "/admin/committee"}>
            <AppIcon value="fa-solid:user-check" /> Committee
          </NavItem>
          <NavItem label="User management" href="/admin/users" active={pathname === "/admin/users"}>
            <AppIcon value="fa:users" /> User management
          </NavItem>
          <NavItem label="Audit & work summary" href="/admin/audit" active={pathname === "/admin/audit"}>
            <AppIcon value="fa:clipboard" /> Audit & work summary
          </NavItem>
        </NavGroup>
      )}



    </SidebarFrame>
  );
}
