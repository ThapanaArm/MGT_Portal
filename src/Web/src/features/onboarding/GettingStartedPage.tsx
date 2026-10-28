import { useNavigate } from "react-router";
import { Panel, Btn } from "@/shared/components/ui";
import { AppIcon } from "@/shared/components/Icon";
import { TIERS, TIER_NAME } from "@/shared/lib/tiers";

const steps = [
  ["Discover relevant services", "Browse the API Catalog by source platform and business category. A personal Tier 1 application does not connect to company services."],
  ["Prepare your application draft", "Describe the business purpose, requested company subdomain, repository, and application owner."],
  ["Choose an audience and tier", "Select who may use the application. Tier 1 is personal, Tier 2 is an internal business application, and Tier 3 is an official IT application."],
  ["Review and submit the request", "Check the summary before submitting. Tier 1 is approved automatically. Tier 2 and Tier 3 enter the review queue."],
  ["Track the independent review gates", "Tier 2 and Tier 3 need three committee members to approve with their own accounts, plus a separate IT code review. If changes are requested, revise and resubmit."],
  ["Approval and IT handoff", "The request ends at approval. IT handles repository setup, domain configuration, and deployment outside the Portal. Approved does not mean deployed."],
];
export default function GettingStartedPage() {
  const navigate = useNavigate();
  return <div><div className="portal-page-heading"><span className="workspace-kicker">Request guide</span><h1>From idea to approved request</h1><p className="review-note">Understand the decisions and responsibilities before creating your application request.</p></div><Panel title="Choose the right tier"><div className="tier-choice-grid">{TIERS.map(tier => <div className="guide-tier" key={tier}><strong>{TIER_NAME[tier]}</strong><p className="review-note">{tier === "tier1" ? "Business user · No company API connections · Automatic approval · No IT code review" : `${tier === "tier3" ? "IT team" : "Business user"} · Company services as requested · Three committee approvals · IT code review required`}</p></div>)}</div></Panel><Panel title="The request process">{steps.map(([title, description], index) => <div className="guide-step" key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{description}</p></div></div>)}<div className="flex gap-3 flex-wrap mt-6"><Btn variant="primary" startIcon={<AppIcon value="fa:plus" />} onClick={() => navigate("/my-apps?new=1")}>Create application request</Btn><Btn onClick={() => navigate("/explore")}>Browse API Catalog</Btn></div></Panel></div>;
}
