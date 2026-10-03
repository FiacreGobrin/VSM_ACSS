import { sendSuccess } from '../../shared/http/respond.js'
import { COLLECTIONS, paging, safeLimit, present } from '../../shared/mongo/helpers.js'

/**
 * Compliance audit trail.
 *
 * Was previously a controller with inline SQL; the MongoDB version uses a
 * `$lookup` onto `users` to denormalise the operator's username and full name
 * onto each row, matching the old `LEFT JOIN users u` aliases.
 */
export function makeAuditController({ db }) {
  const auditLogs = db.collection(COLLECTIONS.auditLogs)

  return {
    async list(req, res, next) {
      try {
        const { action, entityType, limit = 50, offset = 0 } = req.query;

        const filter = {};
        if (action) filter.action = action;
        if (entityType) filter.entity_type = entityType;

        const total = await auditLogs.countDocuments(filter);

        const { skip, limit: take } = paging(safeLimit(limit), offset);

        const rows = await auditLogs
          .aggregate([
            { $match: filter },
            {
              $lookup: {
                from: COLLECTIONS.users,
                localField: 'user_id',
                foreignField: 'id',
                as: '_user',
              },
            },
            { $addFields: { _user: { $arrayElemAt: ['$_user', 0] } } },
            {
              $addFields: {
                user_username: '$_user.username',
                user_full_name: '$_user.full_name',
              },
            },
            { $project: { _user: 0 } },
            { $sort: { created_at: -1 } },
            { $skip: skip },
            { $limit: take },
          ])
          .toArray();

        sendSuccess(
          res,
          rows.map(present),
          { total, limit: take, offset: skip }
        );
      } catch (err) {
        next(err);
      }
    },
  };
}