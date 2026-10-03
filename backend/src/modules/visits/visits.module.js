import { makeVisitsService } from './visits.service.js'
import { makeVisitsController } from './visits.controller.js'
import { makeVisitsRoutes } from './visits.routes.js'

export function makeVisitsModule({ db, authMiddleware }) {
  const visitsService = makeVisitsService({ db })
  const controller = makeVisitsController({ visitsService })
  const router = makeVisitsRoutes({ controller, authMiddleware })

  return {
    name: 'visits',
    mount: '/api/v1/visits',
    router,
  }
}
