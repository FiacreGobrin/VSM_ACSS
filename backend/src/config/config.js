import path from 'node:path'
import { loadDotEnv } from './env.js'

/**
 * Parses a positive integer from the environment, falling back to `fallback`.
 *
 * Upload limits arrive as raw strings from `.env`. Without this guard a typo
 * such as `UPLOAD_MAX_VIDEO_BYTES=0` or `abc` would silently disable uploads
 * (or throw deep inside multer), so the fallback is applied deliberately.
 */
function parsePositiveInt(raw, fallback) {
  if (raw === undefined || raw === null || raw === '') return fallback
  const parsed = parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

export function loadConfig(envFile) {
  if (envFile !== false) {
    loadDotEnv(typeof envFile === 'string' ? envFile : undefined)
  }

  const env = process.env.NODE_ENV || 'development'
  const rawPort = process.env.PORT || '8080'
  const port = parseInt(rawPort, 10)

  if (isNaN(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT configuration: "${rawPort}"`)
  }

  const databaseUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.VMS_DATABASE_URL ||
    ''

  const jwtSecret = process.env.JWT_SECRET || 'dev_secret_key_visitor_cctv_system'
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d'
  const corsOrigin = process.env.CORS_ORIGIN || '*'

  // Neon & PostgreSQL pool tuning
  const poolMax = parseInt(process.env.DB_POOL_MAX || '20', 10)
  const connectionTimeoutMs = parseInt(process.env.DB_TIMEOUT_MS || '10000', 10)
  const idleTimeoutMs = parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10)

  // Neon requires SSL. If URL contains neon.tech or sslmode=require, enable SSL
  const isNeon = databaseUrl.includes('neon.tech')
  const requiresSsl = isNeon || databaseUrl.includes('sslmode=require')

  /* ------------------------------------------------------------------ */
  /* Media / evidence upload storage                                    */
  /* ------------------------------------------------------------------ */
  // Uploaded CCTV clips are written to the API host's filesystem. The console
  // is air-gapped, so an object-store SDK would add a dependency that cannot
  // reach the internet; a mounted volume behind `UPLOAD_DIR` is the correct
  // shape here. Swap `localDiskStorage` for an S3-compatible adapter if the
  // appliance is later given a sanctioned egress path.

  // Resolved against the process CWD (the `backend/` directory) so the default
  // keeps every artefact inside the repo rather than scattering files on the C drive.
  const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads')

  const uploadMaxVideoBytes = parsePositiveInt(process.env.UPLOAD_MAX_VIDEO_BYTES, 500 * 1024 * 1024)
  const uploadMaxImageBytes = parsePositiveInt(process.env.UPLOAD_MAX_IMAGE_BYTES, 15 * 1024 * 1024)
  // Cap on how many clips a single multipart request may carry. Bounds operator
  // memory use, since multer buffers the whole request in RAM before validation.
  const uploadMaxFiles = parsePositiveInt(process.env.UPLOAD_MAX_FILES, 10)

  // Fail fast on a malformed connection string.
  // `pg` defers URL parsing to query time and throws a bare
  // `TypeError: Invalid URL` deep in the driver, which surfaces to the
  // operator as an unexplained 500. Validating here keeps the cause obvious.
  if (databaseUrl) {
    try {
      // eslint-disable-next-line no-new
      new URL(databaseUrl)
    } catch {
      throw new Error(
        'DATABASE_URL is not a valid URL. Expected format:\n' +
          '  postgresql://[user]:[password]@[endpoint].neon.tech/[dbname]?sslmode=require\n' +
          'Note: a username containing "@" (e.g. an email address) must be URL-encoded as %40.'
      )
    }
  }

  return {
    env,
    port,
    databaseUrl,
    isNeon,
    jwt: {
      secret: jwtSecret,
      expiresIn: jwtExpiresIn,
    },
    cors: {
      origin: corsOrigin,
    },
    uploads: {
      dir: uploadDir,
      maxVideoBytes: uploadMaxVideoBytes,
      maxImageBytes: uploadMaxImageBytes,
      maxFiles: uploadMaxFiles,
      // Only these container formats are accepted. The registry is re-verified
      // against the file's magic bytes on upload (see `shared/media/magicBytes.js`),
      // because a browser-supplied Content-Type is attacker-controlled.
      allowedVideoTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
      allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
    },
    db: {
      max: poolMax,
      connectionTimeoutMillis: connectionTimeoutMs,
      idleTimeoutMillis: idleTimeoutMs,
      ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
    },
  }
}
