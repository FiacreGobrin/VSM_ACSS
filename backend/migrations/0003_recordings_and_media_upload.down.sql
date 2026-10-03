-- =============================================================================
-- Migration Rollback: 0003_recordings_and_media_upload.up.sql
-- Reverses the recordings registry and the camera evidence back-reference.
-- =============================================================================

-- Drop the FK added to `cameras` before the table it points at.
ALTER TABLE cameras DROP COLUMN IF EXISTS last_recording_id;

DROP INDEX IF EXISTS idx_recordings_sha256_unique;
DROP INDEX IF EXISTS idx_recordings_retention_until;
DROP INDEX IF EXISTS idx_recordings_uploaded_by;
DROP INDEX IF EXISTS idx_recordings_media_kind;
DROP INDEX IF EXISTS idx_recordings_identification_id;
DROP INDEX IF EXISTS idx_recordings_zone_id;
DROP INDEX IF EXISTS idx_recordings_camera_id;
DROP INDEX IF EXISTS idx_recordings_recorded_at;

DROP TABLE IF EXISTS recordings;