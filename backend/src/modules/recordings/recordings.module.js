import { makeLocalDiskStorage } from '../../platform/storage/localDiskStorage.js'
import { makeRecordingsService } from './recordings.service.js'
import { makeRecordingsController } from './recordings.controller.js'
import { makeRecordingsRoutes } from './recordings.routes.js'

export function makeRecordingsModule({ db, config, authMiddleware, logger }) {
  // Constructed per-process rather than per-request: the adapter holds no
  // per-upload state, only the resolved upload root.
  const storage = makeLocalDiskStorage({ uploadDir: config.uploads.dir, logger })

  // Create the volume up front so a misconfigured UPLOAD_DIR fails loudly at
  // boot rather than on an operator's first upload.
  storage.ensureReady().catch((err) => {
    logger.error(`Unable to prepare the media upload directory at ${config.uploads.dir}:`, {
      error: err.message,
    })
  })

  const recordingsService = makeRecordingsService({ db, config, storage, logger })
  const controller = makeRecordingsController({ recordingsService, storage })
  const router = makeRecordingsRoutes({ controller, authMiddleware, config })

  return {
    name: 'recordings',
    mount: '/api/v1/recordings',
    router,
  }
}