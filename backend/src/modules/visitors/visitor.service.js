import { BadRequestError, NotFoundError, ConflictError } from '../../shared/errors.js'
import {
  COLLECTIONS,
  newId,
  containsFilter,
  paging,
  safeLimit,
  present,
} from '../../shared/mongo/helpers.js'

/**
 * Visitor registry.
 *
 * Stores documents with the same snake_case field names as the former
 * `visitors` table, so the API's JSON response is unchanged and the console
 * needs no adjustment.
 */
export function makeVisitorService({ db }) {
  const visitors = db.collection(COLLECTIONS.visitors)
  const auditLogs = db.collection(COLLECTIONS.auditLogs)

  /** Writes an audit entry. Never throws - auditing must not block the action. */
  const audit = async (actorId, action, entityId, details) => {
    if (!actorId) return
    try {
      await auditLogs.insertOne({
        id: newId(),
        user_id: actorId,
        action,
        entity_type: 'visitor',
        entity_id: entityId,
        ip_address: null,
        details,
        created_at: new Date(),
      })
    } catch (err) {
      console.warn('[Audit] Failed to record visitor audit event:', err.message)
    }
  }

  return {
    async createVisitor(data, actorId = null) {
      const {
        fullName,
        idType,
        idNumber,
        company = '',
        email = null,
        phone = null,
        photoUrl = null,
        faceFeatureVector = null,
        notes = '',
      } = data

      if (!fullName || !idType || !idNumber) {
        throw new BadRequestError('fullName, idType, and idNumber are required')
      }

      const validIdTypes = ['national_id', 'passport', 'drivers_license', 'other']
      if (!validIdTypes.includes(idType)) {
        throw new BadRequestError(`Invalid idType. Valid types are: ${validIdTypes.join(', ')}`)
      }

      const now = new Date()
      const doc = {
        id: newId(),
        full_name: fullName.trim(),
        id_type: idType,
        id_number: idNumber.trim(),
        company: company.trim(),
        email: email ? email.trim() : null,
        phone: phone ? phone.trim() : null,
        photo_url: photoUrl,
        // Stored natively as an array; the old JSONB column round-tripped
        // through JSON.stringify, so a plain array is the closer analogue.
        face_feature_vector: faceFeatureVector || null,
        status: 'active',
        notes,
        created_at: now,
        updated_at: now,
      }

      try {
        await visitors.insertOne(doc)
      } catch (err) {
        // UNIQUE (id_type, id_number) -> unique index rejection.
        if (err.code === 11000) {
          throw new ConflictError(
            `A visitor with this ${idType} / ${idNumber.trim()} already exists`
          )
        }
        throw err
      }

      await audit(actorId, 'CREATE_VISITOR', doc.id, { fullName, idNumber, idType })

      return present(doc)
    },

    async listVisitors({ query = '', status = '', limit = 50, offset = 0 } = {}) {
      const filter = {}

      if (status) filter.status = status

      // `full_name ILIKE ... OR id_number ILIKE ... OR company ILIKE ...`
      if (query) Object.assign(filter, containsFilter(query, ['full_name', 'id_number', 'company']))

      const total = await visitors.countDocuments(filter)

      const { skip, limit: take } = paging(safeLimit(limit), offset)
      const rows = await visitors
        .find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(take)
        .toArray()

      return {
        items: rows.map(present),
        pagination: { total, limit: take, offset: skip },
      }
    },

    async getVisitorById(id) {
      const visitor = await visitors.findOne({ id })
      if (!visitor) {
        throw new NotFoundError(`Visitor with ID ${id} not found`)
      }
      return present(visitor)
    },

    async updateVisitor(id, data, actorId = null) {
      const visitor = await this.getVisitorById(id)

      // Mirrors the Postgres UPDATE: only fields present in the payload change.
      const updates = {}
      if (data.fullName !== undefined) updates.full_name = data.fullName.trim()
      if (data.company !== undefined) updates.company = data.company.trim()
      if (data.email !== undefined) updates.email = data.email
      if (data.phone !== undefined) updates.phone = data.phone
      if (data.photoUrl !== undefined) updates.photo_url = data.photoUrl
      if (data.notes !== undefined) updates.notes = data.notes

      updates.updated_at = new Date()

      await visitors.updateOne({ id }, { $set: updates })

      await audit(actorId, 'UPDATE_VISITOR', id, data)

      return present({ ...visitor, ...updates })
    },

    async updateStatus(id, status, notes = '', actorId = null) {
      const validStatuses = ['active', 'blacklisted', 'flagged']
      if (!validStatuses.includes(status)) {
        throw new BadRequestError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`)
      }

      const visitor = await this.getVisitorById(id)

      // `notes = CASE WHEN $2 <> '' THEN $2 ELSE notes END` -> a conditional $set.
      const updates = { status, updated_at: new Date() }
      if (notes) updates.notes = notes

      await visitors.updateOne({ id }, { $set: updates })

      await audit(actorId, 'VISITOR_STATUS_CHANGE', id, { newStatus: status, notes })

      return present({ ...visitor, ...updates })
    },
  }
}