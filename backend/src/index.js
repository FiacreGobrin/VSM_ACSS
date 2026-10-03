import { loadConfig } from './config/config.js'
import { makeLogger } from './shared/logger.js'
import { createDbPool } from './platform/db/pool.js'
import { runMigrations } from './platform/db/migrate.js'
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
    databaseTarget: config.isNeon ? 'Neon Serverless PostgreSQL' : 'PostgreSQL',
  })

  // Initialize Neon database pool
  const db = createDbPool(config.databaseUrl, { ...config.db, logger })

  // Auto-run schema migrations on startup if valid connection string is provided
  if (config.databaseUrl && !config.databaseUrl.includes('placeholder')) {
    try {
      logger.info('Running database migrations check...')
      const applied = await runMigrations(db, { logger })
      if (applied.length > 0) {
        logger.info(`Database schema updated: applied ${applied.length} migration(s).`)
      } else {
        logger.info('Database schema is up to date.')
      }
    } catch (err) {
      logger.error('Startup migration check failed:', { error: err.message })
      logger.warn('Continuing startup, but database queries may fail if schema is missing.')
    }
  } else {
    logger.warn('DATABASE_URL is not configured yet with real Neon credentials.')
    logger.warn('Update .env with your Neon connection string to enable database features.')
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
        await db.end()
        logger.info('Database connections closed.')
      } catch (err) {
        logger.error('Error closing database pool:', { error: err.message })
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
