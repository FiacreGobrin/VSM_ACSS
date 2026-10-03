import { makeAuditController } from './audit.controller.js'
import { makeAuditRoutes } from './audit.routes.js'

export function makeAuditModule({ db, authMiddleware }) {
  const controller = makeAuditController({ db })
  const router = makeAuditRoutes({ controller, authMiddleware })

  return {
    name: 'audit',
    mount: '/api/v1/audit',
    router,
  }
}
