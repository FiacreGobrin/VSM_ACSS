import { Router } from 'express'

export function makeIdentificationRoutes({ controller, authMiddleware }) {
  const router = Router()

  // Detection ingestion (allows authenticated operators or camera AI microservices)
  // optionalAuthenticate allows local camera gateways to send frames or use service token
  router.post(
    '/detections',
    authMiddleware.optionalAuthenticate,
    controller.recordDetection
  )

  // Protected operational routes
  router.get(
    '/detections',
    authMiddleware.authenticate,
    controller.listDetections
  )

  router.get(
    '/alerts',
    authMiddleware.authenticate,
    controller.listAlerts
  )

  router.post(
    '/alerts/:id/acknowledge',
    authMiddleware.authenticate,
    authMiddleware.authorize('admin', 'operator', 'guard'),
    controller.acknowledgeAlert
  )

  return router
}
