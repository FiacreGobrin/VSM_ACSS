import { Router } from 'express'

export function makeVisitorRoutes({ controller, authMiddleware }) {
  const router = Router()

  // Authenticated routes
  router.use(authMiddleware.authenticate)

  router.post('/', authMiddleware.authorize('admin', 'operator', 'guard'), controller.create)
  router.get('/', controller.list)
  router.get('/:id', controller.getById)
  router.put('/:id', authMiddleware.authorize('admin', 'operator'), controller.update)
  router.patch('/:id/status', authMiddleware.authorize('admin', 'operator', 'guard'), controller.updateStatus)

  return router
}
