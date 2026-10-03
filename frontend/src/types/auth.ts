export type UserRole =
  | 'super_admin'
  | 'security_officer'
  | 'receptionist'
  | 'host_employee'
  | 'client_admin'
  | 'auditor';

/**
 * Role codes persisted in the `users.role` field (enforced by the MongoDB
 * `$jsonSchema` enum in migration 0001).
 * The console's RBAC matrix is keyed on `UserRole`, so every database role is
 * projected onto exactly one console role via `toConsoleRole`.
 */
export type BackendRole = 'admin' | 'operator' | 'guard' | 'auditor';

/**
 * Mapping between the database role vocabulary and the console's clearance model.
 *
 * The console distinguishes six operational roles while the database stores four,
 * so an explicit projection is required. Treating the two as interchangeable
 * would silently grant the wrong permission set: e.g. letting `guard` fall
 * through to `super_admin` would hand an unprivileged account every privilege.
 */
const BACKEND_TO_CONSOLE_ROLE: Record<BackendRole, UserRole> = {
  admin: 'super_admin',
  operator: 'security_officer',
  guard: 'receptionist',
  auditor: 'auditor',
};

/**
 * Projects a database role onto its console role.
 * Unrecognised values fall back to the least-privileged role rather than
 * defaulting to an elevated one, so an unexpected row cannot escalate access.
 */
export function toConsoleRole(role: string | null | undefined): UserRole {
  if (!role) return 'auditor';
  return BACKEND_TO_CONSOLE_ROLE[role as BackendRole] ?? 'auditor';
}

export type ClearanceLevel = 'TOP_SECRET' | 'RESTRICTED' | 'STANDARD' | 'VISITOR';

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  department: string;
  badgeNumber: string;
  clearanceLevel: ClearanceLevel;
  mfaVerified: boolean;
  avatarUrl?: string;
  lastLoginAt: string;
}

export type Permission =
  | 'alerts:view'
  | 'alerts:acknowledge'
  | 'alerts:escalate'
  | 'containment:trigger'
  | 'containment:override'
  | 'cameras:view'
  | 'cameras:ptz'
  | 'cameras:export'
  | 'recordings:view'
  | 'recordings:upload'
  | 'recordings:delete'
  | 'visitors:view'
  | 'visitors:checkin'
  | 'visitors:register'
  | 'visitors:checkout'
  | 'visitors:reveal_pii'
  | 'doors:view'
  | 'doors:remote_unlock'
  | 'doors:lockdown'
  | 'elevators:view'
  | 'elevators:dispatch'
  | 'anpr:view'
  | 'anpr:override'
  | 'anpr:blacklist_edit'
  | 'system:health_view'
  | 'compliance:view'
  | 'compliance:export'
  | 'audit:view'
  | 'admin:users'
  | 'admin:devices'
  | 'admin:tenants'
  | 'admin:settings';

export interface UserSession {
  id: string;
  userId: string;
  ipAddress: string;
  vlan: string;
  terminalName: string;
  startedAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isMfaRequired: boolean;
  isMfaVerified: boolean;
  authMode: 'mock' | 'keycloak';
  sessions: UserSession[];
  idleTimeoutSeconds: number;
  lastActivityTimestamp: number;
  isIdleWarningOpen: boolean;
}

/* -------------------------------------------------------------------------- */
/* API-facing shapes (mirrors the Express API / Postgres column layout)         */
/* -------------------------------------------------------------------------- */

export interface AuthUserResponse {
  id: string;
  username: string;
  email: string;
  role: BackendRole;
  fullName: string;
  status: string;
  department: string;
  badgeNumber: string | null;
  clearanceLevel: ClearanceLevel;
  mfaVerified: boolean;
  lastLoginAt: string | null;
}

export interface LoginResponse {
  token: string;
  user: AuthUserResponse;
}

export interface UserRegistryRecord extends AuthUserResponse {
  created_at: string;
  updated_at: string;
}
