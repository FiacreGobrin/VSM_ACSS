import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  api,
  ApiError,
  setAuthTokenProvider,
  setUnauthorizedHandler,
} from '../lib/apiClient';
import {
  validateRecordingFile,
  ACCEPTED_UPLOAD_TYPES,
  MAX_VIDEO_BYTES,
  MAX_IMAGE_BYTES,
} from '../services/api/recordingService';
import { formatBytes } from '../lib/utils';
import { hasPermission } from '../lib/permissions';

/** Builds a File with an explicit type, since jsdom does not sniff content. */
function makeFile(name: string, type: string, sizeBytes: number): File {
  const file = new File(['x'], name, { type });
  // `size` is read-only on a real File, so it is redefined for the size tests.
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

describe('Evidence upload pre-flight validation', () => {
  it('accepts every container the API allows', () => {
    for (const type of ACCEPTED_UPLOAD_TYPES) {
      const result = validateRecordingFile(makeFile('evidence', type, 1024));
      expect(result.ok, `${type} should be accepted`).toBe(true);
    }
  });

  it('classifies video and image separately', () => {
    expect(validateRecordingFile(makeFile('a.mp4', 'video/mp4', 1024)).mediaKind).toBe('video');
    expect(validateRecordingFile(makeFile('a.jpg', 'image/jpeg', 1024)).mediaKind).toBe('image');
  });

  it('rejects an executable before it is transmitted', () => {
    const result = validateRecordingFile(makeFile('payload.mp4', 'application/x-msdownload', 10));
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Unsupported format/);
  });

  it('rejects an empty file', () => {
    const result = validateRecordingFile(makeFile('empty.mp4', 'video/mp4', 0));
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/empty/i);
  });

  it('enforces the video limit but not the (smaller) image limit', () => {
    // A 20MB file is over the image ceiling but comfortably under the video one.
    const betweenLimits = 20 * 1024 * 1024;
    expect(validateRecordingFile(makeFile('big.jpg', 'image/jpeg', betweenLimits)).ok).toBe(false);
    expect(validateRecordingFile(makeFile('big.mp4', 'video/mp4', betweenLimits)).ok).toBe(true);

    expect(validateRecordingFile(makeFile('huge.mp4', 'video/mp4', MAX_VIDEO_BYTES + 1)).ok).toBe(
      false
    );
    expect(MAX_IMAGE_BYTES).toBeLessThan(MAX_VIDEO_BYTES);
  });

  it('formats Postgres BIGINT byte counts for display', () => {
    // BIGINT columns arrive as strings over the wire.
    expect(formatBytes('1048576')).toBe('1.0 MB');
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(null)).toBe('—');
  });
});
describe('Multipart upload transport', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    setAuthTokenProvider(() => 'test-token');
    setUnauthorizedHandler(() => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('sends FormData without a hand-written Content-Type', async () => {
    // Setting Content-Type manually strips the multipart boundary and the
    // server cannot parse the body at all.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ success: true, data: { id: 'rec-1' } }),
    }) as unknown as typeof fetch;

    const form = new FormData();
    form.append('title', 'Main Gate');
    form.append('file', new Blob(['bytes']), 'gate.mp4');

    await api.upload('/api/v1/recordings', form);

    const [url, init] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/v1/recordings');
    expect(init.body).toBe(form);
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.headers.Authorization).toBe('Bearer test-token');
  });

  it('still sends JSON bodies with their Content-Type', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, data: {} }),
    }) as unknown as typeof fetch;

    await api.post('/api/v1/visitors', { fullName: 'Sarah Connor' });

    const init = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"fullName":"Sarah Connor"}');
  });

  it('surfaces the API error code when an upload is rejected', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 415,
      text: async () =>
        JSON.stringify({
          success: false,
          error: { code: 'unsupported_media_type', message: 'Not a recognised container.' },
        }),
    }) as unknown as typeof fetch;

    const form = new FormData();
    form.append('file', new Blob(['MZ']), 'payload.mp4');

    // The backend's magic-byte check is the authoritative gate; the console must
    // report its verdict rather than a generic failure.
    await expect(api.upload('/api/v1/recordings', form)).rejects.toMatchObject({
      name: 'ApiError',
      status: 415,
      code: 'unsupported_media_type',
    });
  });

  it('reports an oversized clip with the file_too_large code', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 413,
      text: async () =>
        JSON.stringify({
          success: false,
          error: { code: 'file_too_large', message: 'File exceeds the 500MB limit.' },
        }),
    }) as unknown as typeof fetch;

    const form = new FormData();
    form.append('file', new Blob(['x']), 'huge.mp4');

    await expect(api.upload('/api/v1/recordings', form)).rejects.toBeInstanceOf(ApiError);
    await expect(api.upload('/api/v1/recordings', form)).rejects.toMatchObject({
      code: 'file_too_large',
    });
  });
});

describe('Evidence library RBAC', () => {
  it('lets a super admin ingest and purge evidence', () => {
    expect(hasPermission('super_admin', 'recordings:upload')).toBe(true);
    expect(hasPermission('super_admin', 'recordings:delete')).toBe(true);
  });

  it('lets a security officer ingest but not purge', () => {
    // Mirrors the API, which authorizes upload for admin+operator but
    // restricts DELETE to admin alone.
    expect(hasPermission('security_officer', 'recordings:upload')).toBe(true);
    expect(hasPermission('security_officer', 'recordings:delete')).toBe(false);
  });

  it('keeps the auditor read-only', () => {
    expect(hasPermission('auditor', 'recordings:view')).toBe(true);
    expect(hasPermission('auditor', 'recordings:upload')).toBe(false);
    expect(hasPermission('auditor', 'recordings:delete')).toBe(false);
  });

  it('grants no evidence access to front-desk or host roles', () => {
    expect(hasPermission('receptionist', 'recordings:view')).toBe(false);
    expect(hasPermission('receptionist', 'recordings:upload')).toBe(false);
    expect(hasPermission('host_employee', 'recordings:view')).toBe(false);
    expect(hasPermission('client_admin', 'recordings:view')).toBe(false);
  });
});