import pg from 'pg'

const { Pool } = pg

/**
 * Creates and configures a pg.Pool tuned for Neon PostgreSQL.
 */
export function createDbPool(databaseUrl, options = {}) {
  const { logger, ssl, max = 20, connectionTimeoutMillis = 10000, idleTimeoutMillis = 30000 } = options

  // Clean database URL to ensure pg parser handles sslmode
  let cleanUrl = databaseUrl
  const isNeon = cleanUrl.includes('neon.tech')

  const poolConfig = {
    connectionString: cleanUrl,
    max,
    connectionTimeoutMillis,
    idleTimeoutMillis,
  }

  // Neon requires SSL. When connecting via pg to Neon, provide ssl configuration
  if (ssl !== undefined) {
    poolConfig.ssl = ssl
  } else if (isNeon || cleanUrl.includes('sslmode=require')) {
    poolConfig.ssl = { rejectUnauthorized: false }
  }

  const pool = new Pool(poolConfig)

  pool.on('error', (err) => {
    if (logger) {
      logger.error('Unexpected database pool idle client error', { error: err.message })
    } else {
      console.error('[DB Pool Error]', err.message)
    }
  })

  return pool
}

/**
 * Pings database to test connectivity.
 */
export async function pingDb(pool, timeoutMs = 5000) {
  const timer = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Database ping timed out after ${timeoutMs}ms`)), timeoutMs)
  )

  const queryPromise = pool.query('SELECT 1 as alive, current_database() as db_name, version()')
  return Promise.race([queryPromise, timer])
}
