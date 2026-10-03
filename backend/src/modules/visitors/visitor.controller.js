import { sendSuccess, sendCreated } from '../../shared/http/respond.js'

export function makeVisitorController({ visitorService }) {
  return {
    async create(req, res, next) {
      try {
        const actorId = req.user ? req.user.id : null
        const visitor = await visitorService.createVisitor(req.body, actorId)
        sendCreated(res, visitor, `/api/v1/visitors/${visitor.id}`)
      } catch (err) {
        next(err)
      }
    },

    async list(req, res, next) {
      try {
        const query = req.query.q || ''
        const status = req.query.status || ''
        const limit = parseInt(req.query.limit || '50', 10)
        const offset = parseInt(req.query.offset || '0', 10)

        const result = await visitorService.listVisitors({ query, status, limit, offset })
        sendSuccess(res, result.items, result.pagination)
      } catch (err) {
        next(err)
      }
    },

    async getById(req, res, next) {
      try {
        const visitor = await visitorService.getVisitorById(req.params.id)
        sendSuccess(res, visitor)
      } catch (err) {
        next(err)
      }
    },

    async update(req, res, next) {
      try {
        const actorId = req.user ? req.user.id : null
        const visitor = await visitorService.updateVisitor(req.params.id, req.body, actorId)
        sendSuccess(res, visitor)
      } catch (err) {
        next(err)
      }
    },

    async updateStatus(req, res, next) {
      try {
        const actorId = req.user ? req.user.id : null
        const { status, notes } = req.body
        const visitor = await visitorService.updateStatus(req.params.id, status, notes, actorId)
        sendSuccess(res, visitor)
      } catch (err) {
        next(err)
      }
    },
  }
}
