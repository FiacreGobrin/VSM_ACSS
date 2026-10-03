import { BadRequestError, NotFoundError } from '../../shared/errors.js'

export function makeCamerasService({ db }) {
  return {
    // --- Zones ---
    async listZones() {
      const result = await db.query(
        `SELECT z.*, count(c.id)::int as cameras_count
         FROM zones z
         LEFT JOIN cameras c ON c.zone_id = z.id
         GROUP BY z.id
         ORDER BY z.security_level ASC, z.name ASC`
      )
      return result.rows
    },

    async createZone({ name, description = '', securityLevel = 1 }, actorId = null) {
      if (!name) throw new BadRequestError('Zone name is required')

      const result = await db.query(
        `INSERT INTO zones (name, description, security_level)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name.trim(), description.trim(), parseInt(securityLevel, 10) || 1]
      )

      const zone = result.rows[0]
      if (actorId) {
        await db.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
           VALUES ($1, 'CREATE_ZONE', 'zone', $2, $3)`,
          [actorId, zone.id, JSON.stringify({ name, securityLevel })]
        )
      }

      return zone
    },

    // --- Cameras ---
    async listCameras({ zoneId = '', status = '' } = {}) {
      const conditions = []
      const params = []

      if (zoneId) {
        params.push(zoneId)
        conditions.push(`c.zone_id = $${params.length}`)
      }

      if (status) {
        params.push(status)
        conditions.push(`c.status = $${params.length}`)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const result = await db.query(
        `SELECT c.*, z.name as zone_name, z.security_level as zone_security_level
         FROM cameras c
         LEFT JOIN zones z ON c.zone_id = z.id
         ${whereClause}
         ORDER BY c.name ASC`,
        params
      )

      return result.rows
    },

    async getCameraById(id) {
      const result = await db.query(
        `SELECT c.*, z.name as zone_name, z.security_level as zone_security_level
         FROM cameras c
         LEFT JOIN zones z ON c.zone_id = z.id
         WHERE c.id = $1`,
        [id]
      )

      if (result.rows.length === 0) {
        throw new NotFoundError(`Camera with ID ${id} not found`)
      }

      return result.rows[0]
    },

    async registerCamera(data, actorId = null) {
      const {
        name,
        zoneId = null,
        ipAddress = null,
        streamUrl,
        model = '',
        aiFeaturesEnabled = true,
      } = data

      if (!name || !streamUrl) {
        throw new BadRequestError('Camera name and streamUrl are required')
      }

      const result = await db.query(
        `INSERT INTO cameras (
          name, zone_id, ip_address, stream_url, model, ai_features_enabled, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'online')
        RETURNING *`,
        [
          name.trim(),
          zoneId || null,
          ipAddress ? ipAddress.trim() : null,
          streamUrl.trim(),
          model.trim(),
          Boolean(aiFeaturesEnabled),
        ]
      )

      const camera = result.rows[0]

      if (actorId) {
        await db.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
           VALUES ($1, 'REGISTER_CAMERA', 'camera', $2, $3)`,
          [actorId, camera.id, JSON.stringify({ name, streamUrl, zoneId })]
        )
      }

      return camera
    },

    async recordHeartbeat(id) {
      const result = await db.query(
        `UPDATE cameras
         SET last_heartbeat_at = now(), status = 'online', updated_at = now()
         WHERE id = $1
         RETURNING id, name, status, last_heartbeat_at`,
        [id]
      )

      if (result.rows.length === 0) {
        throw new NotFoundError(`Camera ${id} not found`)
      }

      return result.rows[0]
    },
  }
}
