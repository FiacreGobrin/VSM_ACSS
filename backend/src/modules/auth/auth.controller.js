import { sendSuccess, sendCreated } from '../../shared/http/respond.js'

export function makeAuthController({ authService }) {
  return {
    async register(req, res, next) {
      try {
        const user = await authService.register(req.body)
        sendCreated(res, user)
      } catch (err) {
        next(err)
      }
    },

    async login(req, res, next) {
      try {
        const result = await authService.login(req.body)
        sendSuccess(res, result)
      } catch (err) {
        next(err)
      }
    },

    async me(req, res, next) {
      try {
        const profile = await authService.getMe(req.user.id)
        sendSuccess(res, profile)
      } catch (err) {
        next(err)
      }
    },

    /**
     * Operator & role registry for the System Administration console.
     */
    async listUsers(req, res, next) {
      try {
        const users = await authService.listUsers({
          role: req.query.role || '',
          q: req.query.q || '',
        })
        sendSuccess(res, users)
      } catch (err) {
        next(err)
      }
    },
  }
}
