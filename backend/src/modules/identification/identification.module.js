import { makeIdentificationService } from './identification.service.js'
import { makeIdentificationController } from './identification.controller.js'
import { makeIdentificationRoutes } from './identification.routes.js'

export function makeIdentificationModule({ db, authMiddleware }) {
  const identificationService = makeIdentificationService({ db })
  const controller = makeIdentificationController({ identificationService })
  const router = makeIdentificationRoutes({ controller, authMiddleware })

  return {
    name: 'identification',
    mount: '/api/v1/identification',
    router,
  }
}
