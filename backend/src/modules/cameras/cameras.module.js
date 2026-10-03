import { makeCamerasService } from './cameras.service.js'
import { makeCamerasController } from './cameras.controller.js'
import { makeCamerasRoutes } from './cameras.routes.js'

export function makeCamerasModule({ db, authMiddleware }) {
  const camerasService = makeCamerasService({ db })
  const controller = makeCamerasController({ camerasService })
  const router = makeCamerasRoutes({ controller, authMiddleware })

  return {
    name: 'cameras',
    mount: '/api/v1/cameras',
    router,
  }
}
