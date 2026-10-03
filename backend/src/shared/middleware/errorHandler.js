import { AppError } from '../errors.js'
import { sendError } from '../http/respond.js'

/**
 * Turns a MongoDB duplicate-key error into an operator-readable message.
 *
 * The driver reports the violated index in `keyPattern` and the offending value
 * in `keyValue`, e.g.
 *   { keyPattern: { id_type: 1, id_number: 1 }, keyValue: { id_type: 'national_id', ... } }
 *
 * Naming the field turns an opaque "E11000 duplicate key error" into something
 * the API client can show directly.
 */
function summariseDuplicateKey(err) {
  const pattern = err.keyPattern
  if (!pattern || typeof pattern !== 'object') return null

  const fields = Object.keys(pattern)
  if (fields.length === 0) return null

  return `A record with this ${fields.join(' + ')} already exists.`
}

export function errorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    // 1. Handled Domain AppError
    if (err instanceof AppError) {
      if (err.statusCode >= 500) {
        logger.error(`AppError [${err.code}]: ${err.message}`, { details: err.details })
      } else {
        logger.warn(`ClientError [${err.code}]: ${err.message}`, {
          path: req.originalUrl,
          statusCode: err.statusCode,
          details: err.details,
        })
      }
      return sendError(res, err.statusCode, err.code, err.message, err.details)
    }

    // 2. MongoDB specific errors
    if (err.code) {
      // 11000 / 11001: unique index violation. Replaces the Postgres 23505.
      // The key pattern names the offending index, which is what makes the
      // message actionable ("a visitor with this id_type/id_number already exists").
      if (err.code === 11000 || err.code === 11001) {
        const field = summariseDuplicateKey(err);
        return sendError(res, 409, 'conflict', field || 'A record with these details already exists.')
      }
      // Document failed the collection's $jsonSchema validator. Replaces 23503
      // and the CHECK-constraint violations Postgres raised implicitly.
      if (err.code === 121 || err.name === 'DocumentValidationFailure') {
        return sendError(res, 422, 'validation_failed', err.message)
      }
      // Bad value for a typed field (e.g. a string where the schema demands a date).
      if (err.code === 14 || err.code === 2) {
        return sendError(res, 400, 'invalid_format', `Invalid data supplied: ${err.message}`)
      }
      // Collection/namespace missing -> migrations were never applied.
      if (err.code === 26) {
        logger.error('MongoDB namespace missing. Run migrations with "npm run migrate":', { error: err.message });
        return sendError(res, 500, 'schema_missing', 'Database schema is not initialized. Run "npm run migrate".')
      }
    }

    // 2b. Database unreachable / not configured.
    // A missing or invalid MONGODB_URI is the single most common setup mistake,
    // so it gets an actionable message rather than a generic 500.
    const isConnectionFailure =
      err.code === 'ENOTFOUND' ||
      err.code === 'ECONNREFUSED' ||
      err.code === 'ECONNRESET' ||
      err.code === 'ETIMEDOUT' ||
      err.code === 'EAI_AGAIN' ||
      err.name === 'MongoServerSelectionError' ||
      err.name === 'MongoNetworkError' ||
      err.message === 'Authentication failed.'

    if (isConnectionFailure || /MONGODB_URI is not configured/i.test(err.message || '')) {
      logger.error('MongoDB connection failure:', { code: err.code, error: err.message });
      return sendError(
        res,
        503,
        'database_unavailable',
        'The database is unreachable. Verify MONGODB_URI in backend/.env points to a live MongoDB deployment.'
      )
    }

    // 3. Fallback unexpected internal errors
    logger.error(`Unhandled Exception on ${req.method} ${req.originalUrl}:`, {
      message: err.message,
      stack: err.stack,
    })

    return sendError(res, 500, 'internal_error', 'An internal server error occurred')
  }
}
