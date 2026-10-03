import { create } from 'zustand';
import { User, UserRole, UserSession, toConsoleRole, type AuthUserResponse } from '../types/auth';
import { MOCK_USERS, INITIAL_MOCK_SESSIONS } from '../services/auth/mockAuthService';
import { authApi } from '../services/api/authService';
import { setAuthTokenProvider, setUnauthorizedHandler, ApiError } from '../lib/apiClient';

const TOKEN_STORAGE_KEY = 'vms_acs_jwt';

/** Persists the bearer token so a page refresh keeps the operator signed in. */
function persistToken(token: string | null): void {
  if (typeof localStorage === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

function readStoredToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

/**
 * Projects an API profile onto the console's `User` shape.
 *
 * `role` is translated from the database vocabulary (`admin`/`operator`/`guard`)
 * to the console's six-tier clearance model, and the nullable profile columns
 * are given safe display defaults so the header never renders "null".
 */
function toConsoleUser(profile: AuthUserResponse): User {
  return {
    id: profile.id,
    username: profile.username,
    fullName: profile.fullName,
    email: profile.email,
    role: toConsoleRole(profile.role),
    department: profile.department || 'Unassigned',
    badgeNumber: profile.badgeNumber ?? 'UNASSIGNED',
    clearanceLevel: profile.clearanceLevel ?? 'STANDARD',
    mfaVerified: Boolean(profile.mfaVerified),
    lastLoginAt: profile.lastLoginAt ?? new Date().toISOString(),
  };
}

interface AuthStoreState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isMfaRequired: boolean;
  isMfaVerified: boolean;
  sessions: UserSession[];

  // Authentication lifecycle
  isAuthenticating: boolean;
  authError: string | null;

  // Idle timeout management (Default: 900 seconds = 15 mins)
  idleTimeoutSeconds: number;
  lastActivityTimestamp: number;
  secondsRemaining: number;
  isIdleWarningOpen: boolean;

  // Global Facility Emergency Lockdown State
  isEmergencyLockdownActive: boolean;
  lockdownMetadata: {
    reason: string;
    initiatedBy: string;
    timestamp: string;
  } | null;

  // Actions
  login: (username: string, password: string) => Promise<boolean>;
  restoreSession: () => Promise<boolean>;
  loginMock: (role?: UserRole, skipMfa?: boolean) => void;
  verifyMfa: (totpCode: string) => boolean;
  logout: () => void;
  switchRole: (newRole: UserRole) => void;
  resetActivityTimer: () => void;
  tickTimer: () => void;
  closeIdleWarning: () => void;
  revokeSession: (sessionId: string) => void;
  triggerEmergencyLockdown: (reason: string) => void;
  cancelEmergencyLockdown: () => void;
}

const DEFAULT_IDLE_TIMEOUT = 900; // 15 minutes
const IDLE_WARNING_THRESHOLD = 60; // Show warning modal when 60s remain

/**
 * A real session is only claimed on boot when a persisted JWT exists AND the
 * API confirms it is still valid. Anything else starts unauthenticated so the
 * operator is routed to the login screen rather than into a broken console.
 */
const storedToken = readStoredToken();

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  user: null,
  token: storedToken,
  isAuthenticated: false,
  isMfaRequired: false,
  isMfaVerified: false,
  sessions: INITIAL_MOCK_SESSIONS,

  isAuthenticating: false,
  authError: null,

  idleTimeoutSeconds: DEFAULT_IDLE_TIMEOUT,
  lastActivityTimestamp: Date.now(),
  secondsRemaining: DEFAULT_IDLE_TIMEOUT,
  isIdleWarningOpen: false,

  isEmergencyLockdownActive: false,
  lockdownMetadata: null,

  /**
   * Authenticates against the Neon-backed `users` table via the Express API
   * and stores the returned JWT for subsequent requests.
   */
  login: async (username: string, password: string) => {
    set({ isAuthenticating: true, authError: null });

    try {
      const result = await authApi.login(username, password);
      persistToken(result.token);
      set({
        token: result.token,
        user: toConsoleUser(result.user),
        isAuthenticated: true,
        isMfaRequired: false,
        isMfaVerified: Boolean(result.user.mfaVerified),
        isAuthenticating: false,
        authError: null,
        lastActivityTimestamp: Date.now(),
        secondsRemaining: DEFAULT_IDLE_TIMEOUT,
        isIdleWarningOpen: false,
      });
      return true;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Authentication failed. Please contact your system administrator.';
      set({ isAuthenticating: false, authError: message, isAuthenticated: false });
      return false;
    }
  },

  /**
   * Re-establishes a session on page load from a persisted JWT.
   * Used by the boot sequence before protected routes render.
   */
  restoreSession: async () => {
    const token = get().token;
    if (!token) return false;

    try {
      const profile = await authApi.me();
      set({
        user: toConsoleUser(profile as AuthUserResponse),
        isAuthenticated: true,
        lastActivityTimestamp: Date.now(),
        secondsRemaining: DEFAULT_IDLE_TIMEOUT,
      });
      return true;
    } catch {
      // The token is expired, revoked, or the API is unreachable.
      get().logout();
      return false;
    }
  },

  /**
   * Offline demo path: grants a session without contacting the database.
   * Retained for air-gapped field demonstrations and the RBAC test suite.
   */
  loginMock: (role: UserRole = 'super_admin', skipMfa = true) => {
    const selectedUser = MOCK_USERS[role] || MOCK_USERS.super_admin;
    localStorage.setItem('vms_acs_user_role', role);

    if (!skipMfa) {
      set({
        user: selectedUser,
        token: null,
        isAuthenticated: false,
        isMfaRequired: true,
        isMfaVerified: false,
      });
      return;
    }

    set({
      user: selectedUser,
      token: `jwt-airgap-${role}-${Date.now()}`,
      isAuthenticated: true,
      isMfaRequired: false,
      isMfaVerified: true,
      lastActivityTimestamp: Date.now(),
      secondsRemaining: DEFAULT_IDLE_TIMEOUT,
      isIdleWarningOpen: false,
    });
  },

  verifyMfa: (totpCode: string) => {
    // In air-gapped demo, any 6-digit code or "123456" is verified
    if (/^\d{6}$/.test(totpCode.trim())) {
      set({
        token: `jwt-airgap-verified-${Date.now()}`,
        isAuthenticated: true,
        isMfaRequired: false,
        isMfaVerified: true,
        lastActivityTimestamp: Date.now(),
        secondsRemaining: DEFAULT_IDLE_TIMEOUT,
        isIdleWarningOpen: false,
      });
      return true;
    }
    return false;
  },

  logout: () => {
    localStorage.removeItem('vms_acs_user_role');
    persistToken(null);
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isMfaRequired: false,
      isMfaVerified: false,
      isIdleWarningOpen: false,
      authError: null,
    });
  },

  switchRole: (newRole: UserRole) => {
    const selectedUser = MOCK_USERS[newRole];
    if (selectedUser) {
      localStorage.setItem('vms_acs_user_role', newRole);
      set({
        user: selectedUser,
        lastActivityTimestamp: Date.now(),
        secondsRemaining: DEFAULT_IDLE_TIMEOUT,
      });
    }
  },

  resetActivityTimer: () => {
    set({
      lastActivityTimestamp: Date.now(),
      secondsRemaining: get().idleTimeoutSeconds,
      isIdleWarningOpen: false,
    });
  },

  tickTimer: () => {
    const { isAuthenticated, lastActivityTimestamp, idleTimeoutSeconds, isIdleWarningOpen } = get();
    if (!isAuthenticated) return;

    const elapsedSeconds = Math.floor((Date.now() - lastActivityTimestamp) / 1000);
    const remaining = Math.max(0, idleTimeoutSeconds - elapsedSeconds);

    if (remaining <= 0) {
      // Force auto-logout on complete idle expiration
      get().logout();
      return;
    }

    if (remaining <= IDLE_WARNING_THRESHOLD && !isIdleWarningOpen) {
      set({ secondsRemaining: remaining, isIdleWarningOpen: true });
    } else {
      set({ secondsRemaining: remaining });
    }
  },

  closeIdleWarning: () => {
    get().resetActivityTimer();
  },

  revokeSession: (sessionId: string) => {
    set({
      sessions: get().sessions.filter((s) => s.id !== sessionId),
    });
  },

  triggerEmergencyLockdown: (reason: string) => {
    const currentUser = get().user;
    set({
      isEmergencyLockdownActive: true,
      lockdownMetadata: {
        reason,
        initiatedBy: currentUser ? `${currentUser.fullName} (${currentUser.badgeNumber})` : 'SOC Operator',
        timestamp: new Date().toISOString(),
      },
    });
  },

  cancelEmergencyLockdown: () => {
    set({
      isEmergencyLockdownActive: false,
      lockdownMetadata: null,
    });
  },
}));

/**
 * Bridge the auth store to the API client.
 *
 * Registering a getter (rather than passing the token per call) keeps the
 * client free of store imports — avoiding an import cycle — and guarantees
 * every request picks up the current token.
 */
setAuthTokenProvider(() => useAuthStore.getState().token);

/**
 * A 401 from the API means the JWT is no longer accepted (expired, revoked,
 * or the secret was rotated). Drop the local session so the router sends the
 * operator back to the login screen instead of looping on failed requests.
 */
setUnauthorizedHandler(() => {
  useAuthStore.getState().logout();
});
