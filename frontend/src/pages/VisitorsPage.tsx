import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Flame, Download, AlertTriangle, RefreshCw, UserPlus } from 'lucide-react';
import { PiiMaskedText } from '../components/common/PiiMaskedText';
import { useVisits, useVisitTransition, useDashboardSummary } from '../services/api/hooks';
import { piiTypeFromIdType, formatRelativeTime } from '../lib/utils';
import { hasPermission } from '../lib/permissions';
import { useAuthStore } from '../stores/authStore';
import type { Visit, VisitStatus } from '../types/system';

/** Visual treatment for each pass lifecycle state. */
const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  checked_in: {
    label: 'ON-SITE',
    className: 'bg-emerald-950/70 text-emerald-300 border-emerald-800',
  },
  scheduled: {
    label: 'EXPECTED',
    className: 'bg-sky-950/60 text-sky-300 border-sky-800',
  },
  checked_out: {
    label: 'CHECKED-OUT',
    className: 'bg-zinc-900/80 text-zinc-400 border-zinc-700',
  },
  cancelled: {
    label: 'CANCELLED',
    className: 'bg-zinc-900/80 text-zinc-500 border-zinc-700',
  },
  denied: {
    label: 'DENIED',
    className: 'bg-rose-950/70 text-rose-300 border-rose-800',
  },
};

export const VisitorsPage: React.FC = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);

  const user = useAuthStore((state) => state.user);
  const canCheckOut = hasPermission(user?.role, 'visitors:checkout');
  const canCheckIn = hasPermission(user?.role, 'visitors:checkin');

  // Live pass data joined with visitor identity, resolved server-side.
  // The empty string means "no filter" and is stripped by the API client.
  const visitsQuery = useVisits({ status: statusFilter as VisitStatus | '' });
  const dashboardQuery = useDashboardSummary();
  const transition = useVisitTransition();

  const visits: Visit[] = visitsQuery.data?.data ?? [];

  /**
   * The API filters on exact `status`/`q` match. The desk also needs a
   * free-text search across visitor, company and badge, so it is applied
   * client-side over the already-paginated page.
   */
  const visibleVisits = search.trim()
    ? visits.filter((v) => {
        const term = search.trim().toLowerCase();
        return (
          v.visitor_name?.toLowerCase().includes(term) ||
          v.company?.toLowerCase().includes(term) ||
          v.host_name?.toLowerCase().includes(term) ||
          v.badge_number?.toLowerCase().includes(term)
        );
      })
    : visits;

  const onSiteCount = dashboardQuery.data?.visitors_on_site ?? 0;
  const expectedToday = dashboardQuery.data?.expected_today ?? 0;
  const total = visitsQuery.data?.meta?.total ?? visits.length;

  const handleTransition = async (visit: Visit, action: 'check-in' | 'check-out') => {
    setActionError(null);
    try {
      await transition.mutateAsync({ id: visit.id, action });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Operation rejected by the API.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border">
        <div>
          <h1 className="text-xl font-bold font-mono text-foreground tracking-tight">
            VISITOR MANAGEMENT & RECEPTION DESK
          </h1>
          <p className="text-xs text-muted-foreground">
            Identity verification via Outbound Tunnels, badge printing, floor dispatch & on-site tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-mono rounded"
          >
            <Flame className="w-3.5 h-3.5" />
            Evacuation Roll-Call
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded shadow-glow-primary"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Check-In New Visitor
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search visitor, host, plate, badge..."
            className="w-full pl-9 pr-3 py-1.5 text-xs font-mono bg-card border border-border rounded-md outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end text-xs font-mono">
          <span className="text-muted-foreground">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-card border border-border rounded px-2 py-1 text-xs outline-none"
          >
            <option value="">All Visitors ({total})</option>
            <option value="checked_in">On-Site ({onSiteCount})</option>
            <option value="scheduled">Expected Today ({expectedToday})</option>
            <option value="checked_out">Checked-Out</option>
          </select>
          <button
            type="button"
            onClick={() => void visitsQuery.refetch()}
            className="p-1.5 bg-card border border-border rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title={t('common.refresh')}
          >
            <RefreshCw className={`w-4 h-4 ${visitsQuery.isFetching ? 'animate-spin' : ''}`} />
          </button>
          <button className="p-1.5 bg-card border border-border rounded hover:bg-muted text-muted-foreground hover:text-foreground">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Live pass ledger from the `visits` table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        {actionError && (
          <div className="m-3 p-2.5 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[11px]">
            <tr>
              <th className="p-3">Visitor Name</th>
              <th className="p-3">ID Document (PII Masked)</th>
              <th className="p-3">Host Employee</th>
              <th className="p-3">Destination</th>
              <th className="p-3">Badge ID</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visitsQuery.isLoading && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  {t('common.loading')}
                </td>
              </tr>
            )}

            {!visitsQuery.isLoading && visitsQuery.isError && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-rose-400">
                  <span className="inline-flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {visitsQuery.error?.message ?? 'Unable to load the visitor ledger.'}
                  </span>
                </td>
              </tr>
            )}

            {!visitsQuery.isLoading && !visitsQuery.isError && visibleVisits.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  {t('common.noData')}
                </td>
              </tr>
            )}

            {visibleVisits.map((visit) => {
              const style = STATUS_STYLES[visit.status] ?? STATUS_STYLES.cancelled;
              const zoneCount = visit.authorized_zones?.length ?? 0;

              return (
                <tr key={visit.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-sans font-medium text-foreground">
                    {visit.visitor_name}
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {visit.company || 'Independent'}
                    </div>
                  </td>
                  <td className="p-3">
                    <PiiMaskedText
                      value={visit.id_number}
                      type={piiTypeFromIdType(visit.id_type)}
                      recordId={visit.id}
                      fieldName="ID_DOCUMENT"
                    />
                  </td>
                  <td className="p-3 font-sans">
                    {visit.host_name}
                    <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[16rem]">
                      {visit.purpose}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="px-1.5 py-0.5 bg-primary/15 text-primary rounded border border-primary/30">
                      {zoneCount > 0
                        ? `${zoneCount} Authorized Zone${zoneCount > 1 ? 's' : ''}`
                        : 'Perimeter Only'}
                    </span>
                  </td>
                  <td className="p-3 text-cyan-400 font-semibold">{visit.badge_number ?? '—'}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] border ${style.className}`}
                      title={
                        visit.check_in_at
                          ? `Checked in ${formatRelativeTime(visit.check_in_at)}`
                          : `Expected ${formatRelativeTime(visit.expected_arrival)}`
                      }
                    >
                      {style.label}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    {visit.status === 'checked_in' && canCheckOut && (
                      <button
                        type="button"
                        disabled={transition.isPending}
                        onClick={() => void handleTransition(visit, 'check-out')}
                        className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 disabled:opacity-50 rounded text-foreground text-xs font-sans"
                      >
                        Check-Out
                      </button>
                    )}
                    {visit.status === 'scheduled' && canCheckIn && (
                      <button
                        type="button"
                        disabled={transition.isPending}
                        onClick={() => void handleTransition(visit, 'check-in')}
                        className="px-2.5 py-1 bg-primary hover:bg-primary/90 disabled:opacity-50 rounded text-primary-foreground text-xs font-sans"
                      >
                        Check-In
                      </button>
                    )}
                    {/* Operators lacking the permission get no control rather
                        than one the API would reject. */}
                    {!canCheckIn && !canCheckOut && (
                      <span className="text-muted-foreground text-[10px]">READ-ONLY</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
