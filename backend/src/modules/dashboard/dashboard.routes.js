import { Router } from 'express'

export function makeDashboardRoutes({ controller, authMiddleware }) {
  const router = Router()

  router.use(authMiddleware.authenticate)

  // Operational counters for the SOC landing page.
  router.get('/summary', controller.summary)

  return router
}