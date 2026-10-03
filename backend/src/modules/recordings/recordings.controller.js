import { sendSuccess, sendCreated } from '../../shared/http/respond.js'
import { AppError } from '../../shared/errors.js'

/**
 * Parses a single-range HTTP `Range` header against a known file size.
 *
 * Browsers issue these constantly while seeking in a `<video>` element. Serving
 * 200 with the whole body instead of 206 makes seeking restart from zero, which
 * on a multi-hundred-megabyte CCTV clip is unusable.
 *
 * Only the `bytes=` single-range form is supported; multipart ranges are
 * refused because no browser requests them for progressive playback.
 */
function parseRangeHeader(header, sizeBytes) {
  if (!header) return null

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return { invalid: true }

  const [, rawStart, rawEnd] = match

  // Suffix form: `bytes=-500` means the final 500 bytes.
  if (rawStart === '') {
    if (rawEnd === '') return { invalid: true }
    const length = parseInt(rawEnd, 10)
    if (!Number.isFinite(length) || length <= 0) return { invalid: true }
    const start = Math.max(0, sizeBytes - length)
    return { start, end: sizeBytes - 1 }
  }

  const start = parseInt(rawStart, 10)
  if (!Number.isFinite(start) || start >= sizeBytes) return { invalid: true }

  // An omitted end means "through the last byte".
  const end = rawEnd === '' ? sizeBytes - 1 : parseInt(rawEnd, 10)
  if (!Number.isFinite(end) || end < start) return { invalid: true }

  return { start, end: Math.min(end, sizeBytes - 1) }
}

export function makeRecordingsController({ recordingsService, storage }) {
  return {
    async list(req, res, next) {
      try {
        const limit = parseInt(req.query.limit || '50', 10)
        const offset = parseInt(req.query.offset || '0', 10)

        const result = await recordingsService.listRecordings({
          cameraId: req.query.cameraId || '',
          zoneId: req.query.zoneId || '',
          mediaKind: req.query.mediaKind || '',
          limit,
          offset,
        })

        sendSuccess(res, result.items, result.pagination)
      } catch (err) {
        next(err)
      }
    },

    async getById(req, res, next) {
      try {
        const recording = await recordingsService.getRecordingById(req.params.id)
        sendSuccess(res, recording)
      } catch (err) {
        next(err)
      }
    },

    async upload(req, res, next) {
      try {
        const actorId = req.user ? req.user.id : null

        // Multer leaves this undefined when no `file` part was sent; the
        // service turns that into a 400 rather than a crash.
        const recording = await recordingsService.createRecording(
          {
            file: req.file,
            cameraId: req.body.cameraId || null,
            zoneId: req.body.zoneId || null,
            identificationId: req.body.identificationId || null,
            title: req.body.title,
            description: req.body.description,
            recordedAt: req.body.recordedAt || null,
            retentionDays: req.body.retentionDays || null,
          },
          actorId
        )

        sendCreated(res, recording, `/api/v1/recordings/${recording.id}`)
      } catch (err) {
        next(err)
      }
    },

    /**
     * Streams the media object with range support.
     *
     * Playback goes through this authenticated endpoint rather than a static
     * mount: a plain `express.static` route would expose every clip on the
     * appliance to anyone who could reach the port, bypassing both the JWT
     * check and the audit trail.
     */
    async stream(req, res, next) {
      try {
        const recording = await recordingsService.getRecordingById(req.params.id)

        const stats = await storage.stat(recording.storage_path)
        if (!stats) {
          // The row outlived its object (e.g. a retention sweep removed the
          // file first). 410 is more honest than 404 - the evidence existed.
          throw new AppError(
            'The media file for this recording is no longer available on the storage volume.',
            410,
            'media_unavailable'
          )
        }

        const { sizeBytes } = stats
        const range = parseRangeHeader(req.headers.range, sizeBytes)

        if (range && range.invalid) {
          res.setHeader('Content-Range', `bytes */${sizeBytes}`)
          return res.status(416).end()
        }

        res.setHeader('Content-Type', recording.content_type)
        res.setHeader('Accept-Ranges', 'bytes')
        res.setHeader('Cache-Control', 'private, max-age=300')
        // Defence in depth: the bytes were already verified on upload, but
        // serving them under a strict CSP stops a maliciously crafted file from
        // executing script in the console's origin if it is opened directly.
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")

        const disposition = req.query.download === '1' ? 'attachment' : 'inline'
        res.setHeader(
          'Content-Disposition',
          `${disposition}; filename="${encodeURIComponent(recording.original_filename)}"`
        )

        if (range) {
          res.status(206)
          res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${sizeBytes}`)
          res.setHeader('Content-Length', range.end - range.start + 1)
          const stream = storage.createReadStream(recording.storage_path, {
            start: range.start,
            end: range.end,
          })
          return stream.pipe(res)
        }

        res.setHeader('Content-Length', sizeBytes)
        return storage.createReadStream(recording.storage_path).pipe(res)
      } catch (err) {
        next(err)
      }
    },

    async remove(req, res, next) {
      try {
        const actorId = req.user ? req.user.id : null
        const result = await recordingsService.deleteRecording(req.params.id, actorId)
        sendSuccess(res, result)
      } catch (err) {
        next(err)
      }
    },
  }
}
