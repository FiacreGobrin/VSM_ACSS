import { defineCollection, schema, index } from './_helpers.js'

/**
 * Migration 0003 - CCTV evidence library.
 *
 * Replaces `0003_recordings_and_media_upload.up.sql`: the `recordings`
 * registry plus the `cameras.last_recording_id` back-reference.
 *
 * Only the metadata lives in MongoDB. The clip bytes are written to the API
 * host's upload volume by `platform/storage/localDiskStorage.js`, because a
 * 500MB video has no business inside a document store.
 */

const uuid = { bsonType: 'string', description: 'UUID primary key (generated in app code)' };

export async function up(db) {
  await defineCollection(db, 'recordings', {
    validator: schema({
      required: ['id', 'title', 'media_kind', 'content_type', 'size_bytes', 'storage_path'],
      properties: {
        id: uuid,
        // References are plain UUID strings. MongoDB does not enforce foreign
        // keys, so the service layer validates these before writing - see the
        // ON DELETE SET NULL semantics note in the service.
        camera_id: { bsonType: ['string', 'null'] },
        zone_id: { bsonType: ['string', 'null'] },
        identification_id: { bsonType: ['string', 'null'] },
        uploaded_by: { bsonType: ['string', 'null'] },
        title: { bsonType: 'string' },
        description: { bsonType: 'string' },
        media_kind: { enum: ['video', 'image'] },
        content_type: { bsonType: 'string' },
        // BIGINT -> number; clips are bounded by UPLOAD_MAX_VIDEO_BYTES, well
        // inside the safe-integer range.
        size_bytes: { bsonType: ['int', 'long', 'double'], minimum: 1 },
        duration_seconds: { bsonType: ['double', 'null'] },
        storage_path: { bsonType: 'string' },
        original_filename: { bsonType: 'string' },
        recorded_at: { bsonType: 'date' },
        sha256: { bsonType: ['string', 'null'] },
        retention_until: { bsonType: ['date', 'null'] },
        created_at: { bsonType: 'date' },
        updated_at: { bsonType: 'date' },
      },
    }),
  });

  // The console sorts newest-capture-first, so recorded_at leads the index.
  await index(db, 'recordings', { recorded_at: -1 }, { name: 'idx_recordings_recorded_at' });
  await index(db, 'recordings', { camera_id: 1 }, { name: 'idx_recordings_camera_id' });
  await index(db, 'recordings', { zone_id: 1 }, { name: 'idx_recordings_zone_id' });
  await index(db, 'recordings', { identification_id: 1 }, { name: 'idx_recordings_identification_id' });
  await index(db, 'recordings', { media_kind: 1 }, { name: 'idx_recordings_media_kind' });
  await index(db, 'recordings', { uploaded_by: 1 }, { name: 'idx_recordings_uploaded_by' });
  await index(
    db,
    'recordings',
    { retention_until: 1 },
    { name: 'idx_recordings_retention_until', partialFilterExpression: { retention_until: { $type: 'date' } } }
  );

  // A device re-uploading the same clip is a duplicate ingest. Partial on
  // `sha256` so rows that predate hashing are never flagged as duplicates.
  await index(
    db,
    'recordings',
    { sha256: 1 },
    { unique: true, name: 'idx_recordings_sha256_unique', partialFilterExpression: { sha256: { $type: 'string' } } }
  );
  await index(db, 'recordings', { id: 1 }, { unique: true, name: 'idx_recordings_id' });

  // ------------------------------- cameras.last_recording_id back-reference
  // ALTER TABLE cameras ADD COLUMN -> widen the validator to permit the field.
  await defineCollection(db, 'cameras', {
    validator: schema({
      required: ['id', 'name', 'stream_url', 'status'],
      properties: {
        id: uuid,
        name: { bsonType: 'string' },
        zone_id: { bsonType: ['string', 'null'] },
        ip_address: { bsonType: ['string', 'null'] },
        stream_url: { bsonType: 'string' },
        model: { bsonType: 'string' },
        status: { enum: ['online', 'offline', 'maintenance'] },
        ai_features_enabled: { bsonType: 'bool' },
        last_heartbeat_at: { bsonType: ['date', 'null'] },
        last_recording_id: { bsonType: ['string', 'null'] },
        created_at: { bsonType: 'date' },
        updated_at: { bsonType: 'date' },
      },
    }),
  });
  await index(db, 'cameras', { last_recording_id: 1 }, { name: 'idx_cameras_last_recording_id' });
}

export async function down(db) {
  await db.collection('cameras').dropIndex('idx_cameras_last_recording_id').catch(() => {});
  await db
    .collection('cameras')
    .updateMany({}, { $unset: { last_recording_id: '' } })
    .catch(() => {});

  const exists = await db.listCollections({ name: 'recordings' }, { nameOnly: true }).hasNext();
  if (exists) await db.collection('recordings').drop();
}