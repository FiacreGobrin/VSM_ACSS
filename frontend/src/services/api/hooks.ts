import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from './authService';
import { visitorApi, type VisitorListParams } from './visitorService';
import { visitApi } from './visitService';
import { cameraApi } from './cameraService';
import { recordingApi, type RecordingListParams } from './recordingService';
import { identificationApi } from './identificationService';
import { auditApi, dashboardApi, healthApi } from './dashboardService';
import type { AlertSeverity, CameraStatus, VisitorStatus, VisitStatus } from '../../types/system';

/**
 * Query key factory.
 *
 * Centralising keys keeps invalidation precise: a check-in must refresh the
 * visit list *and* the dashboard counters, but must not disturb, say, the
 * camera registry.
 */
export const queryKeys = {
  health: ['health'] as const,
  dashboard: ['dashboard', 'summary'] as const,
  users: (params?: { role?: string; q?: string }) => ['auth', 'users', params ?? {}] as const,
  visitors: (params?: VisitorListParams) => ['visitors', params ?? {}] as const,
  visits: (params?: { status?: VisitStatus | ''; visitorId?: string }) =>
    ['visits', params ?? {}] as const,
  cameras: (params?: { zoneId?: string; status?: CameraStatus | '' }) =>
    ['cameras', params ?? {}] as const,
  zones: ['cameras', 'zones'] as const,
  recordings: (params?: RecordingListParams) => ['recordings', params ?? {}] as const,
  detections: (params?: { cameraId?: string; eventType?: string }) =>
    ['identification', 'detections', params ?? {}] as const,
  alerts: (params?: { isAcknowledged?: boolean; severity?: AlertSeverity | '' }) =>
    ['identification', 'alerts', params ?? {}] as const,
  audit: (params?: { action?: string; entityType?: string }) => ['audit', params ?? {}] as const,
};

/* -------------------------------------------------------------------------- */
/* Health & dashboard                                                          */
/* -------------------------------------------------------------------------- */

/** Polls the API + Neon round-trip so the connection indicator stays live. */
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => healthApi.check(signal),
    refetchInterval: 30_000,
    retry: false,
  });
}

/** SOC landing-page counters, refreshed every 15 seconds. */
export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: ({ signal }) => dashboardApi.summary(signal),
    refetchInterval: 15_000,
  });
}

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

export function useUserRegistry(params?: { role?: string; q?: string }) {
  return useQuery({
    queryKey: queryKeys.users(params),
    queryFn: ({ signal }) => authApi.listUsers(params, signal),
  });
}

/* -------------------------------------------------------------------------- */
/* Visitors & visits                                                           */
/* -------------------------------------------------------------------------- */

export function useVisitors(params: VisitorListParams = {}) {
  return useQuery({
    queryKey: queryKeys.visitors(params),
    queryFn: ({ signal }) => visitorApi.list(params, signal),
  });
}

export function useVisits(params: { status?: VisitStatus | ''; visitorId?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.visits(params),
    queryFn: ({ signal }) => visitApi.list(params, signal),
  });
}

/** Registers a visitor. Invalidates the registry and the dashboard counters. */
export function useCreateVisitor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: visitorApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['visitors'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

/** Moves a visitor between active / flagged / blacklisted. */
export function useUpdateVisitorStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: VisitorStatus; notes?: string }) =>
      visitorApi.setStatus(id, status, notes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['visitors'] });
      void queryClient.invalidateQueries({ queryKey: ['visits'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}


/**
 * Check-in / check-out a pass.
 *
 * Both transitions change occupancy, so the dashboard summary and the visit
 * list are refreshed together to keep the two views consistent.
 */
export function useVisitTransition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      badgeNumber,
    }: {
      id: string;
      action: 'check-in' | 'check-out';
      badgeNumber?: string;
    }) => (action === 'check-in' ? visitApi.checkIn(id, badgeNumber) : visitApi.checkOut(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['visits'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Surveillance                                                                */
/* -------------------------------------------------------------------------- */

export function useCameras(params: { zoneId?: string; status?: CameraStatus | '' } = {}) {
  return useQuery({
    queryKey: queryKeys.cameras(params),
    queryFn: ({ signal }) => cameraApi.list(params, signal),
  });
}

export function useZones() {
  return useQuery({
    queryKey: queryKeys.zones,
    queryFn: ({ signal }) => cameraApi.listZones(signal),
  });
}

/* -------------------------------------------------------------------------- */
/* Evidence library                                                            */
/* -------------------------------------------------------------------------- */

/** Uploaded CCTV clips and reference stills, newest capture first. */
export function useRecordings(params: RecordingListParams = {}) {
  return useQuery({
    queryKey: queryKeys.recordings(params),
    queryFn: ({ signal }) => recordingApi.list(params, signal),
  });
}

/**
 * Uploads a clip or still.
 *
 * On success the evidence list, the camera registry and the dashboard counters
 * are all invalidated: an upload attaches to a camera and changes what the SOC
 * reports as retained evidence.
 */
export function useUploadRecording() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      input,
      onProgress,
    }: {
      input: Parameters<typeof recordingApi.upload>[0];
      onProgress?: (percent: number) => void;
    }) => recordingApi.upload(input, onProgress),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recordings'] });
      void queryClient.invalidateQueries({ queryKey: ['cameras'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

/** Permanently removes a clip. The API deletes the row and the stored object. */
export function useDeleteRecording() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recordingApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recordings'] });
      void queryClient.invalidateQueries({ queryKey: ['cameras'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export function useDetections(
  params: { cameraId?: string; eventType?: string; limit?: number } = {}
) {
  return useQuery({
    queryKey: queryKeys.detections(params),
    queryFn: ({ signal }) => identificationApi.listDetections(params, signal),
    refetchInterval: 15_000,
  });
}

export function useAlerts(
  params: { isAcknowledged?: boolean; severity?: AlertSeverity | ''; limit?: number } = {}
) {
  return useQuery({
    queryKey: queryKeys.alerts(params),
    queryFn: ({ signal }) => identificationApi.listAlerts(params, signal),
    refetchInterval: 15_000,
  });
}

/** Acknowledges an alert, which writes an audit entry server-side. */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) => identificationApi.acknowledgeAlert(alertId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['identification'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Compliance                                                                  */
/* -------------------------------------------------------------------------- */

export function useAuditLogs(
  params: { action?: string; entityType?: string; limit?: number } = {}
) {
  return useQuery({
    queryKey: queryKeys.audit(params),
    queryFn: ({ signal }) => auditApi.list(params, signal),
  });
}
