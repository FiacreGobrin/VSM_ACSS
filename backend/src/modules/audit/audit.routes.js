import { Router } from 'express'

export function makeAuditRoutes({ controller, authMiddleware }) {
  const router = Router()

  router.use(authMiddleware.authenticate)
  // Only admins and auditors can review security audit logs
  router.get('/', authMiddleware.authorize('admin', 'auditor'), controller.list)

  return router
}
