import { loadConfig } from '../config/config.js'
import { createMongoClient, pingMongo, mongoServerInfo } from '../platform/db/mongo.js'
import { makeLogger } from '../shared/logger.js'
import { COLLECTIONS } from '../shared/mongo/helpers.js'

/** Masks the password so the connection string can be printed safely. */
function maskUri(raw) {
  try {
    const authority = raw.replace(/^mongodb(\+srv)?:\/\//, '').split('/')[0]
    const at = authority.lastIndexOf('@')
    if (at === -1) return raw
    return raw.replace(authority.slice(0, at), '<user:password>')
  } catch {
    return '<unparseable>'
  }
}

async function runCheck() {
  console.log('='.repeat(65))
  console.log('       MONGODB CONNECTION & SCHEMA DIAGNOSTIC')
  console.log('='.repeat(65))

  const config = loadConfig()
  const logger = makeLogger({ env: 'test' })

  if (!config.mongo.uri) {
    console.log('\n[!] MONGODB_URI is not set in backend/.env.')
    console.log('    Add one of:')
    console.log('      mongodb+srv://user:password@cluster0.example.net/vms_acs   (Atlas)')
    console.log('      mongodb://user:password@localhost:27017/vms_acs            (self-hosted)')
    process.exit(1)
  }

  console.log(`\n  Environment:    ${config.env}`)
  console.log(`  Target URI:     ${maskUri(config.mongo.uri)}`)
  console.log(`  Database:       ${config.mongo.dbName}`)
  console.log(`  Database Type:  ${config.mongo.isAtlas ? 'MongoDB Atlas' : 'MongoDB'}`)
  console.log(
    `  Transactions:   ${config.mongo.supportsTransactions ? 'available' : 'unavailable (not a replica set)'}`
  )

  console.log('\n[*] Testing connection...')

  const { client, db } = await createMongoClient(config.mongo.uri, {
    logger,
    dbName: config.mongo.dbName,
    maxPoolSize: config.db.max,
    minPoolSize: config.db.min,
  })

  try {
    const { latencyMs } = await pingMongo(db)
    console.log(`[+] Connected successfully! Latency: ${latencyMs}ms`)

    const info = await mongoServerInfo(db)
    if (info.version) console.log(`    Server Version:  ${info.version}`)

    // Collections are MongoDB's equivalent of tables.
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    const names = collections.map((c) => c.name).sort();

    console.log(`\n[*] Collections (${names.length} found):`)
    if (names.length === 0) {
      console.log('    (none yet. Run "npm run migrate" to create them)')
    } else {
      for (const name of names) console.log(`    ${name}`)
    }

    // Applied migrations.
    if (names.includes(COLLECTIONS.schemaMigrations)) {
      const applied = await db
        .collection(COLLECTIONS.schemaMigrations)
        .find()
        .sort({ version: 1 })
        .toArray();
      console.log(`\n[*] Applied Migrations (${applied.length}):`);
      for (const m of applied) {
        console.log(`    - [${m.version}] ${m.name} (${new Date(m.applied_at).toLocaleString()})`)
      }
    }

    // Document counts, mirroring the old per-table row counts.
    const counts = [
      ['users', 'Operators'],
      ['zones', 'Security Zones'],
      ['cameras', 'Monitored CCTV Cameras'],
      ['visitors', 'Registered Visitors'],
      ['visits', 'Visit Passes'],
      ['identifications', 'CCTV Identification Detections'],
      ['security_alerts', 'Security Alerts'],
      ['audit_logs', 'Audit Entries'],
      ['recordings', 'Uploaded Recordings'],
    ];

    console.log('\n[*] Record Counts:')
    for (const [collection, label] of counts) {
      if (!names.includes(collection)) continue;
      const count = await db.collection(collection).countDocuments();
      console.log(`    ${label}: ${count}`);
    }

    // Index verification: the migrations exist to keep these query paths fast.
    console.log('\n[*] Index Coverage:')
    for (const collection of names) {
      if (collection === COLLECTIONS.schemaMigrations) continue;
      const indexes = await db.collection(collection).indexes();
      const userIndexes = indexes.filter((i) => i.name !== '_id_');
      console.log(`    ${collection}: ${userIndexes.length} index(es)`);
    }

    console.log('\n' + '='.repeat(65))
    console.log('  SUCCESS: MongoDB is connected, healthy, and ready!')
    console.log('='.repeat(65) + '\n')
  } catch (err) {
    console.error('\n' + '!'.repeat(65))
    console.error('  ERROR: Could not connect to MongoDB!')
    console.error('!'.repeat(65))
    console.error(`Reason: ${err.message}\n`)

    if (/Authentication failed/i.test(err.message)) {
      console.error('Tip: Check the username and password in MONGODB_URI.')
      console.error('     In Atlas, confirm the database user has a role on this database')
      console.error('     (Database Access -> the user must be granted a role, not just added).')
    }
    if (/not authorized|Unauthorized/i.test(err.message)) {
      console.error('Tip: Authentication succeeded but the operation was refused. The database')
      console.error('     user likely lacks a role on this database. See Atlas -> Database Access.')
    }
    if (/ENOTFOUND|EAI_AGAIN|querySrv/i.test(err.message)) {
      console.error('Tip: Hostname could not be resolved. Check the cluster host in the URI and')
      console.error('     your network/DNS. A typo in the cluster name is the usual cause.')
    }
    if (/ETIMEDOUT|ECONNREFUSED|timed out/i.test(err.message)) {
      console.error('Tip: The deployment did not respond. It may be starting up, or blocked by a')
      console.error('     firewall. IP allow-list rules are a common cause on Atlas.')
    }
    process.exitCode = 1
  } finally {
    await client.close()
  }
}

runCheck()