import { api, type PageMeta } from '../../lib/apiClient';
import type { Visitor, VisitorStatus } from '../../types/system';

export interface VisitorListParams {
  q?: string;
  status?: VisitorStatus | '';
  limit?: number;
  offset?: number;
}

export interface CreateVisitorInput {
  fullName: string;
  idType: Visitor['id_type'];
  idNumber: string;
  company?: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  notes?: string;
}

/**
 * Visitor registry endpoints (`/api/v1/visitors`).
 * Backed by the `visitors` table, including PII columns that the console
 * masks before display.
 */
export const visitorApi = {
  list: (params: VisitorListParams = {}, signal?: AbortSignal) =>
    api.getPage<Visitor[]>('/api/v1/visitors', { query: { ...params }, signal }),

  getById: (id: string, signal?: AbortSignal) =>
    api.get<Visitor>(`/api/v1/visitors/${id}`, { signal }),

  create: (payload: CreateVisitorInput) =>
    api.post<Visitor>('/api/v1/visitors', payload),

  update: (id: string, payload: Partial<CreateVisitorInput>) =>
    api.put<Visitor>(`/api/v1/visitors/${id}`, payload),

  /** Moves a visitor between `active`, `flagged` and `blacklisted`. */
  setStatus: (id: string, status: VisitorStatus, notes = '') =>
    api.patch<Visitor>(`/api/v1/visitors/${id}/status`, { status, notes }),
};

export type { PageMeta };