import { defineCollection, schema, index } from './_helpers.js'

/**
 * Migration 0001 - core schema.
 *
 * Replaces `0001_initial_schema.up.sql`: users, zones, visitors, visits,
 * cameras, identifications, security alerts and audit logs.
 *
 * Field names deliberately mirror the old PostgreSQL column names, so documents
 * serialise to exactly the JSON the console already consumes and no frontend
 * change is required.
 */

const uuid = { bsonType: 'string', description: 'UUID primary key (generated in app code)' };

export async function up(db) {
  // ---------------------------------------------------------------- users
  await defineCollection(db, 'users', {
    validator: schema({
      required: ['id', 'username', 'email', 'password_hash', 'role', 'full_name', 'status'],
      properties: {
        id: uuid,
        username: { bsonType: 'string' },
        email: { bsonType: 'string' },
        password_hash: { bsonType: 'string' },
        // CHECK (role IN (...)) -> enum
        role: { enum: ['admin', 'operator', 'guard', 'auditor'] },
        full_name: { bsonType: 'string' },
        status: { enum: ['active', 'suspended', 'inactive'] },
        created_at: { bsonType: 'date' },
        updated_at: { bsonType: 'date' },
      },
    }),
  });
  await index(db, 'users', { username: 1 }, { unique: true, name: 'idx_users_username' });
  await index(db, 'users', { email: 1 }, { unique: true, name: 'idx_users_email' });
  await index(db, 'users', { role: 1 }, { name: 'idx_users_role' });
  await index(db, 'users', { id: 1 }, { unique: true, name: 'idx_users_id' });

  // ---------------------------------------------------------------- zones
  await defineCollection(db, 'zones', {
    validator: schema({
      required: ['id', 'name', 'security_level'],
      properties: {
        id: uuid,
        name: { bsonType: 'string' },
        description: { bsonType: 'string' },
        // CHECK (security_level BETWEEN 1 AND 5) -> minimum/maximum
        security_level: { bsonType: 'int', minimum: 1, maximum: 5 },
        created_at: { bsonType: 'date' },
        updated_at: { bsonType: 'date' },
      },
    }),
  });
  await index(db, 'zones', { name: 1 }, { unique: true, name: 'idx_zones_name' });
  await index(db, 'zones', { id: 1 }, { unique: true, name: 'idx_zones_id' });

  // ------------------------------------------------------------- visitors
  await defineCollection(db, 'visitors', {
    validator: schema({
      required: ['id', 'full_name', 'id_type', 'id_number', 'status'],
      properties: {
        id: uuid,
        full_name: { bsonType: 'string' },
        id_type: { enum: ['national_id', 'passport', 'drivers_license', 'other'] },
        id_number: { bsonType: 'string' },
        company: { bsonType: 'string' },
        email: { bsonType: ['string', 'null'] },
        phone: { bsonType: ['string', 'null'] },
        photo_url: { bsonType: ['string', 'null'] },
        // The Postgres JSONB column becomes an embedded document; a face
        // embedding is stored as a native array of doubles.
        face_feature_vector: { bsonType: ['array', 'null'] },
        status: { enum: ['active', 'blacklisted', 'flagged'] },
        notes: { bsonType: 'string' },
        created_at: { bsonType: 'date' },
        updated_at: { bsonType: 'date' },
      },
    }),
  });
  // UNIQUE (id_type, id_number) -> compound unique index
  await index(
    db,
    'visitors',
    { id_type: 1, id_number: 1 },
    { unique: true, name: 'idx_visitors_id_type_id_number' }
  );
  await index(db, 'visitors', { full_name: 1 }, { name: 'idx_visitors_full_name' });
  await index(db, 'visitors', { status: 1 }, { name: 'idx_visitors_status' });
  await index(db, 'visitors', { id: 1 }, { unique: true, name: 'idx_visitors_id' });

  // --------------------------------------------------------------- visits
  await defineCollection(db, 'visits', {
    validator: schema({
      required: ['id', 'visitor_id', 'host_name', 'purpose', 'status', 'expected_arrival'],
      properties: {
        id: uuid,
        visitor_id: { bsonType: 'string' },
        host_name: { bsonType: 'string' },
        host_email: { bsonType: ['string', 'null'] },
        purpose: { bsonType: 'string' },
        badge_number: { bsonType: ['string', 'null'] },
        status: { enum: ['scheduled', 'checked_in', 'checked_out', 'cancelled', 'denied'] },
        check_in_at: { bsonType: ['date', 'null'] },
        check_out_at: { bsonType: ['date', 'null'] },
        expected_arrival: { bsonType: 'date' },
        // JSONB array -> native array
        authorized_zones: { bsonType: 'array' },
        created_at: { bsonType: 'date' },
        updated_at: { bsonType: 'date' },
      },
    }),
  });
  await index(db, 'visits', { visitor_id: 1 }, { name: 'idx_visits_visitor_id' });
  await index(db, 'visits', { status: 1 }, { name: 'idx_visits_status' });
  await index(db, 'visits', { check_in_at: 1 }, { name: 'idx_visits_check_in' });
  await index(db, 'visits', { id: 1 }, { unique: true, name: 'idx_visits_id' });

  // ------------------------------------------------------------- cameras
  await defineCollection(db, 'cameras', {
    validator: schema({
      required: ['id', 'name', 'stream_url', 'status'],
      properties: {
        id: uuid,
        name: { bsonType: 'string' },
        zone_id: { bsonType: ['string', 'null'] },
        ip_address: { bsonType: ['string', 'null'] },
        stream_url: { bsonType: 'string' },
        model: { bsonType: 'string' },
        status: { enum: ['online', 'offline', 'maintenance'] },
        ai_features_enabled: { bsonType: 'bool' },
        last_heartbeat_at: { bsonType: ['date', 'null'] },
        created_at: { bsonType: 'date' },
        updated_at: { bsonType: 'date' },
      },
    }),
  });
  await index(db, 'cameras', { zone_id: 1 }, { name: 'idx_cameras_zone_id' });
  await index(db, 'cameras', { status: 1 }, { name: 'idx_cameras_status' });
  await index(db, 'cameras', { name: 1 }, { name: 'idx_cameras_name' });
  await index(db, 'cameras', { id: 1 }, { unique: true, name: 'idx_cameras_id' });

  // -------------------------------------------------------- identifications
  await defineCollection(db, 'identifications', {
    validator: schema({
      required: ['id', 'camera_id', 'event_type', 'detected_at'],
      properties: {
        id: uuid,
        camera_id: { bsonType: 'string' },
        visitor_id: { bsonType: ['string', 'null'] },
        event_type: {
          enum: [
            'recognized_visitor',
            'unrecognized_person',
            'unauthorized_zone_breach',
            'blacklisted_person_alert',
            'tailgating',
          ],
        },
        // NUMERIC(5,4) -> double
        confidence_score: { bsonType: ['double', 'null'] },
        captured_frame_url: { bsonType: ['string', 'null'] },
        // JSONB -> embedded document
        detected_bounding_box: { bsonType: ['object', 'null'] },
        notes: { bsonType: 'string' },
        detected_at: { bsonType: 'date' },
        created_at: { bsonType: 'date' },
      },
    }),
  });
  await index(db, 'identifications', { camera_id: 1 }, { name: 'idx_identifications_camera_id' });
  await index(db, 'identifications', { visitor_id: 1 }, { name: 'idx_identifications_visitor_id' });
  await index(db, 'identifications', { detected_at: -1 }, { name: 'idx_identifications_detected_at' });
  await index(db, 'identifications', { event_type: 1 }, { name: 'idx_identifications_event_type' });
  await index(db, 'identifications', { id: 1 }, { unique: true, name: 'idx_identifications_id' });

  // ----------------------------------------------------- security alerts
  await defineCollection(db, 'security_alerts', {
    validator: schema({
      required: ['id', 'camera_id', 'severity', 'title', 'description', 'is_acknowledged'],
      properties: {
        id: uuid,
        identification_id: { bsonType: ['string', 'null'] },
        camera_id: { bsonType: 'string' },
        severity: { enum: ['low', 'medium', 'high', 'critical'] },
        title: { bsonType: 'string' },
        description: { bsonType: 'string' },
        is_acknowledged: { bsonType: 'bool' },
        acknowledged_by: { bsonType: ['string', 'null'] },
        acknowledged_at: { bsonType: ['date', 'null'] },
        created_at: { bsonType: 'date' },
      },
    }),
  });
  await index(db, 'security_alerts', { severity: 1 }, { name: 'idx_alerts_severity' });
  await index(db, 'security_alerts', { is_acknowledged: 1 }, { name: 'idx_alerts_is_ack' });
  await index(db, 'security_alerts', { created_at: -1 }, { name: 'idx_alerts_created_at' });
  await index(db, 'security_alerts', { identification_id: 1 }, { name: 'idx_alerts_identification_id' });
  await index(db, 'security_alerts', { id: 1 }, { unique: true, name: 'idx_alerts_id' });

  // --------------------------------------------------------- audit logs
  await defineCollection(db, 'audit_logs', {
    validator: schema({
      required: ['id', 'action', 'entity_type', 'created_at'],
      properties: {
        id: uuid,
        user_id: { bsonType: ['string', 'null'] },
        action: { bsonType: 'string' },
        entity_type: { bsonType: 'string' },
        entity_id: { bsonType: ['string', 'null'] },
        ip_address: { bsonType: ['string', 'null'] },
        // JSONB -> embedded document
        details: { bsonType: 'object' },
        created_at: { bsonType: 'date' },
      },
    }),
  });
  await index(db, 'audit_logs', { action: 1 }, { name: 'idx_audit_logs_action' });
  await index(db, 'audit_logs', { entity_type: 1, entity_id: 1 }, { name: 'idx_audit_logs_entity' });
  await index(db, 'audit_logs', { created_at: -1 }, { name: 'idx_audit_logs_created_at' });
  await index(db, 'audit_logs', { id: 1 }, { unique: true, name: 'idx_audit_logs_id' });
}

export async function down(db) {
  // DROP TABLE IF EXISTS -> drop() throws on a missing collection, hence the guard.
  for (const name of [
    'audit_logs',
    'security_alerts',
    'identifications',
    'cameras',
    'visits',
    'visitors',
    'zones',
    'users',
  ]) {
    const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
    if (exists) await db.collection(name).drop();
  }
}
