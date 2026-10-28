import type { AppAudience, AppType } from "@/shared/lib/types";

/** Application tiers must match the backend AppTier values. */
export const TIERS: AppType[] = ["tier1", "tier2", "tier3"];

export const TIER_LABEL: Record<AppType, string> = {
  tier1: "Tier 1",
  tier2: "Tier 2",
  tier3: "Tier 3",
};

export const TIER_NAME: Record<AppType, string> = {
  tier1: "Personal application",
  tier2: "Internal application",
  tier3: "Official application",
};

export const TIER_DESC: Record<AppType, string> = {
  tier1: "Personal application without APIs. Automatically approved; no credentials issued.",
  tier2: "Internal application with APIs. Requires three committee approvals and IT code review.",
  tier3: "Official IT application. Follows the same review process as Tier 2.",
};

/** Whether a tier supports API access. */
export const tierCanUseApis = (tier: AppType) => tier !== "tier1";

export const AUDIENCES: AppAudience[] = ["self", "department", "company"];

export const AUDIENCE_LABEL: Record<AppAudience, string> = {
  self: "Only me",
  department: "My department",
  company: "Entire company",
};
