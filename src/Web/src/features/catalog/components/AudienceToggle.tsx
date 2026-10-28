import { Tabs } from "@/shared/components/design-system";
import { useAudience } from "@/features/catalog/audience-context";

export default function AudienceToggle({ className = "mb-4" }: { className?: string }) {
  const { audience, setAudience } = useAudience();
  return <div className={`audience-toolbar ${className}`}><Tabs label="Catalog view" items={["Business view", "Developer view"]} value={audience === "business" ? "Business view" : "Developer view"} onChange={value => setAudience(value === "Business view" ? "business" : "developer")} /></div>;
}
