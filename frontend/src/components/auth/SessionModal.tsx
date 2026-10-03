import React from 'react';
import { Monitor, X, ShieldX, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { formatTimestamp } from '../../lib/utils';

interface SessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SessionModal: React.FC<SessionModalProps> = ({ isOpen, onClose }) => {
  const { sessions, revokeSession } = useAuthStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-secondary text-primary rounded-lg">
            <Monitor className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground font-mono">
              Active LAN Terminal Sessions
            </h3>
            <p className="text-xs text-muted-foreground">
              Air-Gapped Session Registry • Zero External Tokens Allowed
            </p>
          </div>
        </div>

        <div className="divide-y divide-border border border-border rounded-lg overflow-hidden bg-background mb-6">
          {sessions.map((sess) => (
            <div
              key={sess.id}
              className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded bg-card border border-border text-foreground shrink-0 mt-0.5">
                  <Monitor className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {sess.terminalName}
                    </span>
                    {sess.isCurrent ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                        CURRENT CONSOLE
                      </span>
                    ) : null}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground mt-0.5">
                    IP: <span className="text-foreground">{sess.ipAddress}</span> • {sess.vlan}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Authenticated: {formatTimestamp(sess.startedAt)}
                  </div>
                </div>
              </div>

              {!sess.isCurrent && (
                <button
                  type="button"
                  onClick={() => revokeSession(sess.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800 text-xs font-medium rounded transition-colors self-start md:self-auto"
                >
                  <ShieldX className="w-3.5 h-3.5" />
                  Terminate Session
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium rounded-md transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
