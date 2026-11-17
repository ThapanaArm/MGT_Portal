import type { AppAudience, AppType } from "@/shared/lib/types";

/** Application tiers must match the backend AppTier values. */
export const TIERS: AppType[] = ["tier1", "tier2", "tier3"];

export const TIER_LABEL: Record<AppType, string> = {
  tier1: "Tier 1",
  tier2: "Tier 2",
  tier3: "Tier 3",
};

export const TIER_NAME: Record<AppType, string> = {
  tier1: "Register",
  tier2: "Verify",
  tier3: "Official",
};

export const TIER_DESC: Record<AppType, string> = {
  tier1: "Register an application that does not use company APIs. Approved automatically; no credentials issued.",
  tier2: "Verify an application that uses company APIs. Requires five committee approvals and IT code review.",
  tier3: "Official IT application. Follows the same review process as Verify.",
};

/** Older records may still hold the previous level names; map them to tier keys. */
const LEGACY_TIERS: Record<string, AppType> = { registered: "tier1", register: "tier1", verify: "tier2", official: "tier3" };

export const normalizeTier = (tier: string | null | undefined): AppType | null => {
  const key = (tier ?? "").trim().toLowerCase();
  return TIERS.includes(key as AppType) ? key as AppType : LEGACY_TIERS[key] ?? null;
};

/** Always "Tier 2 · Verify", including records saved with old level names. */
export const tierText = (tier: string | null | undefined) => {
  const key = normalizeTier(tier);
  return key ? `${TIER_LABEL[key]} · ${TIER_NAME[key]}` : "Tier not set";
};

/** Whether a tier supports API access. */
export const tierCanUseApis = (tier: AppType) => tier !== "tier1";

export const AUDIENCES: AppAudience[] = ["self", "department", "company"];

export const AUDIENCE_LABEL: Record<AppAudience, string> = {
  self: "Only me",
  department: "My department",
  company: "Entire company",
};

/** Full company domain for a requested subdomain; tolerates values already saved as a full domain. */
export const appDomain = (subdomain: string | null | undefined) => {
  const value = (subdomain ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!value) return "";
  return value.endsWith(".megachem.co.th") ? value.replace(/(\.megachem\.co\.th)+$/, ".megachem.co.th") : `${value}.megachem.co.th`;
};
