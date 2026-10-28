import { Link, useLocation } from "react-router";
import { useLocale } from "@/shared/lib/locale-context";
import { AppIcon } from "@/shared/components/IconPicker";

export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const { t } = useLocale();
  const parts = pathname.split("/").filter(Boolean);
  const labels: Record<string, string> = {
    dashboard: "Dashboard",
    reviews: "Requests and reviews",
    ecosystem: t("nav.ecosystem"), "getting-started": t("nav.gettingStarted"),
    "design-preview": "Example website", "design-system": t("nav.designSystem"), explore: t("nav.exploreData"),
    catalog: t("nav.apiCategories"), "my-apps": t("nav.myApp"), tokens: t("nav.myTokens"),
    admin: t("nav.adminSection"), apis: t("nav.manageApis"), review: t("nav.reviewApplications"), access: t("nav.accessControl"),
    sales: "Sales", purchase: "Purchasing", inventory: "Inventory", finance: "Finance", hr: "Human Resources",
  };
  const hasParent = parts.length > 1 && ["ecosystem", "my-apps"].includes(parts[0]);
  const backLabel = hasParent ? `Back to ${labels[parts[0]]}` : "Home";
  return <nav aria-label="Breadcrumb" className="content-breadcrumb-card">
    <Link to={hasParent ? `/${parts[0]}` : "/dashboard"} aria-label={backLabel} title={backLabel} className={`breadcrumb-home ${hasParent ? "breadcrumb-back" : ""}`}><AppIcon value={hasParent ? "fa:arrow-left" : "fa:home"} /></Link>
    <ol>{parts.map((part, index) => {
      const current = index === parts.length - 1;
      const label = labels[part] ?? "Application details";
      const href = `/${parts.slice(0, index + 1).join("/")}`;
      const linked = !current && (part === "ecosystem" || part === "my-apps");
      return <li key={href}>{(!hasParent || index > 0) && <span aria-hidden="true" className="breadcrumb-divider">/</span>}{linked ? <Link to={href}>{label}</Link> : <span aria-current={current ? "page" : undefined}>{label}</span>}</li>;
    })}</ol>
  </nav>;
}
