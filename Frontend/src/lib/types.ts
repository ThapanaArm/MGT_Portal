export type RoleKey = "admin" | "sales" | "purchase" | "finance" | "hr";

export interface UserDto {
  id: number;
  email: string;
  displayName: string;
  roleKey: RoleKey;
  roleName: string;
  scopes: string[];
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

export type AppType = "registered" | "verify" | "official";
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
