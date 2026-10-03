import React from 'react';
import { Lock, ArrowUpRight, Activity } from 'lucide-react';
import { TunnelState } from '../../types/system';
import { cn } from '../../lib/utils';

interface TunnelStateBadgeProps {
  state: TunnelState;
  registryName?: string;
  className?: string;
}

export const TunnelStateBadge: React.FC<TunnelStateBadgeProps> = ({
  state,
  registryName,
  className,
}) => {
  const stateConfigs = {
    CLOSED: {
      label: 'CLOSED (OUTBOUND-ONLY)',
      icon: Lock,
      containerClass: 'bg-slate-900/90 text-slate-400 border-slate-700/80',
      iconClass: 'text-slate-400',
      desc: 'Secure Air-Gap Shield Active. Inbound access strictly impossible.',
    },
    OPENING: {
      label: 'OPENING OUTBOUND TUNNEL',
      icon: ArrowUpRight,
      containerClass: 'bg-amber-950/80 text-amber-300 border-amber-600/80 animate-pulse',
      iconClass: 'text-amber-400 animate-spin',
      desc: 'Handshaking ephemeral TLS tunnel to external registry...',
    },
    VERIFYING: {
      label: 'VERIFYING REGISTRY PAYLOAD',
      icon: Activity,
      containerClass: 'bg-cyan-950/80 text-cyan-300 border-cyan-600/90 shadow-glow-primary',
      iconClass: 'text-cyan-400 animate-pulse',
      desc: 'Query dispatched. Awaiting cryptographic proof signature...',
    },
  };

  const current = stateConfigs[state];
  const Icon = current.icon;

  return (
    <div
      title={current.desc}
      className={cn(
        'inline-flex items-center gap-2 px-2.5 py-1 rounded-md border font-mono text-xs font-semibold select-none transition-all',
        current.containerClass,
        className
      )}
    >
      <Icon className={cn('w-3.5 h-3.5', current.iconClass)} />
      <div className="flex flex-col text-left">
        {registryName && (
          <span className="text-[10px] text-muted-foreground uppercase leading-tight">
            {registryName}
          </span>
        )}
        <span className="tracking-wider">{current.label}</span>
      </div>
    </div>
  );
};
