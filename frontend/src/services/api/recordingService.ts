import { api, fetchAuthenticatedBlob } from '../../lib/apiClient';
import type { Recording, RecordingContentType, RecordingMediaKind } from '../../types/system';

export interface RecordingListParams {
  cameraId?: string;
  zoneId?: string;
  mediaKind?: RecordingMediaKind | '';
  limit?: number;
  offset?: number;
}

export interface UploadRecordingInput {
  file: File;
  title: string;
  description?: string;
  cameraId?: string;
  zoneId?: string;
  recordedAt?: string;
  /** Retention hold in days; omitted means the row is kept indefinitely. */
  retentionDays?: number;
}

/**
 * Container formats the API will accept, mirroring
 * `config.uploads.allowed*Types` on the server.
 *
 * This list is a *pre-flight* convenience only. The server independently
 * verifies the file's magic bytes and treats that as authoritative, so a file
 * that passes this check can still be rejected with a 415. Its purpose is to
 * avoid streaming a 400 MB upload that was never going to be accepted.
 */
export const ACCEPTED_VIDEO_TYPES: readonly RecordingContentType[] = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

export const ACCEPTED_IMAGE_TYPES: readonly RecordingContentType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const ACCEPTED_UPLOAD_TYPES: readonly RecordingContentType[] = [
  ...ACCEPTED_VIDEO_TYPES,
  ...ACCEPTED_IMAGE_TYPES,
];

/** Mirrors the default `UPLOAD_MAX_VIDEO_BYTES` in `backend/.env.example`. */
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export interface FileValidationResult {
  ok: boolean;
  /** Populated when `ok` is false; safe to surface to the operator. */
  reason?: string;
  mediaKind?: RecordingMediaKind;
}

/**
 * Checks a file against the API's upload policy before it is transmitted.
 *
 * Returning a reason rather than throwing keeps the form's error display
 * simple: the caller renders `reason` directly.
 */
export function validateRecordingFile(file: File): FileValidationResult {
  const accepted = ACCEPTED_UPLOAD_TYPES as readonly string[];
  if (!accepted.includes(file.type)) {
    return {
      ok: false,
      reason: `Unsupported format "${file.type || 'unknown'}". Accepted: MP4, WebM, MOV, JPEG, PNG, WebP.`,
    };
  }

  const isVideo = (ACCEPTED_VIDEO_TYPES as readonly string[]).includes(file.type);
  const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

  if (file.size === 0) {
    return { ok: false, reason: 'The selected file is empty.' };
  }

  if (file.size > limit) {
    const limitMb = Math.floor(limit / (1024 * 1024));
    return { ok: false, reason: `File exceeds the ${limitMb}MB limit.` };
  }

  return { ok: true, mediaKind: isVideo ? 'video' : 'image' };
}

/**
 * Evidence library endpoints (`/api/v1/recordings`).
 * Backed by the `recordings` table; the bytes live on the API host's upload
 * volume rather than in Postgres.
 */
export const recordingApi = {
  list: (params: RecordingListParams = {}, signal?: AbortSignal) =>
    api.getPage<Recording[]>('/api/v1/recordings', { query: { ...params }, signal }),

  getById: (id: string, signal?: AbortSignal) =>
    api.get<Recording>(`/api/v1/recordings/${id}`, { signal }),

  /**
   * Uploads one clip or still as multipart/form-data.
   *
   * `onProgress` receives a 0-100 percentage; see `api.upload` for why this
   * path uses XHR.
   */
  upload: (input: UploadRecordingInput, onProgress?: (percent: number) => void) => {
    const form = new FormData();
    form.append('file', input.file, input.file.name);
    // Only send optional fields that actually carry a value: an empty string
    // would be persisted as a non-null blank rather than as NULL.
    if (input.title) form.append('title', input.title);
    if (input.description) form.append('description', input.description);
    if (input.cameraId) form.append('cameraId', input.cameraId);
    if (input.zoneId) form.append('zoneId', input.zoneId);
    if (input.recordedAt) form.append('recordedAt', input.recordedAt);
    if (input.retentionDays) form.append('retentionDays', String(input.retentionDays));

    return api.upload<Recording>('/api/v1/recordings', form, { onProgress });
  },

  remove: (id: string) =>
    api.delete<{ id: string; deleted: boolean; fileRemoved: boolean }>(
      `/api/v1/recordings/${id}`
    ),

  /** Path of the authenticated media stream, for `<video>` / `<img>` sources. */
  streamPath: (id: string) => `/api/v1/recordings/${id}/stream`,

  /** Fetches a clip as an object URL, attaching the bearer token. */
  fetchObjectUrl: async (id: string, signal?: AbortSignal): Promise<string> => {
    const blob = await fetchAuthenticatedBlob(recordingApi.streamPath(id), signal);
    return URL.createObjectURL(blob);
  },
};