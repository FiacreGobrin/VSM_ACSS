import { api } from '../../lib/apiClient';
import type { AuditLogEntry, DashboardSummary, HealthStatus } from '../../types/system';

/**
 * Compliance endpoints (`/api/v1/audit`).
 * The audit trail is append-only and written server-side on every mutating
 * action, which is what makes it usable as a tamper-evident record.
 */
export const auditApi = {
  list: (
    params: { action?: string; entityType?: string; limit?: number; offset?: number } = {},
    signal?: AbortSignal
  ) => api.getPage<AuditLogEntry[]>('/api/v1/audit', { query: { ...params }, signal }),
};

/**
 * Aggregated operational counters (`/api/v1/dashboard/summary`).
 * Resolved in a single query so the SOC landing page stays cheap to poll.
 */
export const dashboardApi = {
  summary: (signal?: AbortSignal) => api.get<DashboardSummary>('/api/v1/dashboard/summary', { signal }),
};

/**
 * Liveness probe (`/health`), including the Neon round-trip latency.
 * Public — used to drive the connection indicator before sign-in.
 */
export const healthApi = {
  check: (signal?: AbortSignal) => api.get<HealthStatus>('/health', { auth: false, signal }),
};