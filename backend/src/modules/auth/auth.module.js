import { makeAuthService } from './auth.service.js'
import { makeAuthController } from './auth.controller.js'
import { makeAuthRoutes } from './auth.routes.js'

export function makeAuthModule({ db, config, authMiddleware }) {
  const authService = makeAuthService({ db, config })
  const controller = makeAuthController({ authService })
  const router = makeAuthRoutes({ controller, authMiddleware })

  return {
    name: 'auth',
    mount: '/api/v1/auth',
    router,
  }
}
