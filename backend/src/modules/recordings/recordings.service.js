import { BadRequestError, NotFoundError, AppError } from '../../shared/errors.js'
import { detectMediaType, assertMediaTypeAllowed } from '../../shared/media/magicBytes.js'

/**
 * Evidence library for uploaded CCTV footage.
 *
 * Uploads are buffered in memory by multer (see `recordings.routes.js`) so the
 * magic bytes can be verified *before* anything is written to disk. That is the
 * whole reason for the buffering approach: a stream straight to the filesystem
 * would have to be un-linked after the fact if the content turned out to be a
 * renamed executable.
 */
export function makeRecordingsService({ db, config, storage, logger }) {
  const uploads = config.uploads

  /**
   * Columns safe to expose. `storage_path` is deliberately absent: it reveals
   * the on-disk layout to any operator and has no business in a list response.
   */
  const PUBLIC_COLUMNS = `
    r.id, r.camera_id, r.zone_id, r.identification_id, r.uploaded_by,
    r.title, r.description, r.media_kind, r.content_type, r.size_bytes,
    r.original_filename, r.recorded_at, r.retention_until, r.created_at, r.updated_at
  `

  return {
    async listRecordings({ cameraId = '', zoneId = '', mediaKind = '', limit = 50, offset = 0 } = {}) {
      const conditions = []
      const params = []

      if (cameraId) {
        params.push(cameraId)
        conditions.push(`r.camera_id = $${params.length}`)
      }

      if (zoneId) {
        params.push(zoneId)
        conditions.push(`r.zone_id = $${params.length}`)
      }

      if (mediaKind) {
        if (!['video', 'image'].includes(mediaKind)) {
          throw new BadRequestError(`Invalid mediaKind "${mediaKind}". Must be "video" or "image".`)
        }
        params.push(mediaKind)
        conditions.push(`r.media_kind = $${params.length}`)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const totalRes = await db.query(
        `SELECT count(*)::int as total FROM recordings r ${whereClause}`,
        params
      )

      params.push(limit)
      const limitIndex = params.length
      params.push(offset)
      const offsetIndex = params.length

      const dataRes = await db.query(
        `SELECT ${PUBLIC_COLUMNS},
                c.name as camera_name,
                z.name as zone_name,
                u.username as uploaded_by_username
         FROM recordings r
         LEFT JOIN cameras c ON r.camera_id = c.id
         LEFT JOIN zones   z ON r.zone_id = z.id
         LEFT JOIN users   u ON r.uploaded_by = u.id
         ${whereClause}
         ORDER BY r.recorded_at DESC, r.created_at DESC
         LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
        params
      )

      return {
        items: dataRes.rows,
        pagination: { total: totalRes.rows[0].total, limit, offset },
      }
    },

    async getRecordingById(id) {
      const result = await db.query(
        `SELECT ${PUBLIC_COLUMNS},
                r.storage_path,
                c.name as camera_name,
                z.name as zone_name,
                u.username as uploaded_by_username
         FROM recordings r
         LEFT JOIN cameras c ON r.camera_id = c.id
         LEFT JOIN zones   z ON r.zone_id = z.id
         LEFT JOIN users   u ON r.uploaded_by = u.id
         WHERE r.id = $1`,
        [id]
      )

      if (result.rows.length === 0) {
        throw new NotFoundError(`Recording with ID ${id} not found`)
      }

      return result.rows[0]
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

      // An explicit camera must exist before the row references it, otherwise the
      // operator gets an opaque FK violation from deep inside the driver.
      if (cameraId) {
        await this.assertCameraExists(cameraId)
      }

      const stored = await storage.save({
        buffer: file.buffer,
        extension: detected.extension,
        prefix: 'recordings',
      })

      try {
        const retentionUntil = retentionDays
          ? new Date(Date.now() + parseInt(retentionDays, 10) * 86_400_000).toISOString()
          : null

        const result = await db.query(
          `INSERT INTO recordings (
             camera_id, zone_id, identification_id, uploaded_by,
             title, description, media_kind, content_type, size_bytes,
             storage_path, original_filename, recorded_at, sha256, retention_until
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                     COALESCE($12::timestamptz, now()), $13, $14)
           RETURNING id, title, media_kind, content_type, size_bytes, recorded_at`,
          [
            cameraId || null,
            zoneId || null,
            identificationId || null,
            actorId || null,
            title.trim(),
            String(description).trim(),
            detected.mediaKind,
            detected.mimeType,
            stored.sizeBytes,
            stored.storedPath,
            // Operator-supplied: retained for display only, never used as a path.
            String(file.originalname || 'recording').slice(0, 255),
            recordedAt || null,
            stored.sha256,
            retentionUntil,
          ]
        )

        const recording = result.rows[0]

        // Keep the camera's evidence back-reference pointing at its newest clip.
        if (cameraId) {
          await db.query(
            'UPDATE cameras SET last_recording_id = $1, updated_at = now() WHERE id = $2',
            [recording.id, cameraId]
          )
        }

        if (actorId) {
          await db.query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
             VALUES ($1, 'UPLOAD_RECORDING', 'recording', $2, $3)`,
            [
              actorId,
              recording.id,
              JSON.stringify({
                title: recording.title,
                mediaKind: recording.media_kind,
                sizeBytes: stored.sizeBytes,
                cameraId: cameraId || null,
                declaredType: file.mimetype || null,
                detectedType: detected.mimeType,
              }),
            ]
          )
        }

        logger?.info('Recording uploaded', {
          id: recording.id,
          bytes: stored.sizeBytes,
          kind: detected.mediaKind,
        })

        return recording
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

      await db.query('DELETE FROM recordings WHERE id = $1', [id])

      // The row is authoritative for the object's location, so it is deleted
      // first: a failure below then leaves a missing file (recoverable by
      // re-upload) rather than a row pointing at nothing.
      const removed = await storage.remove(recording.storage_path)

      if (actorId) {
        await db.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
           VALUES ($1, 'DELETE_RECORDING', 'recording', $2, $3)`,
          [
            actorId,
            id,
            JSON.stringify({
              title: recording.title,
              sizeBytes: recording.size_bytes,
              fileRemoved: removed,
            }),
          ]
        )
      }

      return { id, deleted: true, fileRemoved: removed }
    },

    /** Confirms a camera exists before evidence is attributed to it. */
    async assertCameraExists(cameraId) {
      const result = await db.query('SELECT id FROM cameras WHERE id = $1', [cameraId])
      if (result.rows.length === 0) {
        throw new NotFoundError(`Camera with ID ${cameraId} not found`)
      }
      return result.rows[0]
    },
  }
}
