import { loadConfig } from '../config/config.js'
import { createDbPool, pingDb } from '../platform/db/pool.js'
import { makeLogger } from '../shared/logger.js'

function maskUrl(raw) {
  try {
    const url = new URL(raw.replace(/^postgres(ql)?:/, 'http:'))
    if (url.password) url.password = '***'
    return url.toString().replace(/^http:/, 'postgresql:')
  } catch {
    return raw.replace(/:([^:@]+)@/, ':***@')
  }
}

async function runCheck() {
  console.log('='.repeat(65))
  console.log('       NEON POSTGRESQL CONNECTION & SCHEMA DIAGNOSTIC')
  console.log('='.repeat(65))

  let config
  try {
    config = loadConfig()
  } catch (err) {
    console.error('\n[CONFIG ERROR]:', err.message)
    process.exit(1)
  }

  if (!config.databaseUrl || config.databaseUrl.includes('placeholder')) {
    console.log('\n[!] Notice: DATABASE_URL in .env contains a placeholder or is not set.')
    console.log('    Target URL:', maskUrl(config.databaseUrl || '(empty)'))
    console.log('\n--> Next Step: Open .env and paste your real Neon PostgreSQL connection string:')
    console.log('    DATABASE_URL=postgresql://[user]:[password]@[endpoint].neon.tech/[dbname]?sslmode=require\n')
    process.exit(1)
  }

  const isNeon = config.databaseUrl.includes('neon.tech')
  const isPooled = config.databaseUrl.includes('-pooler.')
  const masked = maskUrl(config.databaseUrl)

  console.log(`\n  Environment:    ${config.env}`)
  console.log(`  Target URL:     ${masked}`)
  console.log(`  Database Type:  ${isNeon ? 'Neon Serverless PostgreSQL' : 'Standard PostgreSQL'}`)
  if (isNeon) {
    console.log(`  Endpoint Type:  ${isPooled ? 'Pooled Endpoint (PgBouncer)' : 'Direct Endpoint (Recommended for migrations)'}`)
  }

  console.log('\n[*] Testing connection to Neon...')
  const startTime = Date.now()
  const logger = makeLogger({ env: 'test' })
  const pool = createDbPool(config.databaseUrl, { ...config.db, logger })

  try {
    const pingRes = await pingDb(pool, 10000)
    const latency = Date.now() - startTime
    const dbName = pingRes.rows[0].db_name
    const pgVersion = pingRes.rows[0].version.split(' ')[1]

    console.log(`[+] Connected successfully! Latency: ${latency}ms`)
    console.log(`    Active Database: ${dbName}`)
    console.log(`    PostgreSQL Version: ${pgVersion}`)

    // Inspect tables
    const tablesRes = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name ASC
    `)
    const tables = tablesRes.rows.map((r) => r.table_name)
    console.log(`\n[*] Public Schema Tables (${tables.length} found):`)
    if (tables.length === 0) {
      console.log('    (None found yet. Run "npm run migrate" to create tables)')
    } else {
      console.log('    ' + tables.join(', '))
    }

    // Check migration table
    if (tables.includes('schema_migrations')) {
      const migRes = await pool.query('SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC')
      console.log(`\n[*] Applied Migrations (${migRes.rows.length}):`)
      for (const m of migRes.rows) {
        console.log(`    - [${m.version}] ${m.name} (${new Date(m.applied_at).toLocaleString()})`)
      }
    }

    // Check row counts if tables exist
    if (tables.includes('visitors')) {
      const vCount = await pool.query('SELECT count(*)::int as count FROM visitors')
      console.log(`\n[*] Registered Visitors: ${vCount.rows[0].count}`)
    }
    if (tables.includes('cameras')) {
      const cCount = await pool.query('SELECT count(*)::int as count FROM cameras')
      console.log(`[*] Monitored CCTV Cameras: ${cCount.rows[0].count}`)
    }
    if (tables.includes('identifications')) {
      const iCount = await pool.query('SELECT count(*)::int as count FROM identifications')
      console.log(`[*] CCTV Identification Detections: ${iCount.rows[0].count}`)
    }

    console.log('\n' + '='.repeat(65))
    console.log('  SUCCESS: Neon database is connected, healthy, and ready!')
    console.log('='.repeat(65) + '\n')
  } catch (err) {
    console.error('\n' + '!'.repeat(65))
    console.error('  ERROR: Could not connect to Neon database!')
    console.error('!'.repeat(65))
    console.error(`Reason: ${err.message}\n`)

    if (err.message.includes('SSL') || !config.databaseUrl.includes('sslmode=require')) {
      console.error('Tip: Neon requires SSL. Verify your connection string ends with ?sslmode=require')
    }
    if (err.message.includes('password authentication failed')) {
      console.error('Tip: Check your database username and password in .env')
    }
    if (err.message.includes('ETIMEDOUT') || err.message.includes('timeout')) {
      console.error('Tip: Neon compute may be waking up from cold suspension. Try running again in a few seconds.')
    }
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

runCheck()
