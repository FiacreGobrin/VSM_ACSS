import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Film, Image as ImageIcon, X, Loader2, ShieldCheck } from 'lucide-react';
import { useUploadRecording, useCameras, useZones } from '../../services/api/hooks';
import { validateRecordingFile } from '../../services/api/recordingService';
import { hasPermission } from '../../lib/permissions';
import { useAuthStore } from '../../stores/authStore';
import { formatBytes, cn } from '../../lib/utils';

/**
 * Evidence ingest panel for the camera wall.
 *
 * Deliberately validates in the browser before transmitting: a rejected file
 * would otherwise stream hundreds of megabytes across the LAN only for the
 * server to refuse it. The server re-verifies the magic bytes regardless, so
 * this is a usability measure and never a security boundary.
 */
export const RecordingUploadPanel: React.FC = () => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [cameraId, setCameraId] = useState('');
  const [retentionDays, setRetentionDays] = useState('30');
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const user = useAuthStore((state) => state.user);
  const canUpload = hasPermission(user?.role, 'recordings:upload');

  const camerasQuery = useCameras();
  const zonesQuery = useZones();
  const upload = useUploadRecording();

  const cameras = camerasQuery.data ?? [];

  /** Applies a candidate file, rejecting anything outside the upload policy. */
  const acceptFile = (candidate: File | undefined | null) => {
    setError(null);
    setSuccess(null);
    if (!candidate) return;

    const validation = validateRecordingFile(candidate);
    if (!validation.ok) {
      setFile(null);
      setError(validation.reason ?? 'Unsupported file.');
      return;
    }

    setFile(candidate);
    // Pre-fill the title from the filename: every recording needs one, and the
    // operator almost always accepts the filename minus its extension.
    if (!title.trim()) {
      setTitle(candidate.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim());
    }
  };

  const reset = () => {
    setFile(null);
    setTitle('');
    setCameraId('');
    setProgress(null);
    setError(null);
    setSuccess(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !canUpload) return;

    setError(null);
    setSuccess(null);
    setProgress(0);

    try {
      const recording = await upload.mutateAsync({
        input: {
          file,
          title: title.trim(),
          cameraId: cameraId || undefined,
          retentionDays: retentionDays ? parseInt(retentionDays, 10) : undefined,
        },
        onProgress: setProgress,
      });

      setSuccess(t('recordings.uploaded', { title: recording.title }));
      reset();
    } catch (err) {
      setProgress(null);
      setError(err instanceof Error ? err.message : 'The upload was rejected by the API.');
    }
  };

  // An operator without the permission gets no control at all, rather than one
  // the API would reject with a 403.
  if (!canUpload) return null;

  const isUploading = upload.isPending;
return (
    <div className="p-4 bg-card border border-border rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-foreground">
            {t('recordings.uploadTitle')}
          </h2>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground uppercase">
          MP4 / WEBM / MOV / JPEG / PNG
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* The drop zone doubles as the file picker. */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            acceptFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            'flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed transition-colors cursor-pointer',
            isDragging
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-primary/50 bg-background/60'
          )}
        >
          {file ? (
            <>
              {file.type.startsWith('video/') ? (
                <Film className="w-6 h-6 text-cyan-400" />
              ) : (
                <ImageIcon className="w-6 h-6 text-purple-400" />
              )}
              <span className="text-xs font-mono text-foreground truncate max-w-full">
                {file.name}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {formatBytes(file.size)}
              </span>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{t('recordings.dropHint')}</span>
            </>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => acceptFile(e.target.files?.[0])}
          />
        </div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label
              htmlFor="recording-title"
              className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1"
            >
              {t('recordings.title')}
            </label>
            <input
              id="recording-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('recordings.titlePlaceholder')}
              required
              className="w-full px-2 py-1.5 bg-background border border-border rounded text-xs text-foreground font-mono focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label
              htmlFor="recording-camera"
              className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1"
            >
              {t('recordings.camera')}
            </label>
            <select
              id="recording-camera"
              value={cameraId}
              onChange={(e) => setCameraId(e.target.value)}
              className="w-full px-2 py-1.5 bg-background border border-border rounded text-xs text-foreground font-mono focus:outline-none focus:border-primary"
            >
              <option value="">{t('recordings.unattributed')}</option>
              {cameras.map((camera) => (
                <option key={camera.id} value={camera.id}>
                  {camera.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="recording-retention"
              className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1"
            >
              {t('recordings.retention')}
            </label>
            <select
              id="recording-retention"
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
              className="w-full px-2 py-1.5 bg-background border border-border rounded text-xs text-foreground font-mono focus:outline-none focus:border-primary"
            >
              <option value="7">7 {t('recordings.days')}</option>
              <option value="30">30 {t('recordings.days')}</option>
              <option value="90">90 {t('recordings.days')}</option>
              <option value="365">365 {t('recordings.days')}</option>
            </select>
          </div>
        </div>

        {/* Progress is only meaningful while bytes are actually moving. */}
        {isUploading && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                {t('recordings.uploading')}
              </span>
              <span>{progress ?? 0}%</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-200"
                style={{ width: `${progress ?? 0}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-rose-400 border border-rose-800 bg-rose-950/40 rounded px-2 py-1.5">
            {error}
          </p>
        )}

        {success && (
          <p className="text-xs text-emerald-400 border border-emerald-800 bg-emerald-950/40 rounded px-2 py-1.5 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            {success}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={!file || !title.trim() || isUploading}
            className="px-3 py-1.5 bg-primary hover:bg-primary/90 disabled:opacity-40 rounded text-primary-foreground text-xs font-semibold flex items-center gap-1.5"
          >
            {isUploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {t('recordings.upload')}
          </button>

          {(file || title || error) && !isUploading && (
            <button
              type="button"
              onClick={reset}
              className="px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 rounded text-foreground text-xs flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              {t('recordings.clear')}
            </button>
          )}

          {/* Surfaces that evidence is attributed, not merely filed. */}
          {zonesQuery.data && file && !cameraId && (
            <span className="text-[10px] font-mono text-muted-foreground">
              {t('recordings.zoneHint', { count: zonesQuery.data.length })}
            </span>
          )}
        </div>
      </form>
    </div>
  );
};