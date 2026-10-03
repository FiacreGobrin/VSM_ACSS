export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'internal_error', details = null) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.code = code
    this.details = details
    Error.captureStackTrace(this, this.constructor)
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', code = 'bad_request', details = null) {
    super(message, 400, code, details)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code = 'unauthorized', details = null) {
    super(message, 401, code, details)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden: insufficient permissions', code = 'forbidden', details = null) {
    super(message, 403, code, details)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'not_found', details = null) {
    super(message, 404, code, details)
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists or conflict occurred', code = 'conflict', details = null) {
    super(message, 409, code, details)
  }
}

export class UnprocessableError extends AppError {
  constructor(message = 'Validation failed', code = 'unprocessable_entity', details = null) {
    super(message, 422, code, details)
  }
}
