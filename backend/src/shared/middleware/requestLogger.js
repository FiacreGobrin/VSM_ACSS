export function requestLogger(logger) {
  return (req, res, next) => {
    const start = Date.now()
    res.on('finish', () => {
      const durationMs = Date.now() - start
      logger.info(`${req.method} ${req.originalUrl}`, {
        status: res.statusCode,
        duration: `${durationMs}ms`,
        ip: req.ip || req.socket.remoteAddress,
      })
    })
    next()
  }
}
