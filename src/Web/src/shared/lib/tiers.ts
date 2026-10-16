import type { AppAudience, AppType } from "@/shared/lib/types";

/** ระดับของ App — ต้องตรงกับ AppTier ฝั่ง backend (Modules/Apps/Domain/AppEnums.cs) */
export const TIERS: AppType[] = ["tier1", "tier2", "tier3"];

export const TIER_LABEL: Record<AppType, string> = {
  tier1: "Tier 1",
  tier2: "Tier 2",
  tier3: "Tier 3",
};

export const TIER_NAME: Record<AppType, string> = {
  tier1: "แอปส่วนตัว",
  tier2: "แอปภายใน",
  tier3: "แอป Official",
};

export const TIER_DESC: Record<AppType, string> = {
  tier1: "แอปส่วนตัวที่ไม่ต่อ API — อนุมัติอัตโนมัติ ไม่ได้ credential",
  tier2: "แอปภายในที่ต่อ API — ต้องได้กรรมการ 3 เสียงและผ่าน IT รีวิวโค้ด",
  tier3: "แอป Official โดยทีม IT — ขั้นตอนเหมือน Tier 2",
};

/** Tier ที่ขอใช้ API ได้ (Tier 1 ห้าม) */
export const tierCanUseApis = (tier: AppType) => tier !== "tier1";

export const AUDIENCES: AppAudience[] = ["self", "department", "company"];

export const AUDIENCE_LABEL: Record<AppAudience, string> = {
  self: "เฉพาะฉัน",
  department: "แผนกของฉัน",
  company: "ทั้งบริษัท",
};
