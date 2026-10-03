import { BadRequestError, NotFoundError, AppError } from '../../shared/errors.js'
import { detectMediaType, assertMediaTypeAllowed } from '../../shared/media/magicBytes.js'
import { COLLECTIONS, newId, paging, safeLimit, present, toDate } from '../../shared/mongo/helpers.js'

/**
 * Evidence library for uploaded CCTV footage.
 *
 * Uploads are buffered in memory by multer (see `recordings.routes.js`) so the
 * magic bytes can be verified *before* anything is written to disk.
 *
 * Referential note: the Postgres version relied on
 * `recordings.camera_id REFERENCES cameras(id) ON DELETE SET NULL`. MongoDB does
 * not enforce foreign keys or cascades, so a camera deletion would leave
 * dangling `camera_id` values in this collection. Deleting a camera is not
 * exposed by the API today, and `ON DELETE SET NULL` semantics are preserved for
 * the fields the service does manage (it nulls `cameras.last_recording_id`).
 * If camera deletion is added later, it must explicitly clear these references.
 */
export function makeRecordingsService({ db, config, storage, logger }) {
  const uploads = config.uploads
  const recordings = db.collection(COLLECTIONS.recordings)
  const cameras = db.collection(COLLECTIONS.cameras)
  const auditLogs = db.collection(COLLECTIONS.auditLogs)

  /** Columns safe to expose. `storage_path` is deliberately absent. */
  const PUBLIC_PROJECTION = {
    _id: 0,
    id: 1,
    camera_id: 1,
    zone_id: 1,
    identification_id: 1,
    uploaded_by: 1,
    title: 1,
    description: 1,
    media_kind: 1,
    content_type: 1,
    size_bytes: 1,
    original_filename: 1,
    recorded_at: 1,
    retention_until: 1,
    created_at: 1,
    updated_at: 1,
  }

  return {
    async listRecordings({ cameraId = '', zoneId = '', mediaKind = '', limit = 50, offset = 0 } = {}) {
      const filter = {}

      if (cameraId) filter.camera_id = cameraId
      if (zoneId) filter.zone_id = zoneId

      if (mediaKind) {
        if (!['video', 'image'].includes(mediaKind)) {
          throw new BadRequestError(`Invalid mediaKind "${mediaKind}". Must be "video" or "image".`)
        }
        filter.media_kind = mediaKind
      }

      const total = await recordings.countDocuments(filter)

      const { skip, limit: take } = paging(safeLimit(limit), offset)

      const rows = await recordings
        .aggregate([
          { $match: filter },
          {
            $lookup: {
              from: COLLECTIONS.cameras,
              localField: 'camera_id',
              foreignField: 'id',
              as: '_camera',
            },
          },
          {
            $lookup: {
              from: COLLECTIONS.zones,
              localField: 'zone_id',
              foreignField: 'id',
              as: '_zone',
            },
          },
          {
            $lookup: {
              from: COLLECTIONS.users,
              localField: 'uploaded_by',
              foreignField: 'id',
              as: '_user',
            },
          },
          {
            $addFields: {
              camera_name: { $arrayElemAt: ['$_camera.name', 0] },
              zone_name: { $arrayElemAt: ['$_zone.name', 0] },
              uploaded_by_username: { $arrayElemAt: ['$_user.username', 0] },
            },
          },
          { $project: { _camera: 0, _zone: 0, _user: 0 } },
          { $sort: { recorded_at: -1, created_at: -1 } },
          { $skip: skip },
          { $limit: take },
        ])
        .toArray()

      return {
        items: rows.map(present),
        pagination: { total, limit: take, offset: skip },
      }
    },

    async getRecordingById(id) {
      const rows = await recordings
        .aggregate([
          { $match: { id } },
          {
            $lookup: {
              from: COLLECTIONS.cameras,
              localField: 'camera_id',
              foreignField: 'id',
              as: '_camera',
            },
          },
          {
            $lookup: {
              from: COLLECTIONS.zones,
              localField: 'zone_id',
              foreignField: 'id',
              as: '_zone',
            },
          },
          {
            $lookup: {
              from: COLLECTIONS.users,
              localField: 'uploaded_by',
              foreignField: 'id',
              as: '_user',
            },
          },
          {
            $addFields: {
              camera_name: { $arrayElemAt: ['$_camera.name', 0] },
              zone_name: { $arrayElemAt: ['$_zone.name', 0] },
              uploaded_by_username: { $arrayElemAt: ['$_user.username', 0] },
            },
          },
          { $project: { _camera: 0, _zone: 0, _user: 0 } },
        ])
        .toArray()

      if (rows.length === 0) {
        throw new NotFoundError(`Recording with ID ${id} not found`)
      }

      return present(rows[0])
    },
/**
     * Validates and persists one uploaded media file.
     *
     * Order matters: the buffer is classified by magic bytes first, and only a
     * file whose *content* matches an allowed container ever reaches disk.
     */
    async createRecording(payload, actorId = null) {
      const {
        file,
        cameraId = null,
        zoneId = null,
        identificationId = null,
        title,
        description = '',
        recordedAt = null,
        retentionDays = null,
      } = payload

      if (!file || !file.buffer || file.buffer.length === 0) {
        throw new BadRequestError('An uploaded media file is required', 'missing_file')
      }

      if (!title || !title.trim()) {
        throw new BadRequestError('A title is required for each recording')
      }

      const detected = detectMediaType(file.buffer)
      if (!detected) {
        throw new AppError(
          'The uploaded file is not a recognised video or image container.',
          415,
          'unsupported_media_type'
        )
      }

      const allowedTypes =
        detected.mediaKind === 'video' ? uploads.allowedVideoTypes : uploads.allowedImageTypes

      // Logged rather than rejected when the claimed type disagrees: browsers
      // mislabel QuickTime and WebM constantly, and failing them would block
      // legitimate evidence. The sniffed type wins either way.
      if (file.mimetype && file.mimetype !== detected.mimeType) {
        logger?.warn('Upload Content-Type did not match the sniffed type', {
          declared: file.mimetype,
          detected: detected.mimeType,
          filename: file.originalname,
        })
      }

      assertMediaTypeAllowed(detected, file.mimetype, allowedTypes)

      const limit = detected.mediaKind === 'video' ? uploads.maxVideoBytes : uploads.maxImageBytes
      if (file.buffer.length > limit) {
        throw new AppError(
          `File exceeds the ${Math.floor(limit / (1024 * 1024))}MB ${detected.mediaKind} limit.`,
          413,
          'file_too_large',
          { sizeBytes: file.buffer.length, maxBytes: limit }
        )
      }

      // MongoDB does not enforce foreign keys, so this explicit check replaces
      // the former `REFERENCES cameras(id)` constraint. Without it a typo would
      // silently orphan the evidence.
      if (cameraId) {
        await this.assertCameraExists(cameraId)
      }

      const stored = await storage.save({
        buffer: file.buffer,
        extension: detected.extension,
        prefix: 'recordings',
      })

      try {
        const now = new Date()
        const doc = {
          id: newId(),
          camera_id: cameraId || null,
          zone_id: zoneId || null,
          identification_id: identificationId || null,
          uploaded_by: actorId || null,
          title: title.trim(),
          description: String(description).trim(),
          media_kind: detected.mediaKind,
          content_type: detected.mimeType,
          size_bytes: stored.sizeBytes,
          duration_seconds: null,
          storage_path: stored.storedPath,
          // Operator-supplied: retained for display only, never used as a path.
          original_filename: String(file.originalname || 'recording').slice(0, 255),
          recorded_at: toDate(recordedAt) || now,
          sha256: stored.sha256,
          retention_until: retentionDays
            ? new Date(Date.now() + parseInt(retentionDays, 10) * 86_400_000)
            : null,
          created_at: now,
          updated_at: now,
        }

        await recordings.insertOne(doc)
// Keep the camera's evidence back-reference pointing at its newest clip.
        if (cameraId) {
          await cameras.updateOne(
            { id: cameraId },
            { $set: { last_recording_id: doc.id, updated_at: now } }
          )
        }

        if (actorId) {
          await auditLogs.insertOne({
            id: newId(),
            user_id: actorId,
            action: 'UPLOAD_RECORDING',
            entity_type: 'recording',
            entity_id: doc.id,
            ip_address: null,
            details: {
              title: doc.title,
              mediaKind: doc.media_kind,
              sizeBytes: doc.size_bytes,
              cameraId: cameraId || null,
              declaredType: file.mimetype || null,
              detectedType: detected.mimeType,
            },
            created_at: now,
          })
        }

        logger?.info('Recording uploaded', {
          id: doc.id,
          bytes: doc.size_bytes,
          kind: detected.mediaKind,
        })

        return present({
          id: doc.id,
          title: doc.title,
          media_kind: doc.media_kind,
          content_type: doc.content_type,
          size_bytes: doc.size_bytes,
          recorded_at: doc.recorded_at,
        })
      } catch (err) {
        // The row was not persisted, so the object on disk is unreachable
        // garbage. Remove it, otherwise a DB hiccup leaks disk space that
        // nothing can ever reclaim.
        await storage.remove(stored.storedPath).catch(() => {})
        throw err
      }
    },

    /** Deletes the registry row and the underlying object. */
    async deleteRecording(id, actorId = null) {
      const recording = await this.getRecordingById(id)

      await recordings.deleteOne({ id })

      // The row is authoritative for the object's location, so it is deleted
      // first: a failure below then leaves a missing file (recoverable by
      // re-upload) rather than a row pointing at nothing.
      const removed = await storage.remove(recording.storage_path)

      if (actorId) {
        await auditLogs.insertOne({
          id: newId(),
          user_id: actorId,
          action: 'DELETE_RECORDING',
          entity_type: 'recording',
          entity_id: id,
          ip_address: null,
          details: {
            title: recording.title,
            sizeBytes: recording.size_bytes,
            fileRemoved: removed,
          },
          created_at: new Date(),
        })
      }

      return { id, deleted: true, fileRemoved: removed }
    },

    /** Confirms a camera exists before evidence is attributed to it. */
    async assertCameraExists(cameraId) {
      const camera = await cameras.findOne({ id: cameraId }, { projection: { _id: 0, id: 1 } })
      if (!camera) {
        throw new NotFoundError(`Camera with ID ${cameraId} not found`)
      }
      return camera
    },
  }
}