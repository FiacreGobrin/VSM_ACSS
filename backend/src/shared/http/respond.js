/**
 * Formats and sends a standardized successful JSON response.
 */
export function sendSuccess(res, data = null, meta = undefined, status = 200) {
  const body = { success: true }
  if (data !== null) body.data = data
  if (meta !== undefined) body.meta = meta
  return res.status(status).json(body)
}

/**
 * Formats and sends a 201 Created response.
 */
export function sendCreated(res, data, location = null) {
  if (location) {
    res.location(location)
  }
  return res.status(201).json({
    success: true,
    data,
  })
}

/**
 * Formats and sends a standardized error response.
 */
export function sendError(res, status = 500, code = 'internal_error', message = 'An error occurred', details = null) {
  const body = {
    success: false,
    error: {
      code,
      message,
    },
  }
  if (details) {
    body.error.details = details
  }
  return res.status(status).json(body)
}
