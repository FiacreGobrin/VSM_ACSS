import { makeVisitorService } from './visitor.service.js'
import { makeVisitorController } from './visitor.controller.js'
import { makeVisitorRoutes } from './visitor.routes.js'

export function makeVisitorsModule({ db, authMiddleware }) {
  const visitorService = makeVisitorService({ db })
  const controller = makeVisitorController({ visitorService })
  const router = makeVisitorRoutes({ controller, authMiddleware })

  return {
    name: 'visitors',
    mount: '/api/v1/visitors',
    router,
  }
}
