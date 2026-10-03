import { BadRequestError, NotFoundError, ConflictError } from '../../shared/errors.js'
import { COLLECTIONS, newId, present } from '../../shared/mongo/helpers.js'

/**
 * Cameras and security zones.
 *
 * The former `listZones` used a GROUP BY to attach a camera count to each zone;
 * MongoDB has no such aggregate, so the count is computed per zone with
 * `countDocuments`. Zone counts are small (tens), so the extra round-trips are
 * negligible next to the correctness win of removing the group-by emulation.
 */
export function makeCamerasService({ db }) {
  const cameras = db.collection(COLLECTIONS.cameras)
  const zones = db.collection(COLLECTIONS.zones)
  const auditLogs = db.collection(COLLECTIONS.auditLogs)

  const audit = async (actorId, action, entityType, entityId, details) => {
    if (!actorId) return
    try {
      await auditLogs.insertOne({
        id: newId(),
        user_id: actorId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        ip_address: null,
        details,
        created_at: new Date(),
      })
    } catch (err) {
      console.warn('[Audit] Failed to record audit event:', err.message)
    }
  }

  return {
    // --- Zones ---
    async listZones() {
      const rows = await zones.find().sort({ security_level: 1, name: 1 }).toArray()

      return Promise.all(
        rows.map(async (zone) => ({
          ...present(zone),
          // Replaces `count(c.id)::int as cameras_count` from the old GROUP BY.
          cameras_count: await cameras.countDocuments({ zone_id: zone.id }),
        }))
      )
    },

    async createZone({ name, description = '', securityLevel = 1 }, actorId = null) {
      if (!name) throw new BadRequestError('Zone name is required')

      const now = new Date()
      const doc = {
        id: newId(),
        name: name.trim(),
        description: description.trim(),
        security_level: parseInt(securityLevel, 10) || 1,
        created_at: now,
        updated_at: now,
      }

      try {
        await zones.insertOne(doc)
      } catch (err) {
        // UNIQUE (name)
        if (err.code === 11000) throw new ConflictError(`A zone named "${doc.name}" already exists`)
        throw err
      }

      await audit(actorId, 'CREATE_ZONE', 'zone', doc.id, { name, securityLevel })

      return present(doc)
    },

    // --- Cameras ---
    async listCameras({ zoneId = '', status = '' } = {}) {
      const filter = {}
      if (zoneId) filter.zone_id = zoneId
      if (status) filter.status = status

      // A `$lookup` keeps the zone join in a single round-trip, matching the
      // original `LEFT JOIN zones`.
      const rows = await cameras
        .aggregate([
          { $match: filter },
          {
            $lookup: {
              from: COLLECTIONS.zones,
              localField: 'zone_id',
              foreignField: 'id',
              as: '_zone',
            },
          },
          {
            $addFields: {
              // `$_zone` is an array of joined documents; `$_zone.name` projects
              // just the name off each element, so $arrayElemAt yields the string
              // rather than the whole document.
              zone_name: { $arrayElemAt: ['$_zone.name', 0] },
              zone_security_level: {
                $ifNull: [{ $getField: { field: 'security_level', input: { $arrayElemAt: ['$_zone', 0] } } }, null],
              },
            },
          },
          // Pure exclusion. Mixing a computed field into `$project` alongside an
          // exclusion is rejected by Mongo as "cannot do exclusion on field X
          // in inclusion projection", so every derived value is added first.
          { $project: { _zone: 0 } },
          { $sort: { name: 1 } },
        ])
        .toArray()

      return rows.map(present)
    },

    async getCameraById(id) {
      const rows = await cameras
        .aggregate([
          { $match: { id } },
          {
            $lookup: {
              from: COLLECTIONS.zones,
              localField: 'zone_id',
              foreignField: 'id',
              as: '_zone',
            },
          },
          {
            $addFields: {
              // Project the name off the joined documents rather than returning
              // the document itself.
              zone_name: { $arrayElemAt: ['$_zone.name', 0] },
              zone_security_level: {
                $ifNull: [{ $getField: { field: 'security_level', input: { $arrayElemAt: ['$_zone', 0] } } }, null],
              },
            },
          },
          { $project: { _zone: 0 } },
        ])
        .toArray()

      if (rows.length === 0) {
        throw new NotFoundError(`Camera with ID ${id} not found`)
      }

      return present(rows[0])
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

      // MongoDB does not enforce foreign keys, so the old `REFERENCES zones(id)`
      // guarantee is now an explicit check. Without it a typo would silently
      // orphan the camera from its zone.
      if (zoneId) {
        const zoneExists = await zones.findOne({ id: zoneId }, { projection: { _id: 0, id: 1 } })
        if (!zoneExists) {
          throw new NotFoundError(`Zone with ID ${zoneId} not found`)
        }
      }

      const now = new Date()
      const doc = {
        id: newId(),
        name: name.trim(),
        zone_id: zoneId || null,
        ip_address: ipAddress ? ipAddress.trim() : null,
        stream_url: streamUrl.trim(),
        model: model.trim(),
        ai_features_enabled: Boolean(aiFeaturesEnabled),
        status: 'online',
        last_heartbeat_at: null,
        last_recording_id: null,
        created_at: now,
        updated_at: now,
      }

      await cameras.insertOne(doc)

      await audit(actorId, 'REGISTER_CAMERA', 'camera', doc.id, { name, streamUrl, zoneId })

      return present(doc)
    },

    async recordHeartbeat(id) {
      const now = new Date()
      const camera = await cameras.findOneAndUpdate(
        { id },
        { $set: { last_heartbeat_at: now, status: 'online', updated_at: now } },
        { projection: { _id: 0, id: 1, name: 1, status: 1, last_heartbeat_at: 1 }, returnDocument: 'after' }
      )

      if (!camera) {
        throw new NotFoundError(`Camera ${id} not found`)
      }

      return present(camera)
    },
  }
}