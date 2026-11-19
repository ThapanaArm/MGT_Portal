import { useNavigate } from "react-router";
import { Panel, Btn } from "@/shared/components/ui";
import { AppIcon } from "@/shared/components/Icon";
import { TIERS, TIER_NAME } from "@/shared/lib/tiers";

const steps = [
  ["Discover relevant services", "Browse the API Catalog by source platform and business category. A personal Register application does not connect to company services."],
  ["Prepare your application draft", "Describe the business purpose, requested company subdomain, GitHub, and application owner."],
  ["Choose an audience and tier", "Select who may use the application. Register is personal, Verify is an internal business application, and Official is an official IT application."],
  ["Review and submit the request", "Check the summary before submitting. Every request enters the committee review queue."],
  ["Track the independent review gates", "The same committee of five reviews every request. Register needs 3 of 5 approvals; Verify and Official need all 5 approvals plus a separate IT code review. If changes are requested, revise and resubmit. A committee member can also reject with a reason; once the approvals needed are no longer possible, the request is closed and a new request is required."],
  ["Approval and IT handoff", "The request ends at approval. IT handles GitHub setup, domain configuration, and deployment outside the Portal. Approved does not mean deployed."],
];
export default function GettingStartedPage() {
  const navigate = useNavigate();
  return <div><div className="portal-page-heading flex items-start justify-between gap-6 flex-wrap"><div className="min-w-0"><h1>From idea to approved request</h1></div><a className="portal-button portal-button-secondary inline-flex items-center gap-2 shrink-0" href="/manual" target="_blank" rel="noopener noreferrer"><AppIcon value="fa-solid:book-open" /> Open user manual <AppIcon value="fa:external-link" /></a></div><Panel title="Choose the right tier"><div className="tier-choice-grid">{TIERS.map(tier => <div className={`guide-tier ${tier === "tier2" ? "is-common" : ""}`} key={tier}><strong>{TIER_NAME[tier]}{tier === "tier2" && <span className="guide-tier-tag">Most requests</span>}</strong><p className="review-note">{tier === "tier1" ? "Business user · No company API connections · 3 of 5 committee approvals · No IT code review" : `${tier === "tier3" ? "IT team" : "Business user"} · Company services as requested · Five committee approvals · IT code review required`}</p></div>)}</div></Panel><Panel title="The request process">{steps.map(([title, description], index) => <div className="guide-step" key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{description}</p></div></div>)}<div className="flex gap-3 flex-wrap mt-6"><Btn variant="primary" startIcon={<AppIcon value="fa:plus" />} onClick={() => navigate("/my-apps?new=1")}>Create application request</Btn><Btn onClick={() => navigate("/explore")}>Browse API Catalog</Btn></div></Panel></div>;
}
