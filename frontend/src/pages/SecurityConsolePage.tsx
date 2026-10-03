import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldAlert,
  Video,
  DoorClosed,
  Users,
  Layers,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';
import { TunnelStateBadge } from '../components/common/TunnelStateBadge';
import { RecordingUploadPanel } from '../components/recordings/RecordingUploadPanel';
import { RecordingLibrary } from '../components/recordings/RecordingLibrary';
import { useSystemStore } from '../stores/systemStore';
import { useAuthStore } from '../stores/authStore';
import { hasPermission } from '../lib/permissions';
import { useDashboardSummary, useAlerts, useAcknowledgeAlert } from '../services/api/hooks';
import { formatRelativeTime } from '../lib/utils';
import type { AlertSeverity } from '../types/system';

/** Colour ramp for alert severity, matching the SOC's escalation semantics. */
const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  critical: 'bg-rose-950/70 text-rose-300 border-rose-800',
  high: 'bg-orange-950/70 text-orange-300 border-orange-800',
  medium: 'bg-amber-950/60 text-amber-300 border-amber-800',
  low: 'bg-sky-950/60 text-sky-300 border-sky-800',
};

export const SecurityConsolePage: React.FC = () => {
  const { t } = useTranslation();
  const { tunnels, vlans } = useSystemStore();
  const user = useAuthStore((state) => state.user);
  const canAcknowledge = hasPermission(user?.role, 'alerts:acknowledge');

  // Counters resolved in a single aggregate query against Postgres.
  const summaryQuery = useDashboardSummary();
  const alertsQuery = useAlerts({ isAcknowledged: false, limit: 5 });
  const acknowledge = useAcknowledgeAlert();

  const summary = summaryQuery.data;

  // Until the first payload lands, show an em dash rather than a fabricated 0,
  // so operators can tell "no data" apart from "genuinely none".
  const pending = summaryQuery.isLoading;
  const onSite = pending ? '—' : (summary?.visitors_on_site ?? 0);
  const expectedToday = summary?.expected_today ?? 0;
  const activeAlerts = pending ? '—' : (summary?.alerts_active ?? 0);
  const criticalAlerts = summary?.alerts_critical ?? 0;
  const camerasOnline = pending ? '—' : (summary?.cameras_online ?? 0);
  const camerasTotal = summary?.cameras_total ?? 0;

  const activeAlertRows = alertsQuery.data?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Top Banner / Status Overview */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold font-mono text-foreground tracking-tight">
              SECURITY OPERATIONS COMMAND (SOC)
            </h1>
            <StatusBadge status="online" label="ACTIVE AIR-GAP" size="sm" />
          </div>
          <p className="text-xs text-muted-foreground">
            Critical Infrastructure Unified Surveillance & Access Interlock Enclave
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tunnels.map((tun) => (
            <TunnelStateBadge
              key={tun.id}
              state={tun.state}
              registryName={tun.targetRegistry}
            />
          ))}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Visitors On-Site */}
        <div className="p-4 bg-card border border-border rounded-xl shadow-sm hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-mono font-medium uppercase">
              {t('security.visitorsOnSite')}
            </span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-foreground">{onSite}</span>
            <span className="text-xs text-emerald-400 font-mono">+{expectedToday} expected</span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            {pending ? 'Resolving live occupancy…' : 'Clearance verified via Outbound Tunnel'}
          </div>
        </div>

        {/* Active Alerts */}
        <div className="p-4 bg-card border border-border rounded-xl shadow-sm hover:border-rose-500/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-mono font-medium uppercase">
              {t('security.activeAlerts')}
            </span>
            <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-rose-400">{activeAlerts}</span>
            <span className="text-xs text-rose-400 font-mono">
              {criticalAlerts} CRITICAL
            </span>
          </div>
          <div className="mt-2 text-[11px] text-rose-400/90 font-medium">
            Requires Operator Acknowledgment
          </div>
        </div>

        {/* Monitored Security Zones */}
        <div className="p-4 bg-card border border-border rounded-xl shadow-sm hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-mono font-medium uppercase">Monitored Zones</span>
            <DoorClosed className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-foreground">
              {pending ? '—' : (summary?.zones_total ?? 0)}
            </span>
            <span className="text-xs text-muted-foreground font-mono">ZONES</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-400 font-mono">
            {pending ? 'Resolving…' : 'Clearance tiers 1-5 enforced'}
          </div>
        </div>

        {/* Cameras Online */}
        <div className="p-4 bg-card border border-border rounded-xl shadow-sm hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-mono font-medium uppercase">
              {t('security.camerasOnline')}
            </span>
            <Video className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-foreground">
              {camerasOnline} / {camerasTotal}
            </span>
            <span className="text-xs text-muted-foreground font-mono">VLAN 10</span>
          </div>
          <div className="mt-2 text-[11px] text-cyan-400 font-mono">
            {pending
              ? 'Resolving fleet health…'
              : `${summary?.cameras_offline ?? 0} offline • AI edge analytics enabled`}
          </div>
        </div>
      </div>

      {/* Unacknowledged Alert Feed — sourced from `security_alerts` */}
      <div className="p-4 bg-card border border-border rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-foreground">
              Unacknowledged Security Alerts
            </h2>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {activeAlerts} ACTIVE
          </span>
        </div>

        {alertsQuery.isLoading && (
          <p className="text-xs text-muted-foreground py-4 text-center">Loading alert feed…</p>
        )}

        {!alertsQuery.isLoading && alertsQuery.isError && (
          <p className="text-xs text-rose-400 py-4 text-center">
            {alertsQuery.error?.message ?? 'Unable to load the alert feed.'}
          </p>
        )}

        {!alertsQuery.isLoading && !alertsQuery.isError && activeAlertRows.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No unacknowledged alerts. Perimeter nominal.
          </p>
        )}

        <div className="space-y-2">
          {activeAlertRows.map((alert) => (
            <div
              key={alert.id}
              className="p-3 bg-background border border-border rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] border font-bold uppercase ${
                      SEVERITY_STYLES[alert.severity]
                    }`}
                  >
                    {alert.severity}
                  </span>
                  <span className="text-xs font-semibold text-foreground truncate">{alert.title}</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-sans mt-1 line-clamp-2">
                  {alert.description}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono mt-1">
                  {alert.camera_name}
                  {alert.zone_name ? ` • ${alert.zone_name}` : ''} •{' '}
                  {formatRelativeTime(alert.created_at)}
                </p>
              </div>

              {canAcknowledge && (
                <button
                  type="button"
                  disabled={acknowledge.isPending}
                  onClick={() => void acknowledge.mutateAsync(alert.id)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-semibold rounded self-start md:self-auto shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  Acknowledge
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Evidence Library — upload + retained clips (renders only for roles with
          `recordings:*` clearance) */}
      <div className="space-y-4">
        <RecordingUploadPanel />
        <RecordingLibrary />
      </div>

      {/* Containment Macro Status Overview (High Priority) */}
      <div className="p-4 bg-card border-l-4 border-l-rose-500 border-border rounded-xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase text-rose-400 tracking-wider">
                {t('security.containmentMacro')}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-950/60 text-rose-300 border border-rose-800">
                STANDBY / ARMED
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('security.macroDescription')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right text-[11px] font-mono text-muted-foreground hidden sm:block">
              Override Requires: <span className="text-foreground">2FA PIN + Reason</span>
            </div>
            <button
              type="button"
              className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-mono font-semibold rounded border border-border transition-colors"
            >
              Inspect Automated Rules
            </button>
          </div>
        </div>
      </div>

      {/* VLAN Architecture Telemetry Grid */}
      <div className="p-4 bg-card border border-border rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-foreground">
              Hardware VLAN Infrastructure Matrix
            </h2>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            Cisco Nexus Core • FortiGate High-Availability Pair
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {vlans.map((v) => (
            <div
              key={v.vlan}
              className="p-3 bg-background border border-border rounded-lg font-mono text-xs space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">{v.name}</span>
                <span className="text-[10px] text-emerald-400">
                  {v.onlineCount}/{v.deviceCount} UP
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground font-sans line-clamp-1">
                {v.description}
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/60">
                <span className="text-muted-foreground">{v.subnet}</span>
                <span className="text-foreground font-semibold">{v.bandwidthMbps} Mbps</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
