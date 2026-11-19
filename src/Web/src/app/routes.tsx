import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";
// Landing page is closed for now; "/" sends people straight to sign-in.
// import LandingPage from "@/features/landing/LandingPage";
import { useAuth } from "@/shared/lib/auth";
import PortalLayout from "@/app/layout/PortalLayout";
import RequireAdmin from "@/app/layout/RequireAdmin";
import LoginPage from "@/features/auth/LoginPage";
import ManualPage from "@/features/manual/ManualPage";
import EcosystemPage from "@/features/ecosystem/EcosystemPage";
import EcosystemAppPage from "@/features/ecosystem/EcosystemAppPage";
import GettingStartedPage from "@/features/onboarding/GettingStartedPage";
import CalendarPage from "@/features/calendar/CalendarPage";
import ExplorePage from "@/features/catalog/ExplorePage";
import CategoryPage from "@/features/catalog/CategoryPage";
import MyAppsPage from "@/features/apps/MyAppsPage";
import AppDetailPage from "@/features/apps/AppDetailPage";
import TokensPage from "@/features/tokens/TokensPage";
const ExampleModule = lazy(() => import("@/features/example/ExampleModule"));
import AdminApisPage from "@/features/admin/AdminApisPage";
import AdminCategoriesPage from "@/features/admin/AdminCategoriesPage";
import AdminReviewPage from "@/features/admin/AdminReviewPage";
import AdminAccessPage from "@/features/admin/AdminAccessPage";
import AdminAuditPage from "@/features/admin/AdminAuditPage";
import AdminUsersPage from "@/features/admin/AdminUsersPage";
import CommitteePage from "@/features/admin/CommitteePage";
import LoadingScreen from "@/shared/components/LoadingScreen";

/** While the landing page is closed, "/" goes to the portal if signed in, otherwise to sign-in. */
function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? "/ecosystem" : "/login"} replace />;
}

/** Central route map. Reserve /api paths for the backend. */
export default function AppRoutes() {
  return (
    <Routes>
      <Route index element={<HomeRedirect />} />
      <Route path="login" element={<LoginPage />} />
      {/* User manual opens in its own tab from Getting Started, without the portal sidebar. */}
      <Route path="manual" element={<ManualPage />} />
      <Route path="design-preview/*" element={<Suspense fallback={<LoadingScreen fullScreen delay={150} message="Loading examples" detail="Preparing the design preview..." />}><ExampleModule /></Suspense>} />

      {/* Authenticated pages */}
      <Route element={<PortalLayout />}>
        {/* Dashboard was removed (2026-11-18); keep old links working. */}
        <Route path="dashboard" element={<Navigate to="/ecosystem" replace />} />
        <Route path="ecosystem" element={<EcosystemPage />} />
        <Route path="ecosystem/:id" element={<EcosystemAppPage />} />
        <Route path="getting-started" element={<GettingStartedPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="catalog/:category" element={<CategoryPage />} />
        <Route path="my-apps" element={<MyAppsPage />} />
        <Route path="my-apps/:id" element={<AppDetailPage />} />
        <Route path="tokens" element={<TokensPage />} />
        <Route path="reviews" element={<AdminReviewPage />} />

        {/** Administrator-only pages */}
        <Route path="admin" element={<RequireAdmin />}>
          <Route path="apis" element={<AdminApisPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="review" element={<Navigate to="/reviews" replace />} />
          <Route path="access" element={<AdminAccessPage />} />
          <Route path="audit" element={<AdminAuditPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="committee" element={<CommitteePage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
