import { makeHealthModule } from './health/health.module.js'
import { makeAuthModule } from './auth/auth.module.js'
import { makeVisitorsModule } from './visitors/visitor.module.js'
import { makeVisitsModule } from './visits/visits.module.js'
import { makeCamerasModule } from './cameras/cameras.module.js'
import { makeRecordingsModule } from './recordings/recordings.module.js'
import { makeIdentificationModule } from './identification/identification.module.js'
import { makeAuditModule } from './audit/audit.module.js'
import { makeDashboardModule } from './dashboard/dashboard.module.js'
import { makeAuthMiddleware } from '../shared/middleware/auth.js'

/**
 * Registers all core application modules and injects dependencies.
 */
export function makeModules({ db, config, logger }) {
  const authMiddleware = makeAuthMiddleware(config.jwt.secret)

  return [
    makeHealthModule({ db, config }),
    makeAuthModule({ db, config, authMiddleware }),
    makeVisitorsModule({ db, authMiddleware }),
    makeVisitsModule({ db, authMiddleware }),
    makeCamerasModule({ db, authMiddleware }),
    makeRecordingsModule({ db, config, authMiddleware, logger }),
    makeIdentificationModule({ db, authMiddleware }),
    makeAuditModule({ db, authMiddleware }),
    makeDashboardModule({ db, authMiddleware }),
  ]
}
