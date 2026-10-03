import { BadRequestError, NotFoundError } from '../../shared/errors.js'
import { COLLECTIONS, newId, paging, safeLimit, present, toDate } from '../../shared/mongo/helpers.js'

/**
 * Visit passes: scheduling, check-in and check-out.
 *
 * `listVisits` previously joined `visits` to `visitors` to denormalise the
 * visitor's name and ID document onto each row for the visitor desk table. That
 * is a `$lookup` here, which preserves the single-round-trip property.
 */
export function makeVisitsService({ db }) {
  const visits = db.collection(COLLECTIONS.visits)
  const visitors = db.collection(COLLECTIONS.visitors)
  const auditLogs = db.collection(COLLECTIONS.auditLogs)

  const audit = async (actorId, action, entityId, details) => {
    if (!actorId) return
    try {
      await auditLogs.insertOne({
        id: newId(),
        user_id: actorId,
        action,
        entity_type: 'visit',
        entity_id: entityId,
        ip_address: null,
        details,
        created_at: new Date(),
      })
    } catch (err) {
      console.warn('[Audit] Failed to record visit audit event:', err.message)
    }
  }

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

      // Stands in for the `visits.visitor_id REFERENCES visitors(id)` constraint.
      const visitor = await visitors.findOne(
        { id: visitorId },
        { projection: { _id: 0, id: 1, status: 1, full_name: 1 } }
      )
      if (!visitor) {
        throw new NotFoundError('Visitor not found')
      }

      if (visitor.status === 'blacklisted') {
        throw new BadRequestError('Cannot schedule visit: This visitor is blacklisted.')
      }

      const now = new Date()
      const doc = {
        id: newId(),
        visitor_id: visitorId,
        host_name: hostName.trim(),
        host_email: hostEmail ? hostEmail.trim() : null,
        purpose: purpose.trim(),
        badge_number: badgeNumber,
        status: 'scheduled',
        check_in_at: null,
        check_out_at: null,
        expected_arrival: toDate(expectedArrival) || now,
        authorized_zones: Array.isArray(authorizedZones) ? authorizedZones : [],
        on_site: false,
        created_at: now,
        updated_at: now,
      }

      await visits.insertOne(doc)

      await audit(actorId, 'CREATE_VISIT', doc.id, { visitorId, hostName, purpose })

      return present(doc)
    },

    async checkIn(visitId, { badgeNumber = null } = {}, actorId = null) {
      // `JOIN visitors vis ON v.visitor_id = vis.id` -> $lookup.
      const rows = await visits
        .aggregate([
          { $match: { id: visitId } },
          {
            $lookup: {
              from: COLLECTIONS.visitors,
              localField: 'visitor_id',
              foreignField: 'id',
              as: '_visitor',
            },
          },
          { $addFields: { _visitor: { $arrayElemAt: ['$_visitor', 0] } } },
          {
            $addFields: {
              visitor_status: '$_visitor.status',
              visitor_name: '$_visitor.full_name',
            },
          },
          { $project: { _visitor: 0 } },
        ])
        .toArray()

      if (rows.length === 0) {
        throw new NotFoundError(`Visit ${visitId} not found`)
      }

      const visit = rows[0]
      if (visit.visitor_status === 'blacklisted') {
        throw new BadRequestError('Check-in denied: Visitor is blacklisted.')
      }

      if (visit.status === 'checked_in') {
        throw new BadRequestError('Visitor is already checked in.')
      }

      const finalBadge = badgeNumber || visit.badge_number
      const now = new Date()

      const updated = await visits.findOneAndUpdate(
        { id: visitId },
        {
          $set: {
            status: 'checked_in',
            check_in_at: now,
            badge_number: finalBadge,
            on_site: true,
            updated_at: now,
          },
        },
        { returnDocument: 'after' }
      )

      await audit(actorId, 'VISITOR_CHECK_IN', visitId, {
        badgeNumber: finalBadge,
        visitorName: visit.visitor_name,
      })

      return present(updated)
    },
async checkOut(visitId, actorId = null) {
      const visit = await visits.findOne({ id: visitId })
      if (!visit) {
        throw new NotFoundError(`Visit ${visitId} not found`)
      }

      if (visit.status !== 'checked_in') {
        throw new BadRequestError(`Cannot check out: visit status is currently '${visit.status}'.`)
      }

      const now = new Date()
      const updated = await visits.findOneAndUpdate(
        { id: visitId },
        { $set: { status: 'checked_out', check_out_at: now, on_site: false, updated_at: now } },
        { returnDocument: 'after' }
      )

      await audit(actorId, 'VISITOR_CHECK_OUT', visitId, { checkOutAt: now.toISOString() })

      return present(updated)
    },

    async listVisits({ status = '', visitorId = '', limit = 50, offset = 0 } = {}) {
      const filter = {}
      if (status) filter.status = status
      if (visitorId) filter.visitor_id = visitorId

      const total = await visits.countDocuments(filter)

      const { skip, limit: take } = paging(safeLimit(limit), offset)

      const rows = await visits
        .aggregate([
          { $match: filter },
          {
            $lookup: {
              from: COLLECTIONS.visitors,
              localField: 'visitor_id',
              foreignField: 'id',
              as: '_visitor',
            },
          },
          { $addFields: { _visitor: { $arrayElemAt: ['$_visitor', 0] } } },
          {
            // Flattens the joined document into the row, exactly as the old
            // `vis.full_name as visitor_name, ...` aliases did.
            $addFields: {
              visitor_name: '$_visitor.full_name',
              id_type: '$_visitor.id_type',
              id_number: '$_visitor.id_number',
              company: '$_visitor.company',
              photo_url: '$_visitor.photo_url',
            },
          },
          { $project: { _visitor: 0 } },
          { $sort: { created_at: -1 } },
          { $skip: skip },
          { $limit: take },
        ])
        .toArray()

      return {
        items: rows.map(present),
        pagination: { total, limit: take, offset: skip },
      }
    },
  }
}