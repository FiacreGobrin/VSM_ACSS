import { sendSuccess, sendCreated } from '../../shared/http/respond.js'

export function makeCamerasController({ camerasService }) {
  return {
    // --- Zones ---
    async listZones(req, res, next) {
      try {
        const zones = await camerasService.listZones()
        sendSuccess(res, zones)
      } catch (err) {
        next(err)
      }
    },

    async createZone(req, res, next) {
      try {
        const actorId = req.user ? req.user.id : null
        const zone = await camerasService.createZone(req.body, actorId)
        sendCreated(res, zone, `/api/v1/cameras/zones/${zone.id}`)
      } catch (err) {
        next(err)
      }
    },

    // --- Cameras ---
    async list(req, res, next) {
      try {
        const { zoneId, status } = req.query
        const cameras = await camerasService.listCameras({ zoneId, status })
        sendSuccess(res, cameras)
      } catch (err) {
        next(err)
      }
    },

    async getById(req, res, next) {
      try {
        const camera = await camerasService.getCameraById(req.params.id)
        sendSuccess(res, camera)
      } catch (err) {
        next(err)
      }
    },

    async register(req, res, next) {
      try {
        const actorId = req.user ? req.user.id : null
        const camera = await camerasService.registerCamera(req.body, actorId)
        sendCreated(res, camera, `/api/v1/cameras/${camera.id}`)
      } catch (err) {
        next(err)
      }
    },

    async heartbeat(req, res, next) {
      try {
        const heartbeat = await camerasService.recordHeartbeat(req.params.id)
        sendSuccess(res, heartbeat)
      } catch (err) {
        next(err)
      }
    },
  }
}
