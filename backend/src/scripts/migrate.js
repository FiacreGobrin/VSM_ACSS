import { loadConfig } from '../config/config.js'
import { createMongoClient } from '../platform/db/mongo.js'
import { runMongoMigrations } from '../platform/db/migrateMongo.js'
import { makeLogger } from '../shared/logger.js'

async function execute() {
  const config = loadConfig()
  const logger = makeLogger({ env: config.env })

  if (!config.mongo.uri) {
    logger.error('Cannot run migrations: MONGODB_URI is not set in .env.')
    logger.info('Add it, for example:')
    logger.info('  mongodb+srv://user:password@cluster0.example.net/vms_acs')
    logger.info('  mongodb://user:password@localhost:27017/vms_acs')
    process.exit(1)
  }

  if (!config.mongo.supportsTransactions) {
    logger.warn(
      'Notice: this deployment is not a replica set, so migrations cannot run inside a ' +
        'multi-document transaction. Each migration is written to be individually ' +
        'idempotent and can be safely re-run after a partial failure.'
    )
  }

  const { client, db } = await createMongoClient(config.mongo.uri, {
    logger,
    dbName: config.mongo.dbName,
    maxPoolSize: config.db.max,
    minPoolSize: config.db.min,
  })

  try {
    logger.info('Starting MongoDB migration runner...')
    const applied = await runMongoMigrations(db, { logger })

    if (applied.length === 0) {
      logger.info('Database schema is already up to date. No pending migrations.')
    } else {
      logger.info(`Successfully applied ${applied.length} migration(s):`)
      for (const m of applied) {
        logger.info(`  -> [${m.version}] ${m.name}`)
      }
    }
  } catch (err) {
    logger.error('Migration failed:', { error: err.message })
    process.exitCode = 1
  } finally {
    await client.close()
  }
}

execute()