import jwt from 'jsonwebtoken'
import { UnauthorizedError, ForbiddenError } from '../errors.js'

export function makeAuthMiddleware(jwtSecret) {
  function authenticate(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed Authorization header. Use Bearer <token>')
    }

    const token = authHeader.split(' ')[1]
    try {
      const decoded = jwt.verify(token, jwtSecret)
      req.user = decoded
      next()
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Authentication token has expired', 'token_expired')
      }
      throw new UnauthorizedError('Invalid authentication token', 'invalid_token')
    }
  }

  function optionalAuthenticate(req, res, next) {
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1]
      try {
        req.user = jwt.verify(token, jwtSecret)
      } catch {
        // Ignore token errors in optional auth
      }
    }
    next()
  }

  function authorize(...allowedRoles) {
    return (req, res, next) => {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required prior to authorization check')
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
        throw new ForbiddenError(
          `User role "${req.user.role}" does not have required permissions: [${allowedRoles.join(', ')}]`
        )
      }

      next()
    }
  }

  return {
    authenticate,
    optionalAuthenticate,
    authorize,
  }
}
