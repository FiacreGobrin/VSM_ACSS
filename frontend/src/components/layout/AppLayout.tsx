import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Breadcrumbs } from './Breadcrumbs';
import { IdleWarningModal } from '../auth/IdleWarningModal';
import { useAuthStore } from '../../stores/authStore';
import { AlertOctagon, HelpCircle, X, Terminal } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { isEmergencyLockdownActive, lockdownMetadata } = useAuthStore();
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);

  // Global hotkey listener ('?' for shortcuts)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        setIsShortcutModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Header />

      {/* Emergency Facility Lockdown Banner */}
      {isEmergencyLockdownActive && (
        <div className="w-full bg-rose-600 text-white font-mono text-xs px-4 py-2 flex items-center justify-between shadow-lg animate-pulse z-40">
          <div className="flex items-center gap-3">
            <AlertOctagon className="w-5 h-5 shrink-0 animate-bounce" />
            <div>
              <span className="font-bold tracking-wider uppercase">
                EMERGENCY SITE LOCKDOWN ACTIVE:
              </span>{' '}
              {lockdownMetadata?.reason || 'Critical security containment macro triggered'}
              <span className="opacity-80 ml-2">
                (Initiated by {lockdownMetadata?.initiatedBy})
              </span>
            </div>
          </div>
          <span className="font-bold tracking-widest uppercase bg-black/40 px-2 py-0.5 rounded">
            LEVEL 1 PROTOCOL
          </span>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 flex flex-col overflow-y-auto bg-grid-tactical">
          <div className="px-6 pt-3 pb-1 border-b border-border/50 bg-background/40 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <Breadcrumbs />
              <button
                type="button"
                onClick={() => setIsShortcutModalOpen(true)}
                className="hidden md:inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-mono transition-colors"
                title="Keyboard Shortcuts (?)"
              >
                <HelpCircle className="w-3.5 h-3.5 text-primary" />
                <span>Shortcuts: Press '?'</span>
              </button>
            </div>
          </div>

          <div className="flex-1 p-6">
            <Outlet />
          </div>
        </main>
      </div>

      <IdleWarningModal />

      {/* Shortcuts Helper Modal */}
      {isShortcutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-6 relative">
            <button
              onClick={() => setIsShortcutModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-4">
              <Terminal className="w-5 h-5 text-primary" />
              <h3 className="font-mono text-base font-bold text-foreground">
                Air-Gapped Console Hotkeys
              </h3>
            </div>
            <div className="divide-y divide-border border border-border rounded-lg bg-background text-xs font-mono">
              <div className="p-2.5 flex justify-between">
                <span className="text-muted-foreground">Emergency Lockdown Toggle</span>
                <span className="px-1.5 py-0.5 bg-muted rounded text-foreground font-bold">
                  Ctrl + Alt + L
                </span>
              </div>
              <div className="p-2.5 flex justify-between">
                <span className="text-muted-foreground">Camera Wall Quick-Grid 4x4</span>
                <span className="px-1.5 py-0.5 bg-muted rounded text-foreground font-bold">
                  Ctrl + 4
                </span>
              </div>
              <div className="p-2.5 flex justify-between">
                <span className="text-muted-foreground">Acknowledge Top Alert</span>
                <span className="px-1.5 py-0.5 bg-muted rounded text-foreground font-bold">
                  Space
                </span>
              </div>
              <div className="p-2.5 flex justify-between">
                <span className="text-muted-foreground">Open Kiosk Fullscreen</span>
                <span className="px-1.5 py-0.5 bg-muted rounded text-foreground font-bold">F11</span>
              </div>
              <div className="p-2.5 flex justify-between">
                <span className="text-muted-foreground">Help / Shortcuts Menu</span>
                <span className="px-1.5 py-0.5 bg-muted rounded text-foreground font-bold">?</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
