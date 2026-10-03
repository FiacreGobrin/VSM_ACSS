import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, ShieldAlert } from 'lucide-react';
import { cn } from '../../lib/utils';

export type StatusType = 'online' | 'offline' | 'warning' | 'critical' | 'pending';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  className,
}) => {
  const configs = {
    online: {
      icon: CheckCircle2,
      text: label || 'ONLINE',
      containerClass: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80',
      iconClass: 'text-emerald-400',
    },
    offline: {
      icon: XCircle,
      text: label || 'OFFLINE',
      containerClass: 'bg-zinc-900/80 text-zinc-400 border-zinc-700/80',
      iconClass: 'text-zinc-400',
    },
    warning: {
      icon: AlertTriangle,
      text: label || 'WARNING',
      containerClass: 'bg-amber-950/60 text-amber-300 border-amber-800/80',
      iconClass: 'text-amber-400',
    },
    critical: {
      icon: ShieldAlert,
      text: label || 'CRITICAL',
      containerClass: 'bg-rose-950/70 text-rose-300 border-rose-800/90 animate-pulse-subtle',
      iconClass: 'text-rose-400',
    },
    pending: {
      icon: Clock,
      text: label || 'PENDING',
      containerClass: 'bg-sky-950/60 text-sky-300 border-sky-800/80',
      iconClass: 'text-sky-400',
    },
  };

  const current = configs[status] || configs.offline;
  const Icon = current.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono font-medium rounded border tracking-wider uppercase select-none',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        current.containerClass,
        className
      )}
    >
      <Icon className={cn(size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5', current.iconClass)} />
      <span>{current.text}</span>
    </span>
  );
};
