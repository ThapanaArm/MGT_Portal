import { AppIcon } from "@/shared/components/Icon";
import { ContextBar } from "@/shared/components/AccountControls";
import Breadcrumbs from "@/app/layout/Breadcrumbs";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, Outlet, useNavigate } from "react-router";
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

/**
 * Authenticated layout: a full-width app bar (menu button, logo, program name, account) on top.
 * The sidebar is hidden until the menu button is pressed. On wide screens it pushes the content and
 * the choice is remembered; on narrow screens it opens as a drawer over the page.
 */
export default function PortalLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const mobile = useSyncExternalStore(subscribeToViewport, isMobileViewport);
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem("mgt_sidebar_open") === "true");
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
    if (mobile) setDrawerOpen(open => !open);
    else {
      const next = !sidebarOpen;
      setSidebarOpen(next);
      localStorage.setItem("mgt_sidebar_open", String(next));
    }
  };
  const menuOpen = mobile ? drawerOpen : sidebarOpen;

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) return <LoadingScreen fullScreen delay={150} message="Loading MGT Portal" detail="Checking your sign-in..." />;

  return (
    <EnvProvider>
      <AudienceProvider>
        <header className="portal-appbar">
          <button type="button" className="portal-appbar-menu" onClick={toggleSidebar} aria-controls="portal-sidebar" aria-expanded={menuOpen} aria-label={menuOpen ? "Close menu" : "Open menu"}>
            <AppIcon value="fa:bars" />
          </button>
          <Link to="/ecosystem" className="portal-appbar-brand" aria-label="MGT Portal home">
            <img src="/mgt-logo.png" alt="" />
            <span>MGT Portal</span>
          </Link>
          <TopBar />
        </header>
        <div className="portal-shell flex w-full">
          {!mobile && sidebarOpen && <Sidebar />}
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
              <Breadcrumbs />
            </ContextBar>
            <Outlet /></div>
          </main>
        </div>
      </AudienceProvider>
    </EnvProvider>
  );
}
