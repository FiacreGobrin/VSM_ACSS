import { makeDashboardService } from './dashboard.service.js'
import { makeDashboardController } from './dashboard.controller.js'
import { makeDashboardRoutes } from './dashboard.routes.js'

export function makeDashboardModule({ db, authMiddleware }) {
  const dashboardService = makeDashboardService({ db })
  const controller = makeDashboardController({ dashboardService })
  const router = makeDashboardRoutes({ controller, authMiddleware })

  return {
    name: 'dashboard',
    mount: '/api/v1/dashboard',
    router,
  }
}