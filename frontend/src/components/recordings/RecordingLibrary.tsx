import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Film, Image as ImageIcon, Trash2, Loader2, Play, HardDrive } from 'lucide-react';
import { useRecordings, useDeleteRecording } from '../../services/api/hooks';
import { recordingApi } from '../../services/api/recordingService';
import { hasPermission } from '../../lib/permissions';
import { useAuthStore } from '../../stores/authStore';
import { formatBytes, formatRelativeTime } from '../../lib/utils';
import type { Recording } from '../../types/system';

/**
 * Inline player for a single clip.
 *
 * The media endpoint is authenticated, and a `<video src>` cannot carry a bearer
 * token, so the bytes are fetched on demand and handed over as an object URL.
 *
 * Fetching is deliberately lazy: the operator clicks to load, so opening this
 * page never pulls every retained clip into the browser's memory at once. The
 * object URL is revoked on unmount - leaking one pins the whole blob in memory
 * for the lifetime of the document.
 */
const RecordingPreview: React.FC<{ recording: Recording }> = ({ recording }) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(
    () => () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
    [objectUrl]
  );

  const load = async () => {
    setIsLoading(true);
    setFailed(false);
    try {
      setObjectUrl(await recordingApi.fetchObjectUrl(recording.id));
    } catch {
      setFailed(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (failed) {
    return (
      <p className="text-[10px] font-mono text-rose-400 px-3 py-2">
        Preview unavailable — the clip may have passed its retention hold.
      </p>
    );
  }

  if (objectUrl) {
    return recording.media_kind === 'video' ? (
      <video src={objectUrl} controls preload="metadata" className="w-full bg-black aspect-video" />
    ) : (
      <img src={objectUrl} alt={recording.title} className="w-full object-cover aspect-video" />
    );
  }

  return (
    <button
      type="button"
      onClick={() => void load()}
      disabled={isLoading}
      className="w-full aspect-video bg-background/80 hover:bg-secondary/40 transition-colors flex flex-col items-center justify-center gap-1.5 disabled:opacity-60"
    >
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      ) : (
        <Play className="w-5 h-5 text-primary" />
      )}
      <span className="text-[10px] font-mono text-muted-foreground">
        {isLoading ? 'Loading…' : 'Load preview'}
      </span>
    </button>
  );
};
/**
 * Retained-evidence grid shown on the camera wall.
 *
 * Reads the `recordings` registry; the bytes themselves are served by the API's
 * authenticated stream endpoint rather than from Postgres or a static mount.
 */
export const RecordingLibrary: React.FC = () => {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const canView = hasPermission(user?.role, 'recordings:view');
  const canDelete = hasPermission(user?.role, 'recordings:delete');

  const query = useRecordings({ limit: 24 });
  const remove = useDeleteRecording();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  // Read-only roles get no library at all rather than an empty shell.
  if (!canView) return null;

  const recordings = query.data?.data ?? [];
  const total = query.data?.meta?.total ?? recordings.length;

  const confirmDelete = async (recording: Recording) => {
    setPendingDelete(recording.id);
    try {
      await remove.mutateAsync(recording.id);
    } catch {
      // Surfaced through the mutation state rendered below.
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="p-4 bg-card border border-border rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-foreground">
            {t('recordings.libraryTitle')}
          </h2>
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          {total} {t('recordings.retained')}
        </span>
      </div>

      {query.isLoading && (
        <p className="text-xs text-muted-foreground py-6 text-center">{t('common.loading')}</p>
      )}

      {query.isError && (
        <p className="text-xs text-rose-400 py-6 text-center">
          {query.error?.message ?? 'Unable to load the evidence library.'}
        </p>
      )}

      {remove.isError && (
        <p className="text-xs text-rose-400 mb-3 border border-rose-800 bg-rose-950/40 rounded px-2 py-1.5">
          {remove.error?.message ?? 'Deletion failed.'}
        </p>
      )}

      {!query.isLoading && !query.isError && recordings.length === 0 && (
        <p className="text-xs text-muted-foreground py-6 text-center">{t('recordings.empty')}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {recordings.map((recording) => (
          <div
            key={recording.id}
            className="bg-background border border-border rounded-lg overflow-hidden flex flex-col"
          >
            <RecordingPreview recording={recording} />

            <div className="p-3 space-y-1.5 flex-1 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-foreground truncate">
                  {recording.title}
                </span>
                {recording.media_kind === 'video' ? (
                  <Film className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                )}
              </div>

              <div className="text-[10px] font-mono text-muted-foreground space-y-0.5">
                <div className="truncate">
                  {recording.camera_name ?? t('recordings.unattributed')}
                </div>
                <div>
                  {formatBytes(recording.size_bytes)} · {formatRelativeTime(recording.recorded_at)}
                </div>
              </div>

              {canDelete && (
                <button
                  type="button"
                  onClick={() => void confirmDelete(recording)}
                  disabled={pendingDelete === recording.id}
                  className="mt-auto self-start px-2 py-1 text-[10px] font-mono bg-secondary hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-800 border border-border rounded flex items-center gap-1 disabled:opacity-50"
                >
                  {pendingDelete === recording.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                  {t('recordings.delete')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};