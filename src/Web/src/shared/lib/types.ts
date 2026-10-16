export type RoleKey = "admin" | "sales" | "purchase" | "finance" | "hr";

/** ระดับในองค์กร — กำหนดขอบเขตการเห็นข้อมูลเริ่มต้น */
export type OrgLevel = "employee" | "manager" | "management";

/** ขอบเขตข้อมูลระดับแถว — คนละชั้นกับ scopes ซึ่งคุมว่าเรียก endpoint ไหนได้ */
export type DataScope = "self" | "team" | "all";

export interface UserDto {
  id: number;
  email: string;
  displayName: string;
  roleKey: RoleKey;
  roleName: string;
  /** เรียก endpoint ไหนได้ */
  scopes: string[];
  level: OrgLevel;
  /** เห็นข้อมูลของใครได้ */
  dataScope: DataScope;
  teamName: string | null;
}

export interface CategoryDto {
  id: number;
  key: string;
  name: string;
  basePath: string;
  description: string;
  rateLimit: string;
  endpointCount: number;
}

export type ParamRow = [name: string, location: string, type: string, required: string, description: string];

export interface EndpointDto {
  id: number;
  categoryId: number;
  method: string;
  path: string;
  summary: string;
  description: string;
  scope: string;
  icon: string;
  scenario: string;
  params: ParamRow[];
  reqBody: string | null;
  respExample: string;
  respFields: [field: string, type: string, description: string][];
}

/** Tier ของ App — ดู shared/lib/tiers.ts */
export type AppType = "tier1" | "tier2" | "tier3";
/** ใครใช้ App ได้ */
export type AppAudience = "self" | "department" | "company";
export type AppStatus = "draft" | "pending" | "active" | "suspended";
export type CredEnv = "sandbox" | "production";

export interface AppSummaryDto {
  id: number;
  name: string;
  description: string;
  subdomain: string;
  github: string;
  products: string[];
  status: AppStatus;
  type: AppType;
  reviewTarget: AppType | null;
  image: string | null;
  icon: string;
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
  audience: AppAudience;
}

export interface CredentialDto {
  env: CredEnv;
  tokenId: string;
  tokenSecret: string;
  createdAt: string;
}

export interface LogEntryDto {
  actionType: "create" | "review" | "update" | "publish" | "unpublish";
  occurredAt: string;
  actor: string;
  note: string | null;
}

export interface VoteDto {
  committeeMemberId: number;
  memberName: string;
  memberRoleTitle: string;
  approved: boolean;
}

export interface AppDetailDto {
  summary: AppSummaryDto;
  screenshots: string[];
  credentials: CredentialDto[];
  log: LogEntryDto[];
  votes: VoteDto[];
  reviewCycle: number;
  /** ผล IT code review ของรอบปัจจุบัน (null = ยังไม่รีวิว) */
  codeReview: CodeReviewDto | null;
  /** จำนวนเสียงที่ต้องได้สำหรับ Tier ที่ขอ */
  requiredVotes: number;
  requiresCodeReview: boolean;
}

export interface CodeReviewDto {
  approved: boolean;
  reviewerEmail: string;
  note: string | null;
  reviewedAt: string;
}

export interface CommitteeMemberDto {
  id: number;
  name: string;
  roleTitle: string;
}

export interface TokenDto {
  id: number;
  value: string;
  scopes: string[];
  env: CredEnv;
  expiry: string;
  createdAt: string;
}

export interface UserBriefDto {
  id: number;
  email: string;
  displayName: string;
  roleKey: RoleKey;
  roleName: string;
  level: OrgLevel;
  teamId: number | null;
  teamName: string | null;
  /** ตั้งไว้เมื่อบางตำแหน่งต้องเห็นกว้างกว่าระดับปกติ — null = ใช้ตามระดับ */
  dataScopeOverride: DataScope | null;
  effectiveDataScope: DataScope;
}

export interface TeamDto {
  id: number;
  key: string;
  name: string;
  memberCount: number;
}

export interface AccessGrantDto {
  id: number;
  userId: number;
  userEmail: string;
  userDisplayName: string;
  categoryId: number;
  categoryKey: string;
  categoryName: string;
  scope: string;
  grantedAt: string;
  expiresAt: string | null;
  revoked: boolean;
  isExpired: boolean;
  grantedByName: string;
  note: string | null;
}
