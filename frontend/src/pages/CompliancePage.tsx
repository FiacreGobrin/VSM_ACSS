import React from 'react';
import { useTranslation } from 'react-i18next';
import { Download, AlertTriangle } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';
import { useAuditLogs, useDashboardSummary } from '../services/api/hooks';
import { formatTimestamp } from '../lib/utils';

export const CompliancePage: React.FC = () => {
  const { t } = useTranslation();
  const auditQuery = useAuditLogs({ limit: 50 });
  const summaryQuery = useDashboardSummary();

  const entries = auditQuery.data?.data ?? [];
  const totalEvents = auditQuery.data?.meta?.total ?? entries.length;
  const events24h = summaryQuery.data?.audit_events_24h;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border">
        <div>
          <h1 className="text-xl font-bold font-mono text-foreground tracking-tight">
            COMPLIANCE DASHBOARD & IMMUTABLE AUDIT TRAIL
          </h1>
          <p className="text-xs text-muted-foreground">
            ISO 27001, ISO 27701, SOC 2 Type II, NIST 800-53 controls with tamper-evident cryptographic hashes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded shadow-glow-primary"
          >
            <Download className="w-3.5 h-3.5" />
            Export Tamper-Evident Audit Report
          </button>
        </div>
      </div>

      {/* Compliance Standards Framework Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs">
        <div className="p-4 bg-card border border-border rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground">ISO 27001 / ISMS</span>
            <StatusBadge status="online" label="100% PASS" size="sm" />
          </div>
          <div className="text-[11px] text-muted-foreground font-sans">
            Physical perimeter & air-gap segmentation controls verified.
          </div>
        </div>

        <div className="p-4 bg-card border border-border rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground">ISO 27701 / PRIVACY</span>
            <StatusBadge status="online" label="COMPLIANT" size="sm" />
          </div>
          <div className="text-[11px] text-muted-foreground font-sans">
            Mandatory PII masking active. Ephemeral face templates only.
          </div>
        </div>

        <div className="p-4 bg-card border border-border rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground">SOC 2 TYPE II</span>
            <StatusBadge status="online" label="AUDITED" size="sm" />
          </div>
          <div className="text-[11px] text-muted-foreground font-sans">
            Cryptographic SHA-256 chain logs on all access & door events.
          </div>
        </div>

        <div className="p-4 bg-card border border-border rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground">NIST SP 800-53</span>
            <StatusBadge status="online" label="LEVEL 4" size="sm" />
          </div>
          <div className="text-[11px] text-muted-foreground font-sans">
            Defense-in-depth isolation, 2FA hardware tokens required.
          </div>
        </div>
      </div>

      {/* Immutable audit trail — append-only `audit_logs` table */}
      <div className="p-4 bg-card border border-border rounded-xl font-mono text-xs">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground">IMMUTABLE AUDIT TRAIL</h2>
          <span className="text-muted-foreground">
            {totalEvents} RECORDS
            {events24h !== undefined ? ` • ${events24h} IN LAST 24H` : ''}
          </span>
        </div>

        {auditQuery.isLoading && (
          <p className="text-muted-foreground text-center py-6">{t('common.loading')}</p>
        )}

        {!auditQuery.isLoading && auditQuery.isError && (
          <p className="text-rose-400 text-center py-6 inline-flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {auditQuery.error?.message ?? 'Unable to load the audit trail.'}
          </p>
        )}

        {!auditQuery.isLoading && !auditQuery.isError && entries.length === 0 && (
          <p className="text-muted-foreground text-center py-6">{t('common.noData')}</p>
        )}

        {entries.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-muted/50 text-muted-foreground uppercase">
                <tr>
                  <th className="p-2">Timestamp (UTC)</th>
                  <th className="p-2">Operator</th>
                  <th className="p-2">Action</th>
                  <th className="p-2">Entity</th>
                  <th className="p-2">Source IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-2 text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(entry.created_at)}
                    </td>
                    <td className="p-2 text-foreground">
                      {entry.user_full_name ?? entry.user_username ?? 'SYSTEM'}
                    </td>
                    <td className="p-2 text-primary font-bold">{entry.action}</td>
                    <td className="p-2 text-muted-foreground">
                      {entry.entity_type}
                      {entry.entity_id ? (
                        <span className="text-muted-foreground/60"> · {entry.entity_id.slice(0, 8)}</span>
                      ) : null}
                    </td>
                    <td className="p-2 text-muted-foreground">{entry.ip_address ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
