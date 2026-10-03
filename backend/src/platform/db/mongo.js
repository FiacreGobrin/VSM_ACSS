import { MongoClient } from 'mongodb'
import { AppError } from '../../shared/errors.js'

/**
 * Creates a connected MongoClient and returns the target database handle.
 *
 * The returned object is `{ client, db }`. Callers hold `db` and call
 * `client.close()` on shutdown - the client must outlive every collection
 * handle derived from it.
 */
export async function createMongoClient(uri, options = {}) {
  const { logger, dbName = 'vms_acs', maxPoolSize = 20, minPoolSize = 2, ...rest } = options

  if (!uri) {
    throw new AppError(
      'MONGODB_URI is not configured. Set it in backend/.env to point at your MongoDB deployment.',
      500,
      'database_unavailable'
    )
  }

  const client = new MongoClient(uri, {
    maxPoolSize,
    minPoolSize,
    // Fail fast with an actionable message instead of buffering operations for
    // 30 seconds when the deployment is unreachable or DNS is wrong.
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    // Fail a query rather than hang forever if the primary steps down mid-poll.
    socketTimeoutMS: 45000,
    ...rest,
  })

  try {
    await client.connect();
  } catch (err) {
    // Close the half-open client so a failed boot does not leak a retry loop.
    await client.close().catch(() => {});

    if (logger) {
      logger.error('MongoDB connection failed:', { error: err.message });
    }

    throw new AppError(
      `Unable to connect to MongoDB: ${err.message}. Verify MONGODB_URI in backend/.env, that the ` +
        'deployment is reachable from this host, and that the database user is allowed on the target database.',
      503,
      'database_unavailable'
    );
  }

  const db = client.db(dbName);

  if (logger) {
    logger.info('MongoDB connected', { database: dbName });
  }

  return { client, db };
}

/**
 * Round-trips a trivial command to prove the connection is genuinely alive.
 *
 * Mirrors the old `SELECT 1` ping: it resolves server selection, so a cold or
 * suspended deployment (Atlas free clusters are suspended aggressively) wakes
 * before the caller believes it is online.
 */
export async function pingMongo(db) {
  const startedAt = Date.now();
  await db.command({ ping: 1 });
  return { latencyMs: Date.now() - startedAt };
}

/**
 * Closes the client and surfaces connection health for the health endpoint.
 */
export async function mongoServerInfo(db) {
  try {
    // buildInfo is a server-wide command; guarded because managed deployments
    // sometimes restrict it.
    const info = await db.command({ buildInfo: 1 });
    return { version: info.version };
  } catch {
    return { version: null };
  }
}