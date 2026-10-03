import { UserRole, Permission } from '../types/auth';

/**
 * Role-Based Access Control (RBAC) Matrix
 * Defines the precise permission privileges granted to each user role.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [
    'alerts:view',
    'alerts:acknowledge',
    'alerts:escalate',
    'containment:trigger',
    'containment:override',
    'cameras:view',
    'cameras:ptz',
    'cameras:export',
    'recordings:view',
    'recordings:upload',
    'recordings:delete',
    'visitors:view',
    'visitors:checkin',
    'visitors:register',
    'visitors:checkout',
    'visitors:reveal_pii',
    'doors:view',
    'doors:remote_unlock',
    'doors:lockdown',
    'elevators:view',
    'elevators:dispatch',
    'anpr:view',
    'anpr:override',
    'anpr:blacklist_edit',
    'system:health_view',
    'compliance:view',
    'compliance:export',
    'audit:view',
    'admin:users',
    'admin:devices',
    'admin:tenants',
    'admin:settings',
  ],

  security_officer: [
    'alerts:view',
    'alerts:acknowledge',
    'alerts:escalate',
    'containment:trigger',
    'containment:override',
    'cameras:view',
    'cameras:ptz',
    'recordings:view',
    'recordings:upload',
    'visitors:view',
    'visitors:reveal_pii',
    'doors:view',
    'doors:remote_unlock',
    'doors:lockdown',
    'elevators:view',
    'anpr:view',
    'anpr:override',
    'system:health_view',
    'audit:view',
  ],

  receptionist: [
    'visitors:view',
    'visitors:checkin',
    'visitors:register',
    'visitors:checkout',
    'visitors:reveal_pii',
    'elevators:view',
    'elevators:dispatch',
    'doors:view',
    'anpr:view',
  ],

  host_employee: [
    'visitors:view',
    'visitors:register',
  ],

  client_admin: [
    'visitors:view',
    'visitors:register',
    'visitors:checkout',
    'compliance:view',
    'admin:tenants',
    'audit:view',
  ],

  auditor: [
    'alerts:view',
    'visitors:view',
    'recordings:view',
    'doors:view',
    'elevators:view',
    'anpr:view',
    'system:health_view',
    'compliance:view',
    'compliance:export',
    'audit:view',
  ],
};

export function hasPermission(role: UserRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

export function hasAnyPermission(role: UserRole | undefined, permissions: Permission[]): boolean {
  if (!role) return false;
  return permissions.some((perm) => hasPermission(role, perm));
}

export function hasAllPermissions(role: UserRole | undefined, permissions: Permission[]): boolean {
  if (!role) return false;
  return permissions.every((perm) => hasPermission(role, perm));
}

export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  super_admin: 'Super Administrator',
  security_officer: 'Security Officer',
  receptionist: 'Reception / Visitor Officer',
  host_employee: 'Host / Facility Employee',
  client_admin: 'Client Tenant Administrator',
  auditor: 'Compliance & Audit Inspector (Read-Only)',
};
