import express from 'express'
import cors from 'cors'
import { requestLogger } from './shared/middleware/requestLogger.js'
import { errorHandler } from './shared/middleware/errorHandler.js'
import { sendError, sendSuccess } from './shared/http/respond.js'

export function makeApp({ logger, modules, config }) {
  const app = express()

  app.disable('x-powered-by')
  app.use(cors({ origin: config?.cors?.origin || '*' }))
  app.use(express.json({ limit: '5mb' })) // allow base64 frames if needed
  app.use(requestLogger(logger))

  // Root welcome & API directory
  app.get('/', (req, res) => {
    sendSuccess(res, {
      name: 'Visitor Management & CCTV Camera Identification API',
      version: '1.1.0',
      database: config.mongo.isAtlas ? 'MongoDB Atlas' : 'MongoDB',
      endpoints: {
        health: '/health',
        auth: '/api/v1/auth',
        visitors: '/api/v1/visitors',
        visits: '/api/v1/visits',
        cameras: '/api/v1/cameras',
        recordings: '/api/v1/recordings',
        identifications: '/api/v1/identification/detections',
        alerts: '/api/v1/identification/alerts',
        audit: '/api/v1/audit',
        dashboard: '/api/v1/dashboard/summary',
      },
    })
  })

  // Mount modules
  for (const module of modules) {
    app.use(module.mount, module.router)
    logger.info(`Module mounted: ${module.name} at ${module.mount}`)
  }

  // 404 Catch-all
  app.use((req, res) => {
    sendError(res, 404, 'not_found', `Cannot ${req.method} ${req.originalUrl}`)
  })

  // Central error handler
  app.use(errorHandler(logger))

  return app
}
