import { sendSuccess } from '../../shared/http/respond.js'

export function makeAuditController({ db }) {
  return {
    async list(req, res, next) {
      try {
        const { action, entityType, limit = 50, offset = 0 } = req.query
        const conditions = []
        const params = []

        if (action) {
          params.push(action)
          conditions.push(`a.action = $${params.length}`)
        }
        if (entityType) {
          params.push(entityType)
          conditions.push(`a.entity_type = $${params.length}`)
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

        const countRes = await db.query(`SELECT count(*)::int as total FROM audit_logs a ${whereClause}`, params)
        const total = countRes.rows[0].total

        params.push(parseInt(limit, 10))
        const limitIdx = params.length
        params.push(parseInt(offset, 10))
        const offsetIdx = params.length

        const dataSql = `
          SELECT a.*, u.username as user_username, u.full_name as user_full_name
          FROM audit_logs a
          LEFT JOIN users u ON a.user_id = u.id
          ${whereClause}
          ORDER BY a.created_at DESC
          LIMIT $${limitIdx} OFFSET $${offsetIdx}
        `
        const dataRes = await db.query(dataSql, params)

        sendSuccess(res, dataRes.rows, { total, limit: parseInt(limit, 10), offset: parseInt(offset, 10) })
      } catch (err) {
        next(err)
      }
    },
  }
}
