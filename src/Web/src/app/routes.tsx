import { Navigate, Route, Routes } from "react-router";
import HomeRedirect from "@/app/HomeRedirect";
import PortalLayout from "@/app/layout/PortalLayout";
import RequireAdmin from "@/app/layout/RequireAdmin";
import LoginPage from "@/features/auth/LoginPage";
import EcosystemPage from "@/features/ecosystem/EcosystemPage";
import EcosystemAppPage from "@/features/ecosystem/EcosystemAppPage";
import GettingStartedPage from "@/features/onboarding/GettingStartedPage";
import ExplorePage from "@/features/catalog/ExplorePage";
import CategoryPage from "@/features/catalog/CategoryPage";
import MyAppsPage from "@/features/apps/MyAppsPage";
import AppDetailPage from "@/features/apps/AppDetailPage";
import TokensPage from "@/features/tokens/TokensPage";
import AdminApisPage from "@/features/admin/AdminApisPage";
import AdminReviewPage from "@/features/admin/AdminReviewPage";
import AdminAccessPage from "@/features/admin/AdminAccessPage";

/**
 * แผนที่ URL ทั้งหมดของหน้าเว็บ — เพิ่มหน้าใหม่ที่นี่ที่เดียว
 * หมายเหตุ: ห้ามตั้ง path ขึ้นต้นด้วย /api เพราะเป็นของ backend
 */
export default function AppRoutes() {
  return (
    <Routes>
      <Route index element={<HomeRedirect />} />
      <Route path="login" element={<LoginPage />} />

      {/* หน้าหลังล็อกอิน */}
      <Route element={<PortalLayout />}>
        <Route path="ecosystem" element={<EcosystemPage />} />
        <Route path="ecosystem/:id" element={<EcosystemAppPage />} />
        <Route path="getting-started" element={<GettingStartedPage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="catalog/:category" element={<CategoryPage />} />
        <Route path="my-apps" element={<MyAppsPage />} />
        <Route path="my-apps/:id" element={<AppDetailPage />} />
        <Route path="tokens" element={<TokensPage />} />

        {/* ผู้ดูแลระบบเท่านั้น */}
        <Route path="admin" element={<RequireAdmin />}>
          <Route path="apis" element={<AdminApisPage />} />
          <Route path="review" element={<AdminReviewPage />} />
          <Route path="access" element={<AdminAccessPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
