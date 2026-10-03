import { defineCollection, schema, index } from './_helpers.js'

/**
 * Migration 0002 - operator profiles and dashboard counters.
 *
 * Replaces `0002_user_profiles_and_dashboard.up.sql`.
 *
 * The original used `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. MongoDB is
 * schemaless, so adding a field needs no DDL, but the *validator* must be
 * updated (otherwise the new fields would be unvalidated) and the indexes must
 * be created to preserve the dashboard's query performance.
 */

export async function up(db) {
  // --------------------------------------------------------------- users
  // Re-declared so the profile fields carry the same constraints they had as
  // columns: NOT NULL with defaults, plus the clearance_level CHECK constraint.
  await defineCollection(db, 'users', {
    validator: schema({
      required: ['id', 'username', 'email', 'password_hash', 'role', 'full_name', 'status'],
      properties: {
        id: { bsonType: 'string' },
        username: { bsonType: 'string' },
        email: { bsonType: 'string' },
        password_hash: { bsonType: 'string' },
        role: { enum: ['admin', 'operator', 'guard', 'auditor'] },
        full_name: { bsonType: 'string' },
        status: { enum: ['active', 'suspended', 'inactive'] },
        department: { bsonType: 'string' },
        badge_number: { bsonType: ['string', 'null'] },
        clearance_level: { enum: ['TOP_SECRET', 'RESTRICTED', 'STANDARD', 'VISITOR'] },
        mfa_enabled: { bsonType: 'bool' },
        last_login_at: { bsonType: ['date', 'null'] },
        created_at: { bsonType: 'date' },
        updated_at: { bsonType: 'date' },
      },
    }),
  });

  // The original added a partial UNIQUE index on badge_number. MongoDB
  // expresses that with `partialFilterExpression` rather than a WHERE clause.
  await index(
    db,
    'users',
    { badge_number: 1 },
    {
      unique: true,
      name: 'idx_users_badge_number',
      partialFilterExpression: { badge_number: { $type: 'string' } },
    }
  );
  await index(db, 'users', { clearance_level: 1 }, { name: 'idx_users_clearance_level' });

  // --------------------------------------------------------------- visits
  await defineCollection(db, 'visits', {
    validator: schema({
      required: ['id', 'visitor_id', 'host_name', 'purpose', 'status', 'expected_arrival'],
      properties: {
        id: { bsonType: 'string' },
        visitor_id: { bsonType: 'string' },
        host_name: { bsonType: 'string' },
        host_email: { bsonType: ['string', 'null'] },
        purpose: { bsonType: 'string' },
        badge_number: { bsonType: ['string', 'null'] },
        status: { enum: ['scheduled', 'checked_in', 'checked_out', 'cancelled', 'denied'] },
        check_in_at: { bsonType: ['date', 'null'] },
        check_out_at: { bsonType: ['date', 'null'] },
        expected_arrival: { bsonType: 'date' },
        authorized_zones: { bsonType: 'array' },
        // Maintained as a counter column so the dashboard occupancy query is a
        // single indexed count rather than a scan of the whole access log.
        on_site: { bsonType: 'bool' },
        created_at: { bsonType: 'date' },
        updated_at: { bsonType: 'date' },
      },
    }),
  });
  await index(
    db,
    'visits',
    { on_site: 1 },
    { name: 'idx_visits_on_site', partialFilterExpression: { on_site: true } }
  );
  await index(db, 'visits', { expected_arrival: 1 }, { name: 'idx_visits_expected_arrival' });

  // ------------------------------------------------------- data backfill
  // Mirrors the UPDATE statements in the SQL migration so pre-existing rows
  // stay consistent with the new columns' defaults.
  await db.collection('visits').updateMany(
    { on_site: { $exists: false } },
    [{ $set: { on_site: { $eq: ['$status', 'checked_in'] } } }]
  );
  await db.collection('users').updateMany(
    { department: { $exists: false } },
    [{ $set: { department: '', mfa_enabled: true } }]
  );
  // The single existing admin is the facility's top authority.
  await db.collection('users').updateMany(
    { role: 'admin', department: '' },
    [
      {
        $set: {
          department: 'Directorate of Infrastructure & Defense',
          clearance_level: 'TOP_SECRET',
          mfa_enabled: true,
        },
      },
    ]
  );
  await db.collection('users').updateMany(
    { clearance_level: { $exists: false } },
    [{ $set: { clearance_level: 'STANDARD' } }]
  );
}

export async function down(db) {
  // DROP COLUMN -> $unset the fields and drop the supporting indexes.
  const users = db.collection('users');
  await users.dropIndex('idx_users_clearance_level').catch(() => {});
  await users.dropIndex('idx_users_badge_number').catch(() => {});
  await users
    .updateMany(
      {},
      { $unset: { department: '', badge_number: '', clearance_level: '', mfa_enabled: '', last_login_at: '' } }
    )
    .catch(() => {});

  const visits = db.collection('visits');
  await visits.dropIndex('idx_visits_on_site').catch(() => {});
  await visits.dropIndex('idx_visits_expected_arrival').catch(() => {});
  await visits.updateMany({}, { $unset: { on_site: '' } }).catch(() => {});
}