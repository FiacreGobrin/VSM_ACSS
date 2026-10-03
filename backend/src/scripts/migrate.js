import { loadConfig } from '../config/config.js'
import { createDbPool } from '../platform/db/pool.js'
import { runMigrations } from '../platform/db/migrate.js'
import { makeLogger } from '../shared/logger.js'

async function execute() {
  const config = loadConfig()
  const logger = makeLogger({ env: config.env })

  if (!config.databaseUrl || config.databaseUrl.includes('placeholder')) {
    logger.error('Cannot run migrations: DATABASE_URL in .env contains a placeholder.')
    logger.info('Please update .env with your real Neon connection string.')
    process.exit(1)
  }

  if (config.databaseUrl.includes('-pooler.')) {
    logger.warn(
      'Notice: Connecting via Neon pooled endpoint (-pooler). ' +
      'For DDL schema migrations, Neon recommends using the direct connection string.'
    )
  }

  const pool = createDbPool(config.databaseUrl, { ...config.db, logger })

  try {
    logger.info('Starting database migration runner...')
    const applied = await runMigrations(pool, { logger })

    if (applied.length === 0) {
      logger.info('Database schema is already up to date. No pending migrations.')
    } else {
      logger.info(`Successfully applied ${applied.length} migration(s):`)
      for (const m of applied) {
        logger.info(`  ✔ [${m.version}] ${m.name}`)
      }
    }
  } catch (err) {
    logger.error('Migration failed:', { error: err.message })
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

execute()
