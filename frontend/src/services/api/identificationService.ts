import { api } from '../../lib/apiClient';
import type { AlertSeverity, Detection, SecurityAlert } from '../../types/system';

/**
 * CCTV identification and alerting endpoints (`/api/v1/identification`).
 * The alert engine that raises `security_alerts` rows runs server-side when
 * a detection is ingested, so the console only reads and acknowledges.
 */
export const identificationApi = {
  listDetections: (
    params: { cameraId?: string; visitorId?: string; eventType?: string; limit?: number; offset?: number } = {},
    signal?: AbortSignal
  ) => api.getPage<Detection[]>('/api/v1/identification/detections', { query: { ...params }, signal }),

  listAlerts: (
    params: { isAcknowledged?: boolean; severity?: AlertSeverity | ''; limit?: number; offset?: number } = {},
    signal?: AbortSignal
  ) => api.getPage<SecurityAlert[]>('/api/v1/identification/alerts', { query: { ...params }, signal }),

  acknowledgeAlert: (id: string) =>
    api.post<SecurityAlert>(`/api/v1/identification/alerts/${id}/acknowledge`),
};