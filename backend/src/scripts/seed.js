import bcrypt from 'bcryptjs'
import { loadConfig } from '../config/config.js'
import { createDbPool } from '../platform/db/pool.js'
import { makeLogger } from '../shared/logger.js'

async function seed() {
  const config = loadConfig()
  const logger = makeLogger({ env: config.env })

  if (!config.databaseUrl || config.databaseUrl.includes('placeholder')) {
    logger.error('Cannot seed database: DATABASE_URL in .env contains a placeholder.')
    process.exit(1)
  }

  const pool = createDbPool(config.databaseUrl, { ...config.db, logger })

  try {
    logger.info('Seeding database with initial records...')

    // 1. Users — one per operational role so the console's RBAC matrix
    //    renders against real records rather than browser-side fixtures.
    const salt = await bcrypt.genSalt(10)
    const adminPass = await bcrypt.hash('AdminPass123!', salt)
    const guardPass = await bcrypt.hash('GuardPass123!', salt)
    const auditorPass = await bcrypt.hash('AuditorPass123!', salt)

    const userRes = await pool.query(`
      INSERT INTO users (username, email, password_hash, role, full_name, department, badge_number, clearance_level, mfa_enabled)
      VALUES
        ('admin', 'admin@security.local', $1, 'admin', 'System Administrator', 'Directorate of Infrastructure & Defense', 'SA-9001-ALPHA', 'TOP_SECRET', true),
        ('guard_john', 'guard.john@security.local', $2, 'guard', 'Officer John Doe', 'SOC Watch Command - Shift A', 'SO-4412-BRAVO', 'RESTRICTED', true),
        ('auditor_mugisha', 'd.mugisha@compliance.gov.lan', $3, 'auditor', 'David Mugisha', 'National Cyber Security & Audit Authority', 'AUD-8802-REG', 'RESTRICTED', true)
      ON CONFLICT (username) DO NOTHING
      RETURNING id, username, role
    `, [adminPass, guardPass, auditorPass])
    logger.info(`Users seeded: ${userRes.rows.length} created (admin / AdminPass123!)`)

    // 2. Zones
    const zoneRes = await pool.query(`
      INSERT INTO zones (name, description, security_level)
      VALUES 
        ('Main Entrance & Turnstiles', 'Building main perimeter access', 1),
        ('Lobby & Visitor Lounge', 'Public reception and waiting area', 1),
        ('Executive Suites - Floor 3', 'Restricted management offices', 2),
        ('Server Room & Infrastructure', 'Restricted mission critical facility', 4)
      ON CONFLICT (name) DO NOTHING
      RETURNING id, name, security_level
    `)
    logger.info(`Security Zones seeded: ${zoneRes.rows.length} created`)

    // Fetch zones for camera and visit assignment
    const allZones = (await pool.query('SELECT id, name FROM zones')).rows
    const mainEntranceZone = allZones.find(z => z.name.includes('Main Entrance'))?.id
    const lobbyZone = allZones.find(z => z.name.includes('Lobby'))?.id
    const serverRoomZone = allZones.find(z => z.name.includes('Server Room'))?.id

    // 3. CCTV Cameras
    const cameraRes = await pool.query(`
      INSERT INTO cameras (name, zone_id, ip_address, stream_url, model, status, ai_features_enabled)
      VALUES
        ('CAM-01-ENTRANCE-G1', $1, '192.168.10.101', 'rtsp://stream.local/cam01', 'Hikvision 4K AI-PTZ', 'online', true),
        ('CAM-02-LOBBY-DESK', $2, '192.168.10.102', 'rtsp://stream.local/cam02', 'Axis Dome AI P3245', 'online', true),
        ('CAM-03-SERVER-SECURE', $3, '192.168.10.103', 'rtsp://stream.local/cam03', 'Bosch Flexidome 5000i', 'online', true)
      RETURNING id, name
    `, [mainEntranceZone, lobbyZone, serverRoomZone])
    logger.info(`CCTV Cameras seeded: ${cameraRes.rows.length} created`)

    // 4. Visitors
    const visitorRes = await pool.query(`
      INSERT INTO visitors (full_name, id_type, id_number, company, email, phone, status, notes)
      VALUES
        ('Sarah Connor', 'national_id', 'NAT-994821', 'Cyberdyne Systems', 'sarah@example.com', '+1-555-0199', 'active', 'Regular contractor'),
        ('Thomas Anderson', 'passport', 'PASS-8472910', 'MetaCortex', 'tanderson@example.com', '+1-555-0182', 'active', 'Software auditor'),
        ('Victor Black', 'national_id', 'NAT-000666', 'Shadow Brokerage', 'vblack@example.com', '+1-555-0100', 'blacklisted', 'Security breach incident in 2025 - DO NOT ADMIT')
      ON CONFLICT (id_type, id_number) DO NOTHING
      RETURNING id, full_name, status
    `)
    logger.info(`Visitors seeded: ${visitorRes.rows.length} created`)

    // 5. Visit Passes — give the visitor desk and SOC dashboard real occupancy
    //    data. Idempotent via the host+visitor+purpose natural key check.
    const visitorRows = (await pool.query('SELECT id, full_name FROM visitors')).rows
    const findVisitor = (name) => visitorRows.find((v) => v.full_name === name)?.id

    const sarahId = findVisitor('Sarah Connor')
    const thomasId = findVisitor('Thomas Anderson')

    const existingVisits = await pool.query('SELECT count(*)::int AS total FROM visits')
    if (existingVisits.rows[0].total === 0 && sarahId && thomasId) {
      const visitRes = await pool.query(
        `INSERT INTO visits (
           visitor_id, host_name, host_email, purpose, badge_number,
           status, check_in_at, expected_arrival, authorized_zones, on_site
         ) VALUES
           ($1, 'Eng. Patrick Habimana', 'p.habimana@datacenter.facility.lan',
            'Server enclave maintenance oversight', 'BADGE-4401',
            'checked_in', now() - interval '3 hours', now() - interval '3 hours', $3::jsonb, true),
           ($2, 'Elena Rossi', 'e.rossi@primefin.facility.lan',
            'Executive suite quarterly audit', 'BADGE-4402',
            'checked_in', now() - interval '1 hour', now() - interval '1 hour', $3::jsonb, true),
           ($1, 'Claire Mukamana', 'c.mukamana@lobby.facility.lan',
            'Data center tour & onboarding', 'BADGE-4403',
            'scheduled', NULL, now() + interval '4 hours', $3::jsonb, false)
         RETURNING id, badge_number, status`,
        [sarahId, thomasId, JSON.stringify([serverRoomZone].filter(Boolean))]
      )
      logger.info(`Visit passes seeded: ${visitRes.rows.length} created`)

      // 6. Security Alerts — populate the SOC alert feed and dashboard counters.
      const cameraRows = (await pool.query('SELECT id, zone_id FROM cameras ORDER BY name')).rows
      const entranceCam = cameraRows[0]
      const serverCam = cameraRows.find((c) => c.zone_id === serverRoomZone) || cameraRows[0]

      if (entranceCam && serverCam) {
        const alertRes = await pool.query(
          `INSERT INTO security_alerts (camera_id, severity, title, description, is_acknowledged)
           VALUES
             ($1, 'high',   'ALERT: Unrecognized Person in Secured Zone',
                   'An unidentified individual was detected by CCTV in a restricted zone (Security Level 4).', false),
             ($1, 'medium', 'ALERT: Tailgating Detected',
                   'Multiple persons detected passing through single-badge checkpoint.', false),
             ($2, 'low',    'INFO: Camera Heartbeat Drift',
                   'Camera stream latency exceeded 200ms threshold during peak ingestion.', true)
           RETURNING id`,
          [serverCam.id, entranceCam.id]
        )
        logger.info(`Security alerts seeded: ${alertRes.rows.length} created`)
      }
    } else {
      logger.info('Visit passes already present, skipping.')
    }

    logger.info('Database seeding completed successfully!')
  } catch (err) {
    logger.error('Seeding failed:', { error: err.message })
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

seed()
