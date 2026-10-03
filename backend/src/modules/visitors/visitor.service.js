import { BadRequestError, NotFoundError } from '../../shared/errors.js'

export function makeVisitorService({ db }) {
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

      const result = await db.query(
        `INSERT INTO visitors (
          full_name, id_type, id_number, company, email, phone, photo_url, face_feature_vector, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          fullName.trim(),
          idType,
          idNumber.trim(),
          company.trim(),
          email ? email.trim() : null,
          phone ? phone.trim() : null,
          photoUrl,
          faceFeatureVector ? JSON.stringify(faceFeatureVector) : null,
          notes,
        ]
      )

      const visitor = result.rows[0]

      // Audit log entry
      if (actorId) {
        await db.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
           VALUES ($1, 'CREATE_VISITOR', 'visitor', $2, $3)`,
          [actorId, visitor.id, JSON.stringify({ fullName, idNumber, idType })]
        )
      }

      return visitor
    },

    async listVisitors({ query = '', status = '', limit = 50, offset = 0 } = {}) {
      const conditions = []
      const params = []

      if (status) {
        params.push(status)
        conditions.push(`status = $${params.length}`)
      }

      if (query) {
        params.push(`%${query}%`)
        conditions.push(`(full_name ILIKE $${params.length} OR id_number ILIKE $${params.length} OR company ILIKE $${params.length})`)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const countSql = `SELECT count(*)::int as total FROM visitors ${whereClause}`
      const totalRes = await db.query(countSql, params)
      const total = totalRes.rows[0].total

      params.push(limit)
      const limitParamIndex = params.length
      params.push(offset)
      const offsetParamIndex = params.length

      const dataSql = `
        SELECT id, full_name, id_type, id_number, company, email, phone, photo_url, status, notes, created_at, updated_at
        FROM visitors
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
      `
      const dataRes = await db.query(dataSql, params)

      return {
        items: dataRes.rows,
        pagination: {
          total,
          limit,
          offset,
        },
      }
    },

    async getVisitorById(id) {
      const result = await db.query(
        `SELECT id, full_name, id_type, id_number, company, email, phone, photo_url, face_feature_vector, status, notes, created_at, updated_at
         FROM visitors
         WHERE id = $1`,
        [id]
      )

      if (result.rows.length === 0) {
        throw new NotFoundError(`Visitor with ID ${id} not found`)
      }

      return result.rows[0]
    },

    async updateVisitor(id, data, actorId = null) {
      const visitor = await this.getVisitorById(id)

      const fullName = data.fullName !== undefined ? data.fullName.trim() : visitor.full_name
      const company = data.company !== undefined ? data.company.trim() : visitor.company
      const email = data.email !== undefined ? data.email : visitor.email
      const phone = data.phone !== undefined ? data.phone : visitor.phone
      const photoUrl = data.photoUrl !== undefined ? data.photoUrl : visitor.photo_url
      const notes = data.notes !== undefined ? data.notes : visitor.notes

      const result = await db.query(
        `UPDATE visitors
         SET full_name = $1, company = $2, email = $3, phone = $4, photo_url = $5, notes = $6, updated_at = now()
         WHERE id = $7
         RETURNING *`,
        [fullName, company, email, phone, photoUrl, notes, id]
      )

      if (actorId) {
        await db.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
           VALUES ($1, 'UPDATE_VISITOR', 'visitor', $2, $3)`,
          [actorId, id, JSON.stringify(data)]
        )
      }

      return result.rows[0]
    },

    async updateStatus(id, status, notes = '', actorId = null) {
      const validStatuses = ['active', 'blacklisted', 'flagged']
      if (!validStatuses.includes(status)) {
        throw new BadRequestError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`)
      }

      await this.getVisitorById(id)

      const result = await db.query(
        `UPDATE visitors
         SET status = $1, notes = CASE WHEN $2 <> '' THEN $2 ELSE notes END, updated_at = now()
         WHERE id = $3
         RETURNING *`,
        [status, notes, id]
      )

      if (actorId) {
        await db.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
           VALUES ($1, 'VISITOR_STATUS_CHANGE', 'visitor', $2, $3)`,
          [actorId, id, JSON.stringify({ newStatus: status, notes })]
        )
      }

      return result.rows[0]
    },
  }
}
