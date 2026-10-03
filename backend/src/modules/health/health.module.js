import { Router } from 'express'
import { pingMongo, mongoServerInfo } from '../../platform/db/mongo.js'
import { sendSuccess } from '../../shared/http/respond.js'

export function makeHealthModule({ db, config }) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const startTime = Date.now();
      let dbStatus = 'disconnected';
      let dbLatency = null;
      let dbInfo = null;

      try {
        // Resolves server selection, so a suspended deployment (Atlas free
        // clusters idle out aggressively) wakes before we report it healthy.
        await pingMongo(db);
        dbStatus = 'connected';
        dbLatency = `${Date.now() - startTime}ms`;

        const info = await mongoServerInfo(db);
        dbInfo = {
          database: config.mongo.dbName,
          provider: config.mongo.isAtlas ? 'MongoDB Atlas' : 'MongoDB',
          version: info.version,
        };
      } catch (err) {
        dbStatus = `error: ${err.message}`;
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
      });
    } catch (err) {
      next(err);
    }
  });

  return {
    name: 'health',
    mount: '/health',
    router,
  };
}
