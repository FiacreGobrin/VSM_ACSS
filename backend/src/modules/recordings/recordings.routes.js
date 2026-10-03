import { Router } from 'express'
import multer from 'multer'
import { AppError, BadRequestError } from '../../shared/errors.js'

/**
 * Builds the multipart parser for evidence uploads.
 *
 * `memoryStorage` is a deliberate choice over disk storage: the service must
 * inspect the magic bytes before anything is persisted, and holding the file in
 * memory means a rejected upload never touches the filesystem at all. The cost
 * is RAM proportional to the request, which is why `maxVideoBytes` and
 * `maxFiles` are enforced here as a first line of defence - multer aborts the
 * stream as soon as the limit is passed rather than after buffering everything.
 */
function makeUploadMiddleware(config) {
  const uploads = config.uploads

  const uploader = multer({
    storage: multer.memoryStorage(),
    limits: {
      // The larger of the two caps: multer must tolerate a max-size video, and
      // the finer per-kind limit is enforced once the type is known.
      fileSize: uploads.maxVideoBytes,
      files: uploads.maxFiles,
      fields: 20,
    },
  })

  return function singleUpload(req, res, next) {
    uploader.single('file')(req, res, (err) => {
      if (!err) return next()

      // Translate multer's own errors into the API's standard envelope so the
      // console receives the same `{ success, error: { code } }` shape it sees
      // from every other endpoint, rather than a raw framework message.
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppError(
              `Upload exceeds the ${Math.floor(uploads.maxVideoBytes / (1024 * 1024))}MB limit.`,
              413,
              'file_too_large'
            )
          )
        }
        if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(
            new BadRequestError(
              `Upload accepts a single file field named "file" (${err.message}).`,
              'invalid_upload'
            )
          )
        }
        return next(new BadRequestError(`Malformed upload: ${err.message}`, 'invalid_upload'))
      }

      return next(err)
    })
  }
}

export function makeRecordingsRoutes({ controller, authMiddleware, config }) {
  const router = Router()

  router.use(authMiddleware.authenticate)

  router.get('/', controller.list)
  // Streamed rather than statically mounted: see `controller.stream`.
  // Declared before `/:id` so the literal segment wins by intent rather than by
  // Express' first-match rule.
  router.get('/:id/stream', controller.stream)
  router.get('/:id', controller.getById)

  router.post(
    '/',
    authMiddleware.authorize('admin', 'operator'),
    makeUploadMiddleware(config),
    controller.upload
  )

  router.delete('/:id', authMiddleware.authorize('admin'), controller.remove)

  return router
}