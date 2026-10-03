import { api } from '../../lib/apiClient';
import type { Camera, CameraStatus, SecurityZone } from '../../types/system';

/**
 * Surveillance infrastructure endpoints (`/api/v1/cameras`).
 * Backed by the `cameras` and `zones` tables.
 */
export const cameraApi = {
  list: (params: { zoneId?: string; status?: CameraStatus | '' } = {}, signal?: AbortSignal) =>
    api.get<Camera[]>('/api/v1/cameras', { query: { ...params }, signal }),

  getById: (id: string, signal?: AbortSignal) => api.get<Camera>(`/api/v1/cameras/${id}`, { signal }),

  /** Records an online heartbeat from the camera edge device. */
  heartbeat: (id: string) =>
    api.post<{ id: string; name: string; status: CameraStatus; last_heartbeat_at: string }>(
      `/api/v1/cameras/${id}/heartbeat`
    ),

  listZones: (signal?: AbortSignal) => api.get<SecurityZone[]>('/api/v1/cameras/zones', { signal }),
};