import React from 'react';
import { Cpu, Database, HardDrive, Network } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';
import { useHealth } from '../services/api/hooks';

export const SystemHealthPage: React.FC = () => {
  // Live liveness probe; includes the Neon round-trip latency measured server-side.
  const healthQuery = useHealth();

  const health = healthQuery.data;
  const dbOnline = health?.status === 'ok';
  const dbLatency = health?.database?.latency;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border">
        <div>
          <h1 className="text-xl font-bold font-mono text-foreground tracking-tight">
            INFRASTRUCTURE & SYSTEM HEALTH TELEMETRY
          </h1>
          <p className="text-xs text-muted-foreground">
            Dell AI Cluster (12 GPUs), PostgreSQL HA pair, 1.1 PB SAN Storage & FortiGate HA
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status="online" label="HARDWARE NORMAL" />
        </div>
      </div>

      {/* Hardware Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
        {/* Dell AI Cluster */}
        <div className="p-4 bg-card border border-border rounded-xl space-y-3">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-bold text-foreground">DELL AI CLUSTER</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">3 Nodes / 12 GPUs</div>
          <div className="space-y-1 text-muted-foreground text-[11px]">
            <div className="flex justify-between">
              <span>Avg GPU Load:</span>
              <span className="text-cyan-400 font-bold">68%</span>
            </div>
            <div className="flex justify-between">
              <span>Inference Latency:</span>
              <span className="text-emerald-400 font-bold">142 ms (Target: &lt;200ms)</span>
            </div>
            <div className="flex justify-between">
              <span>Avg Temp:</span>
              <span className="text-foreground">58°C</span>
            </div>
          </div>
        </div>

        {/* Neon PostgreSQL — live connection state */}
        <div className="p-4 bg-card border border-border rounded-xl space-y-3">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-bold text-foreground">
              {health?.database?.provider?.toUpperCase() ?? 'POSTGRESQL'}
            </span>
            <Database className="w-4 h-4 text-purple-400" />
          </div>
          <div className={`text-2xl font-bold ${dbOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
            {healthQuery.isLoading
              ? 'PROBING…'
              : dbOnline
                ? 'CONNECTED'
                : healthQuery.isError
                  ? 'UNREACHABLE'
                  : 'DEGRADED'}
          </div>
          <div className="space-y-1 text-muted-foreground text-[11px]">
            <div className="flex justify-between">
              <span>Round-Trip Latency:</span>
              <span className="text-emerald-400 font-bold">
                {dbLatency ?? (healthQuery.isLoading ? '—' : 'n/a')}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Database:</span>
              <span className="text-foreground">{health?.database?.database ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>API Uptime:</span>
              <span className="text-foreground">
                {health ? `${Math.floor(health.uptimeSeconds / 60)} min` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* 1.1 PB SAN Storage */}
        <div className="p-4 bg-card border border-border rounded-xl space-y-3">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-bold text-foreground">1.1 PB SAN FABRIC</span>
            <HardDrive className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">742 TB Used (67%)</div>
          <div className="space-y-1 text-muted-foreground text-[11px]">
            <div className="flex justify-between">
              <span>Usable Capacity:</span>
              <span className="text-foreground font-bold">1,100 TB</span>
            </div>
            <div className="flex justify-between">
              <span>Retention Remaining:</span>
              <span className="text-emerald-400 font-bold">34 Days (30-day policy)</span>
            </div>
            <div className="flex justify-between">
              <span>IOPS:</span>
              <span className="text-foreground">18,400 IOPS</span>
            </div>
          </div>
        </div>

        {/* Network & FortiGate HA */}
        <div className="p-4 bg-card border border-border rounded-xl space-y-3">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-bold text-foreground">FORTIGATE HA & CORE</span>
            <Network className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">4.0 Gbps Ingest</div>
          <div className="space-y-1 text-muted-foreground text-[11px]">
            <div className="flex justify-between">
              <span>FortiGate Mode:</span>
              <span className="text-emerald-400 font-bold">A-P Synchronized</span>
            </div>
            <div className="flex justify-between">
              <span>Cisco Switch Core:</span>
              <span className="text-foreground">Nexus 9300 (0 Drops)</span>
            </div>
            <div className="flex justify-between">
              <span>Outbound Tunnels:</span>
              <span className="text-emerald-400 font-bold">Air-Gapped Proxy OK</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
