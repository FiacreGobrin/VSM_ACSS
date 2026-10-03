import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users, AlertTriangle } from 'lucide-react';
import { ROLE_DISPLAY_NAMES } from '../lib/permissions';
import { useUserRegistry } from '../services/api/hooks';
import { toConsoleRole, type UserRegistryRecord } from '../types/auth';
import { formatRelativeTime } from '../lib/utils';

/** Visual treatment for each clearance tier. */
const CLEARANCE_STYLES: Record<string, string> = {
  TOP_SECRET: 'bg-rose-950/60 text-rose-300 border-rose-800',
  RESTRICTED: 'bg-amber-950/60 text-amber-300 border-amber-800',
  STANDARD: 'bg-secondary text-foreground border-border',
  VISITOR: 'bg-sky-950/60 text-sky-300 border-sky-800',
};

export const AdminPage: React.FC = () => {
  const { t } = useTranslation();
  const registryQuery = useUserRegistry();

  const operators: UserRegistryRecord[] = registryQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border">
        <div>
          <h1 className="text-xl font-bold font-mono text-foreground tracking-tight">
            SYSTEM ADMINISTRATION & RBAC REGISTRY
          </h1>
          <p className="text-xs text-muted-foreground">
            Role-Based Access Control, Tenant White-Label Customization, Retention & Device Policies
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded bg-secondary font-mono text-xs text-foreground">
            AIR-GAP SCHEMA v2.4
          </span>
        </div>
      </div>

      {/* User & Role Management Table */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold font-mono text-foreground uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Configured Operator Roles & Clearance Matrix
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[11px]">
              <tr>
                <th className="p-3">User & Title</th>
                <th className="p-3">Role Code</th>
                <th className="p-3">Department</th>
                <th className="p-3">Clearance Tier</th>
                <th className="p-3">Badge Number</th>
                <th className="p-3">MFA Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {registryQuery.isLoading && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    {t('common.loading')}
                  </td>
                </tr>
              )}

              {!registryQuery.isLoading && registryQuery.isError && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-rose-400">
                    <span className="inline-flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      {registryQuery.error?.message ?? 'Unable to load the operator registry.'}
                    </span>
                  </td>
                </tr>
              )}

              {!registryQuery.isLoading && !registryQuery.isError && operators.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    {t('common.noData')}
                  </td>
                </tr>
              )}

              {operators.map((user) => (
                <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3 font-sans font-semibold text-foreground">
                    {user.fullName}
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {user.username}
                    </div>
                  </td>
                  <td className="p-3 text-primary font-bold">
                    {ROLE_DISPLAY_NAMES[toConsoleRole(user.role)]}
                  </td>
                  <td className="p-3 font-sans text-muted-foreground">
                    {user.department || 'Unassigned'}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] border font-bold ${
                        CLEARANCE_STYLES[user.clearanceLevel] ?? CLEARANCE_STYLES.STANDARD
                      }`}
                    >
                      {user.clearanceLevel}
                    </span>
                  </td>
                  <td className="p-3 text-foreground font-mono">
                    {user.badgeNumber ?? 'UNASSIGNED'}
                  </td>
                  <td className="p-3">
                    {user.mfaVerified ? (
                      <span className="text-emerald-400 font-bold">HARDWARE TOTP ENFORCED</span>
                    ) : (
                      <span className="text-amber-400 font-bold">MFA NOT ENROLLED</span>
                    )}
                    <div className="text-[10px] text-muted-foreground font-mono">
                      Last login: {formatRelativeTime(user.lastLoginAt)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
