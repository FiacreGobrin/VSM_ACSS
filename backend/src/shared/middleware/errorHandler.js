import { AppError } from '../errors.js'
import { sendError } from '../http/respond.js'

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

    // 2. PostgreSQL specific errors
    if (err.code) {
      // 23505: Unique constraint violation
      if (err.code === '23505') {
        const detail = err.detail || 'A record with these details already exists.'
        return sendError(res, 409, 'conflict', detail)
      }
      // 23503: Foreign key violation
      if (err.code === '23503') {
        return sendError(res, 400, 'invalid_reference', 'Referenced entity does not exist.')
      }
      // 22P02: Invalid data type syntax (e.g. invalid UUID)
      if (err.code === '22P02') {
        return sendError(res, 400, 'invalid_format', 'Invalid data format provided (e.g., malformed UUID).')
      }
      // 42P01: Table does not exist
      if (err.code === '42P01') {
        logger.error('Database table missing. Run migrations with "npm run migrate":', { error: err.message })
        return sendError(res, 500, 'schema_missing', 'Database schema is not initialized. Run "npm run migrate".')
      }
    }

    // 2b. Database unreachable / not configured.
    // A placeholder, malformed, or invalid DATABASE_URL is the single most
    // common setup mistake, so it gets an actionable message rather than a
    // generic 500. `pg` surfaces a malformed URL as a bare TypeError with no
    // `code`, hence the message check.
    const isConnectionFailure =
      err.code === 'ENOTFOUND' ||
      err.code === 'ECONNREFUSED' ||
      err.code === 'ETIMEDOUT' ||
      err.code === 'EAI_AGAIN' ||
      err.code === '57P03' || // cannot_connect_now
      err.code === '28000' || // invalid_authorization_specification
      err.code === '28P01' // invalid_password
    if (isConnectionFailure || (err instanceof TypeError && /invalid url/i.test(err.message))) {
      logger.error('Database connection failure:', { code: err.code, error: err.message })
      return sendError(
        res,
        503,
        'database_unavailable',
        'The database is unreachable. Verify DATABASE_URL in backend/.env points to a live Neon project.'
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
