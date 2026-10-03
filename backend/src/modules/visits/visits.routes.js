import { Router } from 'express'

export function makeVisitsRoutes({ controller, authMiddleware }) {
  const router = Router()

  router.use(authMiddleware.authenticate)

  router.post('/', authMiddleware.authorize('admin', 'operator', 'guard'), controller.create)
  router.get('/', controller.list)
  router.post('/:id/check-in', authMiddleware.authorize('admin', 'operator', 'guard'), controller.checkIn)
  router.post('/:id/check-out', authMiddleware.authorize('admin', 'operator', 'guard'), controller.checkOut)

  return router
}
