import fs from 'node:fs'
import path from 'node:path'

/**
 * Runs pending database migrations from the migrations directory.
 */
export async function runMigrations(pool, options = {}) {
  const { logger, migrationsDir } = options
  const log = (msg, meta) => {
    if (logger) logger.info(msg, meta)
    else console.log(`[Migrate] ${msg}`, meta ? JSON.stringify(meta) : '')
  }
  const logWarn = (msg, meta) => {
    if (logger) logger.warn(msg, meta)
    else console.warn(`[Migrate WARN] ${msg}`, meta ? JSON.stringify(meta) : '')
  }

  const dir = migrationsDir || path.resolve(process.cwd(), 'migrations')
  if (!fs.existsSync(dir)) {
    logWarn(`Migrations directory not found at: ${dir}`)
    return []
  }

  const client = await pool.connect()
  try {
    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // 2. Query applied migrations
    const appliedRes = await client.query('SELECT version FROM schema_migrations ORDER BY version ASC')
    const appliedSet = new Set(appliedRes.rows.map((r) => r.version))

    // 3. Read and sort pending files
    const files = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.up.sql'))
      .sort()

    const appliedNow = []

    for (const file of files) {
      const match = file.match(/^([0-9]+)_(.+)\.up\.sql$/)
      if (!match) continue

      const [, version, name] = match
      if (appliedSet.has(version)) {
        continue
      }

      log(`Applying migration: ${file}`)
      const sql = fs.readFileSync(path.join(dir, file), 'utf-8')

      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query(
          'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
          [version, name]
        )
        await client.query('COMMIT')
        appliedNow.push({ version, name, file })
        log(`Migration ${file} applied successfully`)
      } catch (err) {
        await client.query('ROLLBACK')
        throw new Error(`Failed applying migration ${file}: ${err.message}`)
      }
    }

    return appliedNow
  } finally {
    client.release()
  }
}
