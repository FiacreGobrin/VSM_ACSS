import { sendSuccess, sendCreated } from '../../shared/http/respond.js'

export function makeVisitsController({ visitsService }) {
  return {
    async create(req, res, next) {
      try {
        const actorId = req.user ? req.user.id : null
        const visit = await visitsService.createVisit(req.body, actorId)
        sendCreated(res, visit, `/api/v1/visits/${visit.id}`)
      } catch (err) {
        next(err)
      }
    },

    async checkIn(req, res, next) {
      try {
        const actorId = req.user ? req.user.id : null
        const visit = await visitsService.checkIn(req.params.id, req.body, actorId)
        sendSuccess(res, visit)
      } catch (err) {
        next(err)
      }
    },

    async checkOut(req, res, next) {
      try {
        const actorId = req.user ? req.user.id : null
        const visit = await visitsService.checkOut(req.params.id, actorId)
        sendSuccess(res, visit)
      } catch (err) {
        next(err)
      }
    },

    async list(req, res, next) {
      try {
        const status = req.query.status || ''
        const visitorId = req.query.visitorId || ''
        const limit = parseInt(req.query.limit || '50', 10)
        const offset = parseInt(req.query.offset || '0', 10)

        const result = await visitsService.listVisits({ status, visitorId, limit, offset })
        sendSuccess(res, result.items, result.pagination)
      } catch (err) {
        next(err)
      }
    },
  }
}
