/**
 * Barrel export for the VMS-ACS API client.
 *
 * Every module the console reads from Neon Postgres is reachable from here,
 * which keeps page components free of raw endpoint paths.
 */
export { authApi } from './authService';
export { visitorApi, type VisitorListParams, type CreateVisitorInput } from './visitorService';
export { visitApi, type VisitListParams, type CreateVisitInput } from './visitService';
export { cameraApi } from './cameraService';
export {
  recordingApi,
  validateRecordingFile,
  ACCEPTED_UPLOAD_TYPES,
  ACCEPTED_VIDEO_TYPES,
  ACCEPTED_IMAGE_TYPES,
  MAX_VIDEO_BYTES,
  MAX_IMAGE_BYTES,
  type RecordingListParams,
  type UploadRecordingInput,
} from './recordingService';
export { identificationApi } from './identificationService';
export { auditApi, dashboardApi, healthApi } from './dashboardService';
export { ApiError, API_BASE_URL, type PageMeta } from '../../lib/apiClient';
export {
  queryKeys,
  useHealth,
  useDashboardSummary,
  useUserRegistry,
  useVisitors,
  useVisits,
  useCreateVisitor,
  useUpdateVisitorStatus,
  useVisitTransition,
  useCameras,
  useZones,
  useRecordings,
  useUploadRecording,
  useDeleteRecording,
  useDetections,
  useAlerts,
  useAcknowledgeAlert,
  useAuditLogs,
} from './hooks';