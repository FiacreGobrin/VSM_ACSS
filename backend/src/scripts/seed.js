import bcrypt from 'bcryptjs'
import { loadConfig } from '../config/config.js'
import { createMongoClient } from '../platform/db/mongo.js'
import { makeLogger } from '../shared/logger.js'
import { COLLECTIONS, newId } from '../shared/mongo/helpers.js'

const HOURS = (n) => new Date(Date.now() - n * 60 * 60 * 1000);

/**
 * Seeds a realistic facility snapshot: operators, zones, cameras, visitors,
 * live visits, detections and alerts.
 *
 * Every insert is keyed on a natural business key (username, zone name, ...)
 * rather than blindly inserted, so re-running `npm run db:seed` is safe and
 * will not duplicate the sample data.
 */
async function runSeed() {
  const config = loadConfig();
  const logger = makeLogger({ env: config.env });

  if (!config.mongo.uri) {
    logger.error('Cannot seed: MONGODB_URI is not set in backend/.env.');
    process.exit(1);
  }

  const { client, db } = await createMongoClient(config.mongo.uri, {
    logger,
    dbName: config.mongo.dbName,
    maxPoolSize: config.db.max,
    minPoolSize: config.db.min,
  });

  const users = db.collection(COLLECTIONS.users);
  const zones = db.collection(COLLECTIONS.zones);
  const cameras = db.collection(COLLECTIONS.cameras);
  const visitors = db.collection(COLLECTIONS.visitors);
  const visits = db.collection(COLLECTIONS.visits);
  const identifications = db.collection(COLLECTIONS.identifications);
  const alerts = db.collection(COLLECTIONS.securityAlerts);
  const auditLogs = db.collection(COLLECTIONS.auditLogs);

  try {
    logger.info('Seeding MongoDB...');

    const now = new Date();

    // ---------------------------------------------------------- operators
    const operatorSpecs = [
      {
        username: 'admin',
        password: 'AdminPass123!',
        role: 'admin',
        full_name: 'Alex Mutebi',
        email: 'admin@facility.lan',
        department: 'Directorate of Infrastructure & Defense',
        badge_number: 'SA-9001-ALPHA',
        clearance_level: 'TOP_SECRET',
      },
      {
        username: 'guard_john',
        password: 'GuardPass123!',
        role: 'guard',
        full_name: 'John Kamanzi',
        email: 'j.kamanzi@facility.lan',
        department: 'Perimeter Security',
        badge_number: 'SEC-2201',
        clearance_level: 'RESTRICTED',
      },
      {
        username: 'auditor_mugisha',
        password: 'AuditorPass123!',
        role: 'auditor',
        full_name: 'Grace Mugisha',
        email: 'g.mugisha@audit.lan',
        department: 'Compliance & Internal Audit',
        badge_number: 'AUD-0012',
        clearance_level: 'RESTRICTED',
      },
    ];

    for (const spec of operatorSpecs) {
      if (await users.findOne({ username: spec.username })) {
        logger.info(`  operator "${spec.username}" already exists - skipped`);
        continue;
      }
      await users.insertOne({
        id: newId(),
        username: spec.username,
        email: spec.email,
        password_hash: await bcrypt.hash(spec.password, 10),
        role: spec.role,
        full_name: spec.full_name,
        status: 'active',
        department: spec.department,
        badge_number: spec.badge_number,
        clearance_level: spec.clearance_level,
        mfa_enabled: true,
        last_login_at: null,
        created_at: now,
        updated_at: now,
      });
    }
    logger.info(`Operators ensured: ${operatorSpecs.length}`);

    const admin = await users.findOne({ username: 'admin' });
// -------------------------------------------------------------- zones
    const zoneSpecs = [
      { name: 'Main Entrance & Lobby', description: 'Primary public access point', security_level: 2 },
      { name: 'Server Room', description: 'Critical infrastructure - restricted', security_level: 5 },
      { name: 'Loading Dock', description: 'Goods and vehicle intake', security_level: 3 },
    ];

    const zoneIds = {};
    for (const spec of zoneSpecs) {
      const existing = await zones.findOne({ name: spec.name });
      if (existing) {
        zoneIds[spec.name] = existing.id;
        continue;
      }
      const id = newId();
      await zones.insertOne({
        id,
        name: spec.name,
        description: spec.description,
        security_level: spec.security_level,
        created_at: now,
        updated_at: now,
      });
      zoneIds[spec.name] = id;
    }
    logger.info(`Security zones ensured: ${Object.keys(zoneIds).length}`);

    // ------------------------------------------------------------ cameras
    const cameraSpecs = [
      { name: 'Lobby Wide 01', zone: 'Main Entrance & Lobby', ip: '10.10.0.11', model: 'Hikvision DS-2CD8A' },
      { name: 'Server Room 01', zone: 'Server Room', ip: '10.10.0.21', model: 'Hikvision DS-2CD8A' },
      { name: 'Dock Cam 01', zone: 'Loading Dock', ip: '10.10.0.31', model: 'Axis P3265' },
    ];

    const cameraIds = {};
    for (const spec of cameraSpecs) {
      const existing = await cameras.findOne({ name: spec.name });
      if (existing) {
        cameraIds[spec.name] = existing.id;
        continue;
      }
      const id = newId();
      await cameras.insertOne({
        id,
        name: spec.name,
        zone_id: zoneIds[spec.zone] || null,
        ip_address: spec.ip,
        stream_url: `rtsp://${spec.ip}:554/Streaming/Channels/101`,
        model: spec.model,
        ai_features_enabled: true,
        status: 'online',
        last_heartbeat_at: now,
        last_recording_id: null,
        created_at: now,
        updated_at: now,
      });
      cameraIds[spec.name] = id;
    }
    logger.info(`CCTV cameras ensured: ${Object.keys(cameraIds).length}`);

    // ----------------------------------------------------------- visitors
    const visitorSpecs = [
      {
        full_name: 'Sarah Connor',
        id_type: 'national_id',
        id_number: '1198580029381014',
        company: 'Cyberdyne Systems',
        status: 'active',
        notes: '',
      },
      {
        full_name: 'Thomas Anderson',
        id_type: 'passport',
        id_number: 'PA9920145',
        company: 'Matrix Industries',
        status: 'blacklisted',
        notes: 'Security breach incident in 2025 - DO NOT ADMIT',
      },
    ];

    const visitorIds = {};
    for (const spec of visitorSpecs) {
      // The compound unique index is (id_type, id_number).
      const existing = await visitors.findOne({ id_type: spec.id_type, id_number: spec.id_number });
      if (existing) {
        visitorIds[spec.full_name] = existing.id;
        continue;
      }
      const id = newId();
      await visitors.insertOne({
        id,
        full_name: spec.full_name,
        id_type: spec.id_type,
        id_number: spec.id_number,
        company: spec.company,
        email: `${spec.full_name.split(' ')[0].toLowerCase()}@example.com`,
        phone: null,
        photo_url: null,
        face_feature_vector: null,
        status: spec.status,
        notes: spec.notes,
        created_at: now,
        updated_at: now,
      });
      visitorIds[spec.full_name] = id;
    }
    logger.info(`Visitors ensured: ${Object.keys(visitorIds).length}`);
// ------------------------------------------------------------- visits
    if ((await visits.countDocuments({})) === 0) {
      const visitSpecs = [
        {
          visitor: 'Sarah Connor',
          host_name: 'Eng. Patrick Habimana',
          purpose: 'Server enclave maintenance oversight',
          badge_number: 'BADGE-4401',
          hours_ago: 3,
        },
        {
          visitor: 'Sarah Connor',
          host_name: 'Elena Rossi',
          purpose: 'Executive suite quarterly audit',
          badge_number: 'BADGE-4402',
          hours_ago: 1,
        },
      ];

      for (const spec of visitSpecs) {
        await visits.insertOne({
          id: newId(),
          visitor_id: visitorIds[spec.visitor],
          host_name: spec.host_name,
          host_email: null,
          purpose: spec.purpose,
          badge_number: spec.badge_number,
          status: 'checked_in',
          check_in_at: HOURS(spec.hours_ago),
          check_out_at: null,
          expected_arrival: HOURS(spec.hours_ago),
          authorized_zones: [],
          on_site: true,
          created_at: HOURS(spec.hours_ago + 1),
          updated_at: HOURS(spec.hours_ago),
        });
      }
      logger.info(`Visit passes created: ${visitSpecs.length}`);
    } else {
      logger.info('Visits already present - skipped');
    }

    // ------------------------------------------------------- detections
    if ((await identifications.countDocuments({})) === 0) {
      await identifications.insertOne({
        id: newId(),
        camera_id: cameraIds['Server Room 01'],
        visitor_id: visitorIds['Thomas Anderson'],
        event_type: 'blacklisted_person_alert',
        confidence_score: 0.9712,
        captured_frame_url: null,
        detected_bounding_box: { x: 0.21, y: 0.34, w: 0.18, h: 0.41 },
        notes: 'Match against blacklisted identity',
        detected_at: HOURS(2),
        created_at: HOURS(2),
      });
      logger.info('CCTV detection created: 1');
    } else {
      logger.info('Detections already present - skipped');
    }

    // ----------------------------------------------------------- alerts
    if ((await alerts.countDocuments({})) === 0) {
      const blacklistedId = await identifications.findOne({ event_type: 'blacklisted_person_alert' });
      await alerts.insertOne({
        id: newId(),
        identification_id: blacklistedId ? blacklistedId.id : null,
        camera_id: cameraIds['Server Room 01'],
        severity: 'critical',
        title: 'CRITICAL: Blacklisted Individual Detected',
        description:
          'An unidentified individual was detected by CCTV in a restricted zone (Security Level 4).',
        is_acknowledged: false,
        acknowledged_by: null,
        acknowledged_at: null,
        created_at: HOURS(2),
      });
      logger.info('Security alerts created: 1');
    } else {
      logger.info('Alerts already present - skipped');
    }

    // ------------------------------------------------------ audit trail
    if ((await auditLogs.countDocuments({})) === 0 && admin) {
      await auditLogs.insertOne({
        id: newId(),
        user_id: admin.id,
        action: 'SEED_DATABASE',
        entity_type: 'system',
        entity_id: null,
        ip_address: '127.0.0.1',
        details: { note: 'Initial facility snapshot seeded' },
        created_at: now,
      });
      logger.info('Audit entry created: 1');
    } else {
      logger.info('Audit log already present - skipped');
    }

    logger.info('');
    logger.info('Seed complete. Default credentials:');
    logger.info('  admin / AdminPass123!              (super_admin)')
    logger.info('  guard_john / GuardPass123!         (receptionist)')
    logger.info('  auditor_mugisha / AuditorPass123!  (auditor)')
  } finally {
    await client.close();
  }
}

runSeed().catch((err) => {
  console.error('[FATAL] Seed failed:', err);
  process.exit(1);
});