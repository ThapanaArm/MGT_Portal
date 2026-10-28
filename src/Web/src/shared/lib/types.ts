export type RoleKey = "admin" | "sales" | "purchase" | "finance" | "hr";

/** Organization level determines default data visibility. */
export type OrgLevel = "employee" | "manager" | "management";

/** Row-level data visibility is independent of API scopes. */
export type DataScope = "self" | "team" | "all";

export interface UserDto {
  id: number;
  email: string;
  displayName: string;
  roleKey: RoleKey;
  roleName: string;
  /** Allowed API scopes. */
  scopes: string[];
  level: OrgLevel;
  /** Effective data visibility. */
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
  sourcePlatform: string;
  icon: string;
  scenario: string;
  params: ParamRow[];
  reqBody: string | null;
  respExample: string;
  respFields: [field: string, type: string, description: string][];
}

/** Application tier; see shared/lib/tiers.ts. */
export type AppType = "tier1" | "tier2" | "tier3";
/** Application audience */
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
  processStage?: string | null;
}

export interface CredentialDto {
  env: CredEnv;
  /** API category key (e.g. sales) — one token per category per environment */
  category: string;
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
  actorEmail: string | null;
  decidedAt: string | null;
  note: string | null;
}

export interface AppDetailDto {
  development?: DevelopmentRequest | null;
  summary: AppSummaryDto;
  screenshots: string[];
  credentials: CredentialDto[];
  log: LogEntryDto[];
  votes: VoteDto[];
  reviewCycle: number;
  /** Current IT code review; null means not reviewed. */
  codeReview: CodeReviewDto | null;
  /** Required committee votes for the requested tier. */
  requiredVotes: number;
  requiresCodeReview: boolean;
}

export interface DeveloperPreparation { email: string; gitReady: boolean; apiReady: boolean }
export interface DevelopmentRequest { stage: string; targetTier: AppType; developers: DeveloperPreparation[] | null; branch: string | null; commit: string | null }

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
  userId: number | null;
  email: string | null;
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
  /** Optional visibility override; null uses the organization default. */
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
