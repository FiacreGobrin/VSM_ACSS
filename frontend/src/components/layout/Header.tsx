import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Shield,
  Radio,
  Lock,
  Sun,
  Moon,
  LogOut,
  Users,
  AlertOctagon,
  Languages,
  ChevronDown,
  Monitor,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useSystemStore } from '../../stores/systemStore';
import { useThemeStore } from '../../stores/themeStore';
import { UserRole } from '../../types/auth';
import { ROLE_DISPLAY_NAMES } from '../../lib/permissions';
import { TunnelStateBadge } from '../common/TunnelStateBadge';
import { SessionModal } from '../auth/SessionModal';
import { LockdownModal } from '../auth/LockdownModal';
import { useHealth } from '../../services/api/hooks';

export const Header: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, switchRole, logout, isEmergencyLockdownActive } = useAuthStore();
  const { connection, tunnels, simulateTunnelVerification } = useSystemStore();
  const { isDarkMode, toggleDarkMode, tenantConfig } = useThemeStore();

  // Live API + database reachability, polled on the health endpoint.
  const healthQuery = useHealth();
  const isApiOnline = healthQuery.data?.status === 'ok';

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isTunnelPopoverOpen, setIsTunnelPopoverOpen] = useState(false);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isLockdownModalOpen, setIsLockdownModalOpen] = useState(false);

  // Live LAN Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('vms_acs_lang', lang);
    setIsLangMenuOpen(false);
  };

  const activeTunnel = tunnels.find((t) => t.state !== 'CLOSED') || tunnels[0];

  return (
    <>
      <header className="sticky top-0 z-40 w-full h-14 bg-card/95 backdrop-blur border-b border-border flex items-center justify-between px-4 text-xs font-mono select-none">
        {/* Left: Branding & High-Security Indicators */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold tracking-wider text-foreground">
            <div className="p-1.5 bg-primary/20 text-primary border border-primary/40 rounded">
              <Shield className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-sm tracking-tight text-foreground font-extrabold">
                {tenantConfig.tenantName.split('•')[0]}
              </span>
              <span className="text-[10px] text-muted-foreground font-sans tracking-wide">
                VMS-ACS Enterprise Air-Gap
              </span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-border">
            {/* API / database reachability, resolved from the live health probe */}
            <span
              title={
                isApiOnline
                  ? `API and database reachable${healthQuery.data?.database?.latency ? ` — ${healthQuery.data.database.latency}` : ''}`
                  : 'API or database unreachable'
              }
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold tracking-widest uppercase ${
                isApiOnline
                  ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/70 border-rose-800 text-rose-300'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isApiOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              ></span>
              {isApiOnline ? t('common.airgappedLan') : 'LINK DOWN'}
            </span>

            {/* Outbound Tunnel Trigger Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsTunnelPopoverOpen(!isTunnelPopoverOpen)}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-card hover:bg-muted/80 border border-border text-foreground text-[10px] transition-colors"
                title="Click to inspect Outbound-Only Registry Tunnels"
              >
                <Lock className="w-3 h-3 text-slate-400" />
                <span className="text-muted-foreground">OUTBOUND TUNNEL:</span>
                <span
                  className={
                    activeTunnel.state === 'CLOSED'
                      ? 'text-slate-400'
                      : activeTunnel.state === 'OPENING'
                      ? 'text-amber-400'
                      : 'text-cyan-400 animate-pulse'
                  }
                >
                  {activeTunnel.state}
                </span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>

              {/* Tunnel Popover */}
              {isTunnelPopoverOpen && (
                <div className="absolute left-0 mt-2 w-80 bg-card border border-border shadow-2xl rounded-lg p-3 z-50 animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-border mb-2">
                    <span className="font-semibold text-foreground text-xs">
                      Outbound-Only Tunnel Registry
                    </span>
                    <span className="text-[10px] text-emerald-400 uppercase font-mono">
                      Strict Egress
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-3 font-sans">
                    Verification queries outbound only. No inbound route exists.
                  </p>

                  <div className="space-y-2">
                    {tunnels.map((tun) => (
                      <div
                        key={tun.id}
                        className="p-2 rounded bg-background border border-border flex items-center justify-between"
                      >
                        <TunnelStateBadge state={tun.state} registryName={tun.targetRegistry} />
                        <button
                          type="button"
                          onClick={() => simulateTunnelVerification(tun.targetRegistry)}
                          className="px-2 py-1 text-[10px] bg-secondary hover:bg-secondary/80 text-foreground rounded font-sans"
                        >
                          Ping Verify
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center: Live UTC / LAN Clock & Connection Heartbeat */}
        <div className="hidden xl:flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 px-2.5 py-1 bg-background/80 border border-border rounded">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-muted-foreground">LAN CLOCK:</span>
            <span className="text-foreground font-semibold">
              {currentTime.toISOString().replace('T', ' ').slice(0, 19)} UTC
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                connection.wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="text-[11px] text-muted-foreground">
              WS: {connection.wsConnected ? 'CONNECTED (4ms)' : 'RECONNECTING'}
            </span>
          </div>
        </div>

        {/* Right: Emergency Lockdown, Role Switcher, Language, Theme, User Profile */}
        <div className="flex items-center gap-2">
          {/* Emergency Facility Lockdown Button */}
          <button
            type="button"
            onClick={() => setIsLockdownModalOpen(true)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold tracking-wider transition-all ${
              isEmergencyLockdownActive
                ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse shadow-glow-destructive'
                : 'bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300'
            }`}
            title="Global Facility Containment: Lock Turnstiles, Gates & Elevators"
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {isEmergencyLockdownActive ? t('common.lockdownActive') : t('common.lockdown')}
            </span>
          </button>

          {/* Quick Role Switcher (Operator & Demo convenience) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs"
              title="Simulate Role / Clearance Level"
            >
              <Users className="w-3.5 h-3.5 text-primary" />
              <span className="hidden md:inline font-sans text-xs">
                {user ? ROLE_DISPLAY_NAMES[user.role].split(' ')[0] : 'Role'}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {isRoleMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-card border border-border shadow-2xl rounded-lg py-1 z-50 font-sans">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground border-b border-border uppercase font-mono">
                  Switch Active Role (RBAC Demo)
                </div>
                {(
                  [
                    'super_admin',
                    'security_officer',
                    'receptionist',
                    'host_employee',
                    'client_admin',
                    'auditor',
                  ] as UserRole[]
                ).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      switchRole(r);
                      setIsRoleMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-muted/80 transition-colors ${
                      user?.role === r ? 'text-primary font-semibold bg-primary/10' : 'text-foreground'
                    }`}
                  >
                    <span>{ROLE_DISPLAY_NAMES[r]}</span>
                    {user?.role === r && <span className="text-[10px] font-mono">ACTIVE</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Language Switcher */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Change Language (English / Kinyarwanda / Français)"
            >
              <Languages className="w-4 h-4" />
            </button>

            {isLangMenuOpen && (
              <div className="absolute right-0 mt-2 w-36 bg-card border border-border shadow-2xl rounded-lg py-1 z-50 font-sans">
                <button
                  type="button"
                  onClick={() => changeLanguage('en')}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted ${
                    i18n.language === 'en' ? 'text-primary font-bold' : 'text-foreground'
                  }`}
                >
                  English (EN)
                </button>
                <button
                  type="button"
                  onClick={() => changeLanguage('rw')}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted ${
                    i18n.language === 'rw' ? 'text-primary font-bold' : 'text-foreground'
                  }`}
                >
                  Kinyarwanda (RW)
                </button>
                <button
                  type="button"
                  onClick={() => changeLanguage('fr')}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted ${
                    i18n.language === 'fr' ? 'text-primary font-bold' : 'text-foreground'
                  }`}
                >
                  Français (FR)
                </button>
              </div>
            )}
          </div>

          {/* Dark / Light Mode Toggle */}
          <button
            type="button"
            onClick={toggleDarkMode}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title={isDarkMode ? 'Switch to Light Theme' : 'Switch to High-Contrast Dark Theme'}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* Sessions Viewer Trigger */}
          <button
            type="button"
            onClick={() => setIsSessionModalOpen(true)}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            title="Inspect Terminal Sessions"
          >
            <Monitor className="w-4 h-4" />
          </button>

          {/* User Profile Pill & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-border">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-foreground text-xs font-semibold leading-tight font-sans">
                {user?.fullName || 'Operator'}
              </span>
              <span className="text-[10px] text-amber-400 font-mono">
                {user?.clearanceLevel || 'RESTRICTED'}
              </span>
            </div>

            <button
              type="button"
              onClick={logout}
              className="p-1.5 rounded hover:bg-rose-950/60 text-muted-foreground hover:text-rose-400 transition-colors"
              title={t('common.logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Modals */}
      <SessionModal isOpen={isSessionModalOpen} onClose={() => setIsSessionModalOpen(false)} />
      <LockdownModal isOpen={isLockdownModalOpen} onClose={() => setIsLockdownModalOpen(false)} />
    </>
  );
};
