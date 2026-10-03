import { Router } from 'express'

export function makeAuthRoutes({ controller, authMiddleware }) {
  const router = Router()

  // Public endpoints
  router.post('/login', controller.login)
  router.post('/register', controller.register)

  // Protected endpoints
  router.get('/me', authMiddleware.authenticate, controller.me)

  // Operator & role registry (Administration console).
  // Administrators and auditors may review the registry; auditors stay read-only.
  router.get('/users', authMiddleware.authenticate, authMiddleware.authorize('admin', 'auditor'), controller.listUsers)

  return router
}
