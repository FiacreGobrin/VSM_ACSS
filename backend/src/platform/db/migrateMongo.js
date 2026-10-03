import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { COLLECTIONS, newId } from '../../shared/mongo/helpers.js'

/**
 * Runs pending MongoDB migrations from `migrations/mongo`.
 *
 * Preserves the original runner's contract: ordered numeric versions, a
 * tracking collection so a migration runs exactly once, and a list of what was
 * applied. The difference is that each migration is a JS module exporting
 * `up(db)` / `down(db)` rather than a `.sql` file, because MongoDB DDL is
 * expressed through driver calls (createCollection + validators + indexes).
 */
export async function runMongoMigrations(db, options = {}) {
  const { logger, migrationsDir } = options
  const log = (msg, meta) => {
    if (logger) logger.info(msg, meta)
    else console.log(`[Migrate] ${msg}`, meta ? JSON.stringify(meta) : '')
  }
  const logWarn = (msg, meta) => {
    if (logger) logger.warn(msg, meta)
    else console.warn(`[Migrate WARN] ${msg}`, meta ? JSON.stringify(meta) : '')
  }

  const dir = migrationsDir || path.resolve(process.cwd(), 'migrations', 'mongo')
  if (!fs.existsSync(dir)) {
    logWarn(`Migrations directory not found at: ${dir}`)
    return []
  }

  // 1. Ensure the tracking collection exists (equivalent to the old
  // `CREATE TABLE IF NOT EXISTS schema_migrations`).
  const tracker = db.collection(COLLECTIONS.schemaMigrations)
  try {
    await db.createCollection(COLLECTIONS.schemaMigrations)
  } catch (err) {
    // NamespaceExists (48) simply means a previous run created it.
    if (err.code !== 48) throw err
  }

  // 2. Read applied versions.
  const appliedDocs = await tracker.find({}, { projection: { version: 1 } }).toArray()
  const appliedSet = new Set(appliedDocs.map((d) => d.version))

  // 3. Load and sort pending migrations.
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^[0-9]+_.+\.js$/.test(f) && !f.startsWith('_'))
    .sort()

  const appliedNow = []

  for (const file of files) {
    const match = file.match(/^([0-9]+)_(.+)\.js$/)
    if (!match) continue

    const [, version, name] = match
    if (appliedSet.has(version)) continue

    log(`Applying migration: ${file}`)

    // `pathToFileURL` is required rather than string concatenation: on Windows
    // a dynamic import of `C:/path/file.js` throws "Invalid URL", because the
    // spec requires an absolute URL with a `file://` scheme.
    const migration = await import(pathToFileURL(path.join(dir, file)).href)

    if (typeof migration.up !== 'function') {
      throw new Error(`Migration ${file} does not export an up(db) function`)
    }

    // Unlike the Postgres runner there is no BEGIN/COMMIT wrapper: MongoDB
    // transactions require a replica set, which Atlas free tier does not
    // provide. Each migration is therefore written to be individually
    // idempotent, so a partial failure can be corrected and re-run.
    try {
      await migration.up(db)
      await tracker.insertOne({
        id: newId(),
        version,
        name,
        applied_at: new Date(),
      })
      appliedNow.push({ version, name, file })
      log(`Migration ${file} applied successfully`)
    } catch (err) {
      throw new Error(`Failed applying migration ${file}: ${err.message}`)
    }
  }

  return appliedNow
}