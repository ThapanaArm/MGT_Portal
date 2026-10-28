import { AppIcon } from "@/shared/components/Icon";
import { ContextBar } from "@/shared/components/AccountControls";
import Breadcrumbs from "@/app/layout/Breadcrumbs";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Outlet, useNavigate } from "react-router";
import { useAuth } from "@/shared/lib/auth";
import { EnvProvider } from "@/features/catalog/env-context";
import { AudienceProvider } from "@/features/catalog/audience-context";
import Sidebar from "@/app/layout/Sidebar";
import TopBar from "@/app/layout/TopBar";
import LoadingScreen from "@/shared/components/LoadingScreen";

const mobileQuery = "(max-width: 760px)";
const subscribeToViewport = (notify: () => void) => {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const isMobileViewport = () => window.matchMedia(mobileQuery).matches;

/** Authenticated layout with sidebar, context bar, and child routes. */
export default function PortalLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const mobile = useSyncExternalStore(subscribeToViewport, isMobileViewport);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("mgt_sidebar_collapsed") === "true");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!mobile || !drawerOpen || !user) return;
    const dialog = drawerRef.current;
    if (!dialog) return;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [mobile, drawerOpen, user]);

  const toggleSidebar = () => {
    if (mobile) setDrawerOpen(true);
    else {
      const next = !collapsed;
      setCollapsed(next);
      localStorage.setItem("mgt_sidebar_collapsed", String(next));
    }
  };

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) return <LoadingScreen fullScreen delay={150} message="Loading MGT Hub" detail="Checking your sign-in..." />;

  return (
    <EnvProvider>
      <AudienceProvider>
        <div className="portal-shell flex min-h-screen w-full">
          {!mobile && <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />}
          {mobile && (
            <dialog ref={drawerRef} className="sidebar-drawer" aria-label="Main navigation" onClose={() => setDrawerOpen(false)} onClick={(event) => {
              if (event.target === event.currentTarget) setDrawerOpen(false);
              else if ((event.target as HTMLElement).closest("a")) setDrawerOpen(false);
            }}>
              <button autoFocus type="button" aria-label="Close menu" onClick={() => setDrawerOpen(false)} className="sidebar-drawer-close"><AppIcon value="fa:close"/></button>
              <Sidebar />
            </dialog>
          )}
          <main className="flex-1 min-w-0 flex flex-col">
            <div className="portal-content w-full"><ContextBar>
              {mobile && <button type="button" onClick={toggleSidebar} aria-controls="portal-sidebar" aria-expanded={drawerOpen} aria-label="Open menu" className="context-menu-toggle">
                <AppIcon value="fa:bars"/>
              </button>}
              <Breadcrumbs />
              <TopBar />
            </ContextBar><Outlet /></div>
          </main>
        </div>
      </AudienceProvider>
    </EnvProvider>
  );
}
