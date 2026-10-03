import { Router } from 'express'
import { pingDb } from '../../platform/db/pool.js'
import { sendSuccess } from '../../shared/http/respond.js'

export function makeHealthModule({ db, config }) {
  const router = Router()

  router.get('/', async (req, res, next) => {
    try {
      const startTime = Date.now()
      let dbStatus = 'disconnected'
      let dbLatency = null
      let dbInfo = null

      try {
        const pingRes = await pingDb(db, 3000)
        dbStatus = 'connected'
        dbLatency = `${Date.now() - startTime}ms`
        if (pingRes.rows && pingRes.rows[0]) {
          dbInfo = {
            database: pingRes.rows[0].db_name,
            provider: config.isNeon ? 'Neon Serverless Postgres' : 'PostgreSQL',
          }
        }
      } catch (err) {
        dbStatus = `error: ${err.message}`
      }

      sendSuccess(res, {
        status: dbStatus === 'connected' ? 'ok' : 'degraded',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        database: {
          status: dbStatus,
          latency: dbLatency,
          ...dbInfo,
        },
      })
    } catch (err) {
      next(err)
    }
  })

  return {
    name: 'health',
    mount: '/health',
    router,
  }
}
