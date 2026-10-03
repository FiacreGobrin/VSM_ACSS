export function makeLogger(options = {}) {
  const isDev = (options.env || process.env.NODE_ENV) !== 'production'

  function log(level, message, meta) {
    const timestamp = new Date().toISOString()
    const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''

    const prefix = `[${timestamp}] [${level.toUpperCase()}]`
    if (level === 'error') {
      console.error(`${prefix} ${message}${metaStr}`)
    } else if (level === 'warn') {
      console.warn(`${prefix} ${message}${metaStr}`)
    } else {
      console.log(`${prefix} ${message}${metaStr}`)
    }
  }

  return {
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
    debug: (msg, meta) => {
      if (isDev) log('debug', msg, meta)
    },
  }
}
