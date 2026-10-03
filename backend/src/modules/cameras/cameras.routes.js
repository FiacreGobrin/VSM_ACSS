import { Router } from 'express'

export function makeCamerasRoutes({ controller, authMiddleware }) {
  const router = Router()

  router.use(authMiddleware.authenticate)

  // Zones
  router.get('/zones', controller.listZones)
  router.post('/zones', authMiddleware.authorize('admin', 'operator'), controller.createZone)

  // Cameras
  router.get('/', controller.list)
  router.post('/', authMiddleware.authorize('admin'), controller.register)
  router.get('/:id', controller.getById)
  router.post('/:id/heartbeat', controller.heartbeat)

  return router
}
