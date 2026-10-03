import { BadRequestError, NotFoundError } from '../../shared/errors.js'

export function makeVisitsService({ db }) {
  return {
    async createVisit(data, actorId = null) {
      const {
        visitorId,
        hostName,
        hostEmail = null,
        purpose,
        badgeNumber = null,
        authorizedZones = [],
        expectedArrival = new Date().toISOString(),
      } = data

      if (!visitorId || !hostName || !purpose) {
        throw new BadRequestError('visitorId, hostName, and purpose are required')
      }

      // Check visitor status
      const visitorRes = await db.query('SELECT id, status, full_name FROM visitors WHERE id = $1', [visitorId])
      if (visitorRes.rows.length === 0) {
        throw new NotFoundError('Visitor not found')
      }

      const visitor = visitorRes.rows[0]
      if (visitor.status === 'blacklisted') {
        throw new BadRequestError('Cannot schedule visit: This visitor is blacklisted.')
      }

      const result = await db.query(
        `INSERT INTO visits (
          visitor_id, host_name, host_email, purpose, badge_number, authorized_zones, expected_arrival, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled')
        RETURNING *`,
        [
          visitorId,
          hostName.trim(),
          hostEmail ? hostEmail.trim() : null,
          purpose.trim(),
          badgeNumber,
          JSON.stringify(authorizedZones),
          expectedArrival,
        ]
      )

      const visit = result.rows[0]

      if (actorId) {
        await db.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
           VALUES ($1, 'CREATE_VISIT', 'visit', $2, $3)`,
          [actorId, visit.id, JSON.stringify({ visitorId, hostName, purpose })]
        )
      }

      return visit
    },

    async checkIn(visitId, { badgeNumber = null } = {}, actorId = null) {
      const visitRes = await db.query(
        `SELECT v.*, vis.status as visitor_status, vis.full_name as visitor_name
         FROM visits v
         JOIN visitors vis ON v.visitor_id = vis.id
         WHERE v.id = $1`,
        [visitId]
      )

      if (visitRes.rows.length === 0) {
        throw new NotFoundError(`Visit ${visitId} not found`)
      }

      const visit = visitRes.rows[0]
      if (visit.visitor_status === 'blacklisted') {
        throw new BadRequestError('Check-in denied: Visitor is blacklisted.')
      }

      if (visit.status === 'checked_in') {
        throw new BadRequestError('Visitor is already checked in.')
      }

      const finalBadge = badgeNumber || visit.badge_number

      const result = await db.query(
        `UPDATE visits
         SET status = 'checked_in', check_in_at = now(), badge_number = $1, on_site = true, updated_at = now()
         WHERE id = $2
         RETURNING *`,
        [finalBadge, visitId]
      )

      if (actorId) {
        await db.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
           VALUES ($1, 'VISITOR_CHECK_IN', 'visit', $2, $3)`,
          [actorId, visitId, JSON.stringify({ badgeNumber: finalBadge, visitorName: visit.visitor_name })]
        )
      }

      return result.rows[0]
    },

    async checkOut(visitId, actorId = null) {
      const visitRes = await db.query('SELECT * FROM visits WHERE id = $1', [visitId])
      if (visitRes.rows.length === 0) {
        throw new NotFoundError(`Visit ${visitId} not found`)
      }

      const visit = visitRes.rows[0]
      if (visit.status !== 'checked_in') {
        throw new BadRequestError(`Cannot check out: visit status is currently '${visit.status}'.`)
      }

      const result = await db.query(
        `UPDATE visits
         SET status = 'checked_out', check_out_at = now(), on_site = false, updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [visitId]
      )

      if (actorId) {
        await db.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
           VALUES ($1, 'VISITOR_CHECK_OUT', 'visit', $2, $3)`,
          [actorId, visitId, JSON.stringify({ checkOutAt: new Date().toISOString() })]
        )
      }

      return result.rows[0]
    },

    async listVisits({ status = '', visitorId = '', limit = 50, offset = 0 } = {}) {
      const conditions = []
      const params = []

      if (status) {
        params.push(status)
        conditions.push(`v.status = $${params.length}`)
      }

      if (visitorId) {
        params.push(visitorId)
        conditions.push(`v.visitor_id = $${params.length}`)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const countSql = `SELECT count(*)::int as total FROM visits v ${whereClause}`
      const totalRes = await db.query(countSql, params)
      const total = totalRes.rows[0].total

      params.push(limit)
      const limitIdx = params.length
      params.push(offset)
      const offsetIdx = params.length

      const dataSql = `
        SELECT
          v.id, v.visitor_id, v.host_name, v.host_email, v.purpose, v.badge_number,
          v.status, v.check_in_at, v.check_out_at, v.expected_arrival, v.authorized_zones,
          v.on_site, v.created_at, v.updated_at,
          vis.full_name as visitor_name, vis.id_type, vis.id_number, vis.company, vis.photo_url
        FROM visits v
        JOIN visitors vis ON v.visitor_id = vis.id
        ${whereClause}
        ORDER BY v.created_at DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `
      const dataRes = await db.query(dataSql, params)

      return {
        items: dataRes.rows,
        pagination: { total, limit, offset },
      }
    },
  }
}
