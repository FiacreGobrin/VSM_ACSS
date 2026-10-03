import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  Lock,
  User,
  KeyRound,
  AlertTriangle,
  Server,
  Zap,
  GlobeLock,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { UserRole } from '../types/auth';
import { MfaModal } from '../components/auth/MfaModal';
import { keycloakService } from '../services/auth/keycloakService';

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginMock, isAuthenticating, authError } = useAuthStore();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [requireMfa, setRequireMfa] = useState(false);
  const [isMfaModalOpen, setIsMfaModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/console';

  /**
   * Authenticates against the Neon-backed `users` table.
   * On success the store holds the JWT, and the protected routes unlock.
   */
  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please provide operator credentials');
      return;
    }
    if (!password) {
      setError('Please provide the LAN password for this operator account');
      return;
    }

    const success = await login(username.trim(), password);
    if (!success) {
      // The store surfaces the API's own message (e.g. invalid credentials).
      return;
    }

    if (requireMfa) {
      setIsMfaModalOpen(true);
      return;
    }

    navigate(from, { replace: true });
  };

  const handleKeycloakOidc = async () => {
    try {
      await keycloakService.login();
    } catch {
      setError(
        'Keycloak OIDC authority unreachable on this offline LAN. Falling back to Local Vault.'
      );
    }
  };

  /**
   * Offline demonstration path. Grants a role without contacting the database,
   * for air-gapped field walkthroughs where no Neon project is reachable.
   */
  const handleQuickPreset = (role: UserRole) => {
    loginMock(role, true);
    navigate(from, { replace: true });
  };

  const onMfaSuccess = () => {
    setIsMfaModalOpen(false);
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col justify-center items-center p-4 relative overflow-hidden bg-grid-tactical">
      {/* Glow Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Air-Gap Badge */}
      <div className="mb-6 flex items-center gap-2 px-3 py-1 bg-card/80 border border-emerald-800/80 rounded-full shadow-lg">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-mono text-xs font-bold text-emerald-300 tracking-wider">
          AIR-GAPPED DEFENSE GRADE ENCLAVE • ZERO CLOUD EGRESS
        </span>
      </div>

      <div className="w-full max-w-lg bg-card/90 backdrop-blur border border-border rounded-2xl shadow-2xl p-8 relative z-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
          <div className="p-3 bg-primary/20 text-primary border border-primary/40 rounded-xl shadow-glow-primary">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-mono text-foreground tracking-tight">
              {t('auth.loginTitle')}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('auth.loginSubtitle')}
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="p-3 bg-muted/40 border border-border/80 rounded-lg text-[11px] text-muted-foreground flex items-start gap-2.5 mb-6">
          <GlobeLock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="leading-relaxed">{t('auth.securityNotice')}</p>
        </div>

        {/* Quick Role Selection Presets (For frictionless testing & evaluation) */}
        <div className="mb-6">
          <div className="text-[11px] font-mono font-semibold uppercase text-muted-foreground mb-2 flex items-center justify-between">
            <span>{t('auth.quickRolePreset')}</span>
            <span className="text-[10px] text-primary flex items-center gap-1">
              <Zap className="w-3 h-3" /> 1-Click Access
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['super_admin', 'Super Admin'],
                ['security_officer', 'Security Officer'],
                ['receptionist', 'Reception Desk'],
                ['host_employee', 'Host Employee'],
                ['client_admin', 'Client Tenant Admin'],
                ['auditor', 'Auditor (Read-Only)'],
              ] as [UserRole, string][]
            ).map(([role, label]) => (
              <button
                key={role}
                type="button"
                onClick={() => handleQuickPreset(role)}
                className="flex items-center justify-between px-3 py-2 bg-background hover:bg-primary/10 border border-border hover:border-primary/50 text-foreground text-xs font-mono rounded transition-colors text-left group"
              >
                <span className="truncate">{label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>

        <div className="relative flex py-2 items-center mb-6">
          <div className="flex-grow border-t border-border"></div>
          <span className="flex-shrink mx-3 text-[10px] font-mono text-muted-foreground uppercase">
            Or Standard LAN Vault Login
          </span>
          <div className="flex-grow border-t border-border"></div>
        </div>

        {/* Standard Form */}
        <form onSubmit={handleLocalLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-medium text-foreground mb-1">
              {t('auth.username')}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full text-xs font-mono pl-9 pr-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-2 focus:ring-primary"
                placeholder="operator.id"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-foreground mb-1">
              {t('auth.password')}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-xs font-mono pl-9 pr-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••••••••"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
              <input
                type="checkbox"
                checked={requireMfa}
                onChange={(e) => setRequireMfa(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary"
              />
              <span>Simulate Physical MFA Challenge</span>
            </label>
            <span className="font-mono text-[10px] text-muted-foreground">TLS 1.3 LAN</span>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Surface the API's rejection reason (bad credentials, suspended
              account, unreachable database) returned during login. */}
          {authError && (
            <div className="p-2.5 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground font-mono text-xs font-bold rounded-md shadow-glow-primary transition-all flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              {isAuthenticating ? 'VERIFYING CREDENTIALS…' : t('auth.loginButton')}
            </button>

            <button
              type="button"
              onClick={handleKeycloakOidc}
              className="w-full py-2 px-4 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-mono text-xs rounded-md transition-colors flex items-center justify-center gap-2 border border-border"
            >
              <Server className="w-3.5 h-3.5 text-muted-foreground" />
              {t('auth.loginOidc')}
            </button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-[11px] font-mono text-muted-foreground">
          <span>VLAN 20 • SEC-MGMT</span>
          <span>KEYCLOAK REALM: vms-acs</span>
        </div>
      </div>

      <MfaModal
        isOpen={isMfaModalOpen}
        onSuccess={onMfaSuccess}
        onCancel={() => setIsMfaModalOpen(false)}
      />
    </div>
  );
};
