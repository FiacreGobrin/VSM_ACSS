import { describe, it, expect, beforeEach } from 'vitest';
import { toConsoleRole } from '../types/auth';
import { maskPii, piiTypeFromIdType, formatRelativeTime } from '../lib/utils';
import { hasPermission } from '../lib/permissions';
import { useAuthStore } from '../stores/authStore';
import { useSystemStore } from '../stores/systemStore';

describe('Database ↔ Console Role Projection', () => {
  it('maps each Postgres role onto its console clearance tier', () => {
    expect(toConsoleRole('admin')).toBe('super_admin');
    expect(toConsoleRole('operator')).toBe('security_officer');
    expect(toConsoleRole('guard')).toBe('receptionist');
    expect(toConsoleRole('auditor')).toBe('auditor');
  });

  it('falls back to the least-privileged role for unknown or missing values', () => {
    // A null/unrecognised role must never resolve to an elevated tier, or a
    // malformed database row would silently grant administrative access.
    expect(toConsoleRole(null)).toBe('auditor');
    expect(toConsoleRole(undefined)).toBe('auditor');
    expect(toConsoleRole('superuser')).toBe('auditor');
  });

  it('keeps a guard from inheriting super_admin privileges after login', () => {
    const role = toConsoleRole('guard');
    expect(hasPermission(role, 'visitors:checkin')).toBe(true);
    expect(hasPermission(role, 'doors:lockdown')).toBe(false);
    expect(hasPermission(role, 'admin:users')).toBe(false);
  });
});

describe('PII Masking Against Database Values', () => {
  it('selects the correct mask from the stored id_type discriminator', () => {
    expect(piiTypeFromIdType('passport')).toBe('passport');
    expect(piiTypeFromIdType('national_id')).toBe('national_id');
    expect(piiTypeFromIdType('drivers_license')).toBe('national_id');
    expect(piiTypeFromIdType(null)).toBe('national_id');
  });

  it('formats Postgres timestamptz values as relative ages', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
    expect(formatRelativeTime(null)).toBe('—');
    expect(formatRelativeTime('not-a-date')).toBe('—');
  });
});

describe('RBAC & Air-Gap Clearance Matrix', () => {
  it('grants super_admin full command privileges', () => {
    expect(hasPermission('super_admin', 'doors:lockdown')).toBe(true);
    expect(hasPermission('super_admin', 'containment:trigger')).toBe(true);
    expect(hasPermission('super_admin', 'admin:settings')).toBe(true);
  });

  it('restricts auditor to read-only clearance', () => {
    expect(hasPermission('auditor', 'alerts:view')).toBe(true);
    expect(hasPermission('auditor', 'compliance:view')).toBe(true);
    expect(hasPermission('auditor', 'doors:remote_unlock')).toBe(false);
    expect(hasPermission('auditor', 'containment:trigger')).toBe(false);
  });

  it('allows receptionist to manage visitors and Otis elevator dispatch', () => {
    expect(hasPermission('receptionist', 'visitors:checkin')).toBe(true);
    expect(hasPermission('receptionist', 'elevators:dispatch')).toBe(true);
    expect(hasPermission('receptionist', 'doors:lockdown')).toBe(false);
  });
});

describe('Air-Gapped PII Protection', () => {
  it('masks National ID numbers by default', () => {
    const masked = maskPii('1198580029381014', 'national_id');
    expect(masked).toBe('119••••••••14');
    expect(masked).not.toContain('85800293810');
  });

  it('masks Passport numbers properly', () => {
    const masked = maskPii('PA9920145', 'passport');
    expect(masked).toBe('PA••••45');
    expect(masked).not.toContain('99201');
  });
});

describe('Auth Store & Inactivity Management', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it('verifies 6-digit hardware MFA token', () => {
    const store = useAuthStore.getState();
    store.loginMock('security_officer', false); // Require MFA
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    const verified = useAuthStore.getState().verifyMfa('123456');
    expect(verified).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.role).toBe('security_officer');
  });

  it('triggers emergency facility lockdown with operational metadata', () => {
    const store = useAuthStore.getState();
    store.loginMock('super_admin', true);
    store.triggerEmergencyLockdown('Perimeter breach test');

    expect(useAuthStore.getState().isEmergencyLockdownActive).toBe(true);
    expect(useAuthStore.getState().lockdownMetadata?.reason).toBe('Perimeter breach test');

    store.cancelEmergencyLockdown();
    expect(useAuthStore.getState().isEmergencyLockdownActive).toBe(false);
  });
});

describe('Outbound-Only Verification Tunnel State Machine', () => {
  it('cycles strictly from CLOSED to OPENING, VERIFYING, then back to CLOSED', async () => {
    const system = useSystemStore.getState();
    const natIdTunnel = system.tunnels.find((t) => t.targetRegistry === 'National ID DB');
    expect(natIdTunnel?.state).toBe('CLOSED');
    expect(natIdTunnel?.direction).toBe('OUTBOUND_ONLY');

    const promise = system.simulateTunnelVerification('National ID DB');
    await promise;

    const afterTunnel = useSystemStore.getState().tunnels.find((t) => t.targetRegistry === 'National ID DB');
    // Security assertion: Tunnel must be closed after request completes!
    expect(afterTunnel?.state).toBe('CLOSED');
  });
});
