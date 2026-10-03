import { loadConfig } from './config/config.js'
import { makeLogger } from './shared/logger.js'
import { createMongoClient } from './platform/db/mongo.js'
import { runMongoMigrations } from './platform/db/migrateMongo.js'
import { makeModules } from './modules/index.js'
import { makeApp } from './app.js'

async function bootstrap() {
  const config = loadConfig()
  const logger = makeLogger({ env: config.env })

  logger.info('========================================================')
  logger.info('  Starting CCTV Visitor Management & Authorization API')
  logger.info('========================================================')
  logger.info('Environment configuration:', {
    env: config.env,
    port: config.port,
    databaseTarget: config.mongo.isAtlas ? 'MongoDB Atlas' : 'MongoDB',
    database: config.mongo.dbName,
  })

  if (!config.mongo.uri) {
    logger.warn('MONGODB_URI is not configured. The API will start, but every request that')
    logger.warn('touches the database will fail. Set it in backend/.env to enable data features.')
    logger.warn('Example: mongodb+srv://user:password@cluster0.example.net/vms_acs')
  }

  // Connect to MongoDB. A failure here is fatal: serving a console that can
  // never reach its data would hide the problem behind 500s at request time.
  const { client, db } = await createMongoClient(config.mongo.uri, {
    logger,
    dbName: config.mongo.dbName,
    maxPoolSize: config.db.max,
    minPoolSize: config.db.min,
  })

  // Apply pending schema migrations at startup so a fresh deployment converges
  // without a separate manual step.
  try {
    logger.info('Running database migrations check...')
    const applied = await runMongoMigrations(db, { logger })
    if (applied.length > 0) {
      logger.info(`Database schema updated: applied ${applied.length} migration(s).`)
    } else {
      logger.info('Database schema is up to date.')
    }
  } catch (err) {
    logger.error('Startup migration check failed:', { error: err.message })
    logger.warn('Continuing startup, but database queries may fail if schema is missing.')
  }

  // Assemble modules & Express app
  const modules = makeModules({ db, config, logger })
  const app = makeApp({ logger, modules, config })

  // Start HTTP server
  const server = app.listen(config.port, () => {
    logger.info(`Server successfully listening on port ${config.port}`)
    logger.info(`Health check available at http://localhost:${config.port}/health`)
    logger.info(`API index available at http://localhost:${config.port}/`)
  })

  // Graceful shutdown handling
  let isShuttingDown = false
  async function shutdown(signal) {
    if (isShuttingDown) return
    isShuttingDown = true
    logger.info(`Received ${signal}. Shutting down gracefully...`)

    server.close(async () => {
      logger.info('HTTP server closed.')
      try {
        await client.close()
        logger.info('MongoDB connections closed.')
      } catch (err) {
        logger.error('Error closing the MongoDB client:', { error: err.message })
      }
      process.exit(0)
    })

    // Force exit after 10s if connections do not close
    setTimeout(() => {
      logger.error('Forced shutdown after timeout.')
      process.exit(1)
    }, 10000).unref()
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

bootstrap().catch((err) => {
  console.error('[FATAL] Application bootstrap failure:', err)
  process.exit(1)
})
