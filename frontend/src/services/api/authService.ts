import { api } from '../../lib/apiClient';
import type { LoginResponse, UserRegistryRecord } from '../../types/auth';

/**
 * Authentication endpoints (`/api/v1/auth`).
 * These resolve against the Neon-backed `users` table.
 */
export const authApi = {
  /** Exchanges credentials for a signed JWT and the operator profile. */
  login: (username: string, password: string, signal?: AbortSignal) =>
    api.post<LoginResponse>('/api/v1/auth/login', { username, password }, { auth: false, signal }),

  /** Returns the profile for the bearer token currently in use. */
  me: (signal?: AbortSignal) => api.get<UserRegistryRecord>('/api/v1/auth/me', { signal }),

  /** Operator & role registry rendered by the Administration console. */
  listUsers: (
    params?: { role?: string; q?: string },
    signal?: AbortSignal
  ) => api.get<UserRegistryRecord[]>('/api/v1/auth/users', { query: params, signal }),

  register: (payload: {
    username: string;
    email: string;
    password: string;
    fullName: string;
    role: string;
    department?: string;
    badgeNumber?: string;
    clearanceLevel?: string;
  }) => api.post<UserRegistryRecord>('/api/v1/auth/register', payload, { auth: false }),
};