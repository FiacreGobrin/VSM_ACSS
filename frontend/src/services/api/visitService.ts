import { api } from '../../lib/apiClient';
import type { Visit, VisitStatus } from '../../types/system';

export interface VisitListParams {
  status?: VisitStatus | '';
  visitorId?: string;
  limit?: number;
  offset?: number;
}

export interface CreateVisitInput {
  visitorId: string;
  hostName: string;
  hostEmail?: string;
  purpose: string;
  badgeNumber?: string;
  authorizedZones?: string[];
  expectedArrival?: string;
}

/**
 * Access-pass endpoints (`/api/v1/visits`).
 * Check-in and check-out are audited server-side and maintain the
 * `on_site` counter that drives the SOC occupancy KPI.
 */
export const visitApi = {
  list: (params: VisitListParams = {}, signal?: AbortSignal) =>
    api.getPage<Visit[]>('/api/v1/visits', { query: { ...params }, signal }),

  create: (payload: CreateVisitInput) => api.post<Visit>('/api/v1/visits', payload),

  checkIn: (id: string, badgeNumber?: string) =>
    api.post<Visit>(`/api/v1/visits/${id}/check-in`, { badgeNumber }),

  checkOut: (id: string) => api.post<Visit>(`/api/v1/visits/${id}/check-out`),
};