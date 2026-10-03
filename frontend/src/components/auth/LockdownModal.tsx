import React, { useState } from 'react';
import { ShieldAlert, AlertOctagon, Lock, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

interface LockdownModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LockdownModal: React.FC<LockdownModalProps> = ({ isOpen, onClose }) => {
  const { isEmergencyLockdownActive, triggerEmergencyLockdown, cancelEmergencyLockdown } =
    useAuthStore();
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTrigger = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A critical operational justification reason is mandatory for site-wide lockdown.');
      return;
    }
    if (pin !== '9911') {
      setError('Emergency Command PIN invalid. [Demo PIN: 9911]');
      return;
    }

    triggerEmergencyLockdown(reason);
    setReason('');
    setPin('');
    setError(null);
    onClose();
  };

  const handleRelease = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin !== '9911') {
      setError('Emergency Release PIN invalid. [Demo PIN: 9911]');
      return;
    }

    cancelEmergencyLockdown();
    setPin('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-xl bg-card border-2 border-rose-600 rounded-xl shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-rose-950/80 text-rose-500 rounded-lg border border-rose-600 shadow-glow-destructive">
            <AlertOctagon className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-rose-400 font-mono tracking-wide">
              {isEmergencyLockdownActive
                ? 'EMERGENCY LOCKDOWN IN PROGRESS'
                : 'INITIATE FACILITY-WIDE LOCKDOWN'}
            </h3>
            <p className="text-xs text-muted-foreground">
              Air-Gapped Macro: Turnstiles Interlocked • Gates Bolted • Otis Recall Active
            </p>
          </div>
        </div>

        {isEmergencyLockdownActive ? (
          <form onSubmit={handleRelease} className="space-y-4">
            <div className="p-4 bg-rose-950/30 border border-rose-800 rounded-lg text-xs space-y-2">
              <div className="font-semibold text-rose-300">
                ACTIVE SECURITY STATUS: LEVEL 1 CONTAINMENT
              </div>
              <p className="text-muted-foreground">
                All 100 perimeter turnstiles and blast doors are locked. ANPR barriers will refuse all
                traffic. Otis Compass elevator cars are restricted to Ground Evacuation.
              </p>
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-foreground mb-1">
                AUTHORIZATION COMMAND PIN TO RELEASE LOCKDOWN
              </label>
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError(null);
                }}
                placeholder="Enter PIN (9911)"
                className="w-full font-mono py-2 px-3 bg-background border border-input rounded-md text-sm outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {error && <p className="text-xs text-rose-400 font-mono">{error}</p>}

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Keep Active
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold rounded-md shadow-md transition-colors"
              >
                <Lock className="w-4 h-4" />
                Disengage Lockdown & Restore Normal Ops
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleTrigger} className="space-y-4">
            <div className="p-4 bg-card border border-border rounded-lg text-xs space-y-1">
              <p className="text-foreground font-semibold">Immediate Automated Execution Actions:</p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                <li>Locks 100 Hikvision door controllers and turnstiles (VLAN 20)</li>
                <li>Lowers ANPR bollards and seals perimeter security gates</li>
                <li>Recalls Otis Compass elevator cars to lobby level (VLAN 30)</li>
                <li>Broadcasts encrypted silent radio alarm to on-duty rapid response units</li>
              </ul>
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-foreground mb-1">
                INCIDENT JUSTIFICATION / AUDIT REASON <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={2}
                required
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. Critical watchlist breach detected at Gate 3; unauthorized perimeter incursion"
                className="w-full text-xs p-2.5 bg-background border border-input rounded-md outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-foreground mb-1">
                SECURITY COMMAND 4-DIGIT PIN <span className="text-rose-400">*</span>
              </label>
              <input
                type="password"
                maxLength={4}
                required
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError(null);
                }}
                placeholder="Enter PIN (9911 for demo)"
                className="w-full font-mono py-2 px-3 bg-background border border-input rounded-md text-sm outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {error && <p className="text-xs text-rose-400 font-mono">{error}</p>}

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Abort
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold rounded-md shadow-glow-destructive transition-all"
              >
                <ShieldAlert className="w-4 h-4" />
                EXECUTE IMMEDIATE FACILITY LOCKDOWN
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
