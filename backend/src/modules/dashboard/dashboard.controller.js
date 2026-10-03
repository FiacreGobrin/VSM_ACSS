import { sendSuccess } from '../../shared/http/respond.js'

export function makeDashboardController({ dashboardService }) {
  return {
    async summary(req, res, next) {
      try {
        const summary = await dashboardService.getSummary()
        sendSuccess(res, summary)
      } catch (err) {
        next(err)
      }
    },
  }
}