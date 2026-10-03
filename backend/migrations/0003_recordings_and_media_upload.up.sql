-- =============================================================================
-- Migration: 0003_recordings_and_media_upload.up.sql
-- Description: Adds an evidence/recording registry so CCTV video clips and
--              reference stills can be uploaded from the console and retained
--              under a governed retention policy.
--              Binary payloads live on the API host (see `uploads` config);
--              this table is the authoritative index over them.
-- Target Database: Neon Serverless PostgreSQL
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. RECORDINGS (Uploaded CCTV Footage & Evidence Still Frames)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recordings (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Ownership / provenance. All references are nullable and cascade so that
    -- deleting an upstream camera, zone or detection does not orphan the file
    -- row: the evidence itself must outlive the registration that produced it.
    camera_id          UUID REFERENCES cameras(id) ON DELETE SET NULL,
    zone_id            UUID REFERENCES zones(id) ON DELETE SET NULL,
    identification_id  UUID REFERENCES identifications(id) ON DELETE SET NULL,
    uploaded_by        UUID REFERENCES users(id) ON DELETE SET NULL,

    title              TEXT NOT NULL,
    description        TEXT NOT NULL DEFAULT '',

    -- Media classification. `media_kind` is denormalised from the sniffed
    -- MIME type so the console can render a <video> vs an <img> without
    -- re-parsing content_type on every row.
    media_kind         TEXT NOT NULL CHECK (media_kind IN ('video', 'image')),
    content_type       TEXT NOT NULL,
    size_bytes         BIGINT NOT NULL CHECK (size_bytes > 0),
    duration_seconds   NUMERIC(10, 3),

    -- Path is relative to the configured upload root. Storing it relative keeps
    -- the deployment directory movable (air-gapped appliances are re-imaged).
    storage_path       TEXT NOT NULL,
    original_filename  TEXT NOT NULL,

    -- Evidence-grade provenance. The upload window is operator-asserted and
    -- must not be trusted for ordering or forensics; `recorded_at` is the
    -- authoritative capture time.
    recorded_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    sha256             TEXT,
    retention_until    TIMESTAMPTZ,

    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The console lists clips newest-first and filters by camera, so the sort
-- column leads the composite index for that access path.
CREATE INDEX IF NOT EXISTS idx_recordings_recorded_at ON recordings (recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_recordings_camera_id ON recordings (camera_id);
CREATE INDEX IF NOT EXISTS idx_recordings_zone_id ON recordings (zone_id);
CREATE INDEX IF NOT EXISTS idx_recordings_identification_id ON recordings (identification_id);
CREATE INDEX IF NOT EXISTS idx_recordings_media_kind ON recordings (media_kind);
CREATE INDEX IF NOT EXISTS idx_recordings_uploaded_by ON recordings (uploaded_by);

-- Supports the retention sweeper, which scans for rows whose hold has expired.
CREATE INDEX IF NOT EXISTS idx_recordings_retention_until ON recordings (retention_until)
    WHERE retention_until IS NOT NULL;

-- A device re-uploading the same clip is a duplicate ingest, not new evidence.
-- sha256 is nullable because older rows may predate hashing; Postgres treats
-- NULLs as distinct, so those rows are never falsely flagged as duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS idx_recordings_sha256_unique
    ON recordings (sha256)
    WHERE sha256 IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. EVIDENCE LINKAGE
-- `cameras` stores a single `stream_url` (the live RTSP feed). Operators also
-- need to point at specific retained clips when triaging an incident, so the
-- live feed gains an optional back-reference to the evidence library.
-- -----------------------------------------------------------------------------
ALTER TABLE cameras ADD COLUMN IF NOT EXISTS last_recording_id UUID REFERENCES recordings(id) ON DELETE SET NULL;