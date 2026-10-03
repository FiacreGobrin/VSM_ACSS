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

/**
 * Validates a MongoDB connection string's authority component.
 *
 * The driver defers URI parsing until the first connection attempt, so a typo
 * surfaces as an opaque timeout minutes later. Checking the host portion here
 * turns that into an immediate, actionable boot failure instead.
 */
function assertMongoUriShape(uri) {
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    throw new Error(
      'MONGODB_URI must start with mongodb:// or mongodb+srv://. Examples:\n' +
        '  mongodb://[user]:[password]@localhost:27017/vms_acs\n' +
        '  mongodb+srv://[user]:[password]@cluster0.example.net/vms_acs\n' +
        'Note: credentials containing "@" must be URL-encoded as %40.'
    )
  }

  // `mongodb+srv` takes only a bare hostname, so there is nothing to validate
  // beyond the scheme - the DNS lookup at connect time is the real test.
  if (uri.startsWith('mongodb+srv://')) return

  try {
    const authority = uri.replace(/^mongodb:\/\//, '').split('/')[0]
    // eslint-disable-next-line no-new
    new URL(`http://${authority}`)
  } catch {
    throw new Error(
      'MONGODB_URI is not a valid connection string. Expected:\n' +
        '  mongodb://[user]:[password]@host:27017/[dbname]\n' +
        'Note: a username containing "@" (e.g. an email address) must be URL-encoded as %40.'
    )
  }
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

  const jwtSecret = process.env.JWT_SECRET || 'dev_secret_key_visitor_cctv_system'
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d'
  const corsOrigin = process.env.CORS_ORIGIN || '*'

  /* ---------------------------- MongoDB connection ---------------------- */
  // Both schemes are supported: an air-gapped appliance runs its own mongod
  // (`mongodb://`), while a hosted deployment uses Atlas (`mongodb+srv://`).
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL || ''

  // A `mongodb+srv://` URI carries the database in its path, but a bare
  // `mongodb://host:27017` does not, so an explicit name is always required.
  const mongoDbName = process.env.MONGODB_DB || 'vms_acs'

  const isAtlas = mongoUri.includes('mongodb+srv://')

  // Multi-document transactions require a replica set. Atlas free tier (M0)
  // does not provide one, so callers must degrade rather than assume.
  const supportsTransactions = isAtlas || mongoUri.includes('replicaSet=')

  if (mongoUri) assertMongoUriShape(mongoUri)

  // A warm `minPoolSize` keeps a connection ready so the SOC health poll does
  // not pay a TCP + TLS handshake every 30 seconds.
  const poolMax = parsePositiveInt(process.env.MONGO_POOL_MAX, 20)
  const minPool = parsePositiveInt(process.env.MONGO_MIN_POOL, 2)
  const timeoutMs = parsePositiveInt(process.env.MONGO_TIMEOUT_MS, 10000)

  /* ---------------------- Media / evidence upload storage --------------- */
  // Clips are written to the API host's filesystem: the console is air-gapped,
  // so an object-store SDK would add a dependency that cannot reach the internet.
  // Resolved against the process CWD (`backend/`) to keep artefacts in the repo.
  const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads')

  const uploadMaxVideoBytes = parsePositiveInt(
    process.env.UPLOAD_MAX_VIDEO_BYTES,
    500 * 1024 * 1024
  )
  const uploadMaxImageBytes = parsePositiveInt(process.env.UPLOAD_MAX_IMAGE_BYTES, 15 * 1024 * 1024)
  // Bounds operator memory use, since multer buffers the request in RAM first.
  const uploadMaxFiles = parsePositiveInt(process.env.UPLOAD_MAX_FILES, 10)

  return {
    env,
    port,
    mongo: { uri: mongoUri, dbName: mongoDbName, isAtlas, supportsTransactions },
    jwt: { secret: jwtSecret, expiresIn: jwtExpiresIn },
    cors: { origin: corsOrigin },
    db: {
      max: poolMax,
      min: minPool,
      serverSelectionTimeoutMS: timeoutMs,
      connectTimeoutMS: timeoutMs,
      socketTimeoutMS: timeoutMs * 3,
    },
    uploads: {
      dir: uploadDir,
      maxVideoBytes: uploadMaxVideoBytes,
      maxImageBytes: uploadMaxImageBytes,
      maxFiles: uploadMaxFiles,
      // Re-verified against the file's magic bytes on upload, because a
      // browser-supplied Content-Type is attacker-controlled.
      allowedVideoTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
      allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
    },
  }
}