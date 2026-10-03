import { sendSuccess, sendCreated } from '../../shared/http/respond.js'

export function makeIdentificationController({ identificationService }) {
  return {
    async recordDetection(req, res, next) {
      try {
        const actorId = req.user ? req.user.id : null
        const result = await identificationService.recordDetection(req.body, actorId)
        sendCreated(res, result)
      } catch (err) {
        next(err)
      }
    },

    async listDetections(req, res, next) {
      try {
        const { cameraId, visitorId, eventType } = req.query
        const limit = parseInt(req.query.limit || '50', 10)
        const offset = parseInt(req.query.offset || '0', 10)

        const result = await identificationService.listDetections({
          cameraId,
          visitorId,
          eventType,
          limit,
          offset,
        })
        sendSuccess(res, result.items, result.pagination)
      } catch (err) {
        next(err)
      }
    },

    async listAlerts(req, res, next) {
      try {
        const { isAcknowledged, severity } = req.query
        const limit = parseInt(req.query.limit || '50', 10)
        const offset = parseInt(req.query.offset || '0', 10)

        const result = await identificationService.listAlerts({
          isAcknowledged,
          severity,
          limit,
          offset,
        })
        sendSuccess(res, result.items, result.pagination)
      } catch (err) {
        next(err)
      }
    },

    async acknowledgeAlert(req, res, next) {
      try {
        const actorId = req.user.id
        const alert = await identificationService.acknowledgeAlert(req.params.id, actorId)
        sendSuccess(res, alert)
      } catch (err) {
        next(err)
      }
    },
  }
}
