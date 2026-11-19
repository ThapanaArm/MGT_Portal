export type RoleKey = "admin" | "sales" | "purchase" | "finance" | "hr" | "employee";

/** Organization level determines default data visibility. */
export type OrgLevel = "employee" | "sales_manager" | "manager" | "management";

/** Row-level data visibility is independent of API scopes. */
export type DataScope = "self" | "team" | "salegroup" | "all";

export interface UserDto {
  id: number;
  email: string;
  displayName: string;
  roleKey: RoleKey;
  roleName: string;
  /** Allowed API scopes. */
  scopes: string[];
  apiPermissions?: Record<string, { readScope: DataScope | "none"; writeScope: DataScope | "none" }>;
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
  /** Font Awesome value chosen by an admin, e.g. "fa:chart-line" */
  icon?: string;
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
/** "rejected": closed by the committee; it cannot be edited or sent again. */
export type AppStatus = "draft" | "pending" | "active" | "suspended" | "rejected";
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
  ownerDisplayName?: string | null;
  createdAt: string;
  updatedAt: string;
  audience: AppAudience;
  processStage?: string | null;
  /** Tier being requested while the request is in progress (null once approved). */
  requestedTier?: AppType | null;
}

export interface CredentialDto {
  env: CredEnv;
  /** API category key (e.g. sales) — one token per category per environment */
  category: string;
  tokenId: string;
  tokenSecret: string;
  /** Production key seen by someone other than IT: tokenId is partly masked and tokenSecret is empty. */
  hidden?: boolean;
  createdAt: string;
}

export interface LogEntryDto {
  actionType: "create" | "review" | "update" | "publish" | "unpublish";
  occurredAt: string;
  actor: string;
  note: string | null;
}

export interface VoteDto {
  /** User account of the committee member who recorded this decision. */
  reviewerUserId: number;
  memberName: string;
  memberEmail: string;
  approved: boolean;
  actorEmail: string | null;
  decidedAt: string | null;
  note: string | null;
  /** Rejected the request (approved is false too); note holds the required reason. */
  rejected?: boolean;
}

export interface AppDetailDto {
  canEditData?: boolean;
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
  /** Committee seats of this request (every member must approve): 5 for new requests, 3 for requests created before the change. */
  committeeSize?: number;
  requiresCodeReview: boolean;
  /** This application's own committee (up to committeeSize people, chosen and replaceable by IT). */
  reviewers?: ReviewerDto[] | null;
  /** Every request for changes across all review cycles, newest first. */
  changeRequests?: ChangeRequestDto[] | null;
}

export interface ChangeRequestDto {
  resolvedInCycle?: number | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  cycle: number;
  source: "it" | "committee";
  by: string;
  at: string;
  note: string | null;
  links: string[];
}

/** A committee member assigned to one application. */
export interface ReviewerDto {
  userId: number;
  name: string;
  email: string;
  assignedAt: string;
  assignedBy: string;
}

export interface DeveloperPreparation { email: string; gitReady: boolean; apiReady: boolean }
export interface ReleaseRecord { requestId: number; version: string | null; changeSummary: string | null; branch: string | null; commit: string | null; deployedBy: string | null; deployedAt: string | null; liveBy: string | null; liveAt: string | null }
export interface DevelopmentRequest { version?: string | null; changeSummary?: string | null; parentApplicationId?: number | null; pendingUpdateId?: number | null; releases?: ReleaseRecord[] | null; deployedBy?: string | null; deployedAt?: string | null; liveBy?: string | null; liveAt?: string | null; stage: string; targetTier: AppType; developers: DeveloperPreparation[] | null; branch: string | null; commit: string | null }

export interface CodeReviewDto {
  approved: boolean;
  reviewerEmail: string;
  note: string | null;
  reviewedAt: string;
  /** Supporting links (SharePoint, OneDrive, ...). The Portal does not store files. */
  links?: string[] | null;
}

/** Committee status of the signed-in user (committees are per application). */
export interface CommitteeMemberDto {
  userId: number;
  email: string;
  displayName: string;
}

export interface CommitteeStatusDto {
  isReviewer: boolean;
  pendingAssigned: number;
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
  readDataScope?: DataScope | null;
  writeDataScope?: DataScope | null;
  effectiveWriteDataScope?: DataScope;
  /** Sale group (set in the database by IT). */
  saleGroupName?: string | null;
  /** Employee IDs per platform, e.g. "sap: 50001234" (set in the database by IT). */
  platformIds?: string[] | null;
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

/** A personal token: apps send it as X-User-Token so the Gateway returns only this person's data. */
export interface UserTokenDto {
  id: number;
  name: string;
  prefix: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  status: "active" | "expired" | "revoked";
}

export type CalendarKind = "available" | "deploy" | "meeting" | "freeze";
export type CalendarStatus = "requested" | "confirmed" | "declined" | "cancelled";

/** One entry in the IT calendar. Other people's bookings arrive with private = true and no details. */
export interface CalendarEventDto {
  id: number;
  kind: CalendarKind;
  status: CalendarStatus;
  title: string;
  note: string | null;
  startAt: string;
  endAt: string;
  applicationId: number | null;
  applicationName: string | null;
  requestedByName: string | null;
  requestedByEmail: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  updatedAt: string;
  mine: boolean;
  private: boolean;
}
