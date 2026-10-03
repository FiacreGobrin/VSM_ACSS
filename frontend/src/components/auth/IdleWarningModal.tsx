import React, { useEffect } from 'react';
import { Clock, LogOut, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export const IdleWarningModal: React.FC = () => {
  const { isIdleWarningOpen, secondsRemaining, resetActivityTimer, logout, tickTimer } =
    useAuthStore();

  // Tick the timer once every second
  useEffect(() => {
    const interval = setInterval(() => {
      tickTimer();
    }, 1000);

    const onUserActivity = () => {
      // If warning modal is not open yet, any interaction resets the timer
      if (!useAuthStore.getState().isIdleWarningOpen) {
        useAuthStore.getState().resetActivityTimer();
      }
    };

    window.addEventListener('mousemove', onUserActivity);
    window.addEventListener('keydown', onUserActivity);
    window.addEventListener('click', onUserActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', onUserActivity);
      window.removeEventListener('keydown', onUserActivity);
      window.removeEventListener('click', onUserActivity);
    };
  }, [tickTimer]);

  if (!isIdleWarningOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-card border-2 border-amber-500 rounded-xl shadow-2xl p-6 relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-amber-950/80 text-amber-400 rounded-lg border border-amber-600/80">
            <Clock className="w-6 h-6 animate-spin" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground font-mono">
              SESSION INACTIVITY WARNING
            </h3>
            <p className="text-xs text-muted-foreground">Air-Gapped Facility Security Policy</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          Due to high-security compliance regulations, this terminal will automatically terminate
          your session and lock all controls in:
        </p>

        <div className="text-center py-4 bg-background border border-border rounded-lg mb-6">
          <span className="text-4xl font-bold font-mono text-amber-400">
            {secondsRemaining}s
          </span>
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest mt-1">
            Seconds until automatic lockout
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Lock Console Now
          </button>
          <button
            type="button"
            onClick={resetActivityTimer}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md shadow-glow-primary transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            I'm Still Working (Extend)
          </button>
        </div>
      </div>
    </div>
  );
};
