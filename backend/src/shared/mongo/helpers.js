import { randomUUID } from 'node:crypto'

/**
 * Collection names, matching the former PostgreSQL table names exactly.
 *
 * Keeping the identifiers identical means the migration story reads naturally
 * and, more importantly, so do the field names inside each document (see below).
 */
export const COLLECTIONS = {
  users: 'users',
  zones: 'zones',
  visitors: 'visitors',
  visits: 'visits',
  cameras: 'cameras',
  identifications: 'identifications',
  securityAlerts: 'security_alerts',
  auditLogs: 'audit_logs',
  recordings: 'recordings',
  schemaMigrations: 'schema_migrations',
}

/**
 * Generates a document id.
 *
 * Deliberately a UUID string rather than an `ObjectId`: the previous schema used
 * `UUID PRIMARY KEY DEFAULT gen_random_uuid()`, and six collections reference
 * each other by id. Keeping the UUID format means those references stay plain
 * strings, the JSON responses are byte-identical to the Postgres API, and the
 * frontend needs no changes at all.
 */
export function newId() {
  return randomUUID();
}

/**
 * Escapes a user-supplied search term for safe use inside a RegExp.
 *
 * This replaces PostgreSQL's `ILIKE '%term%'`. Interpolating a raw term into a
 * regex is the classic NoSQL injection vector: a term of `.*` matches everything,
 * and a crafted pattern like `(a+)+$` is a ReDoS denial-of-service. Escaping
 * every metacharacter makes the search literal, which is the intended meaning
 * of "contains this text".
 */
export function escapeRegex(term) {
  return String(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a case-insensitive "contains" filter.
 *
 * `$options: 'i'` is what `ILIKE` provided. Note this cannot use an index for
 * arbitrary substrings - the same limitation existed with `ILIKE '%…%'` in
 * Postgres, so query plans do not regress.
 */
export function containsFilter(term, fields) {
  const pattern = new RegExp(escapeRegex(term), 'i');
  return { $or: fields.map((field) => ({ [field]: pattern })) };
}

/** Combines filters, skipping empties so callers can build queries declaratively. */
export function andFilter(...parts) {
  const usable = parts.filter(Boolean);
  return usable.length === 1 ? usable[0] : { $and: usable };
}

/** Applies `limit`/`offset` after a sort, matching the old SQL ordering. */
export function paging(limit, offset) {
  return { skip: Math.max(0, offset || 0), limit: Math.max(1, limit || 50) };
}

/** Normalises a caller-supplied limit so a hostile value cannot exhaust memory. */
export function safeLimit(raw, fallback = 50, max = 500) {
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

/**
 * Strips internal bookkeeping fields from a document before it is returned.
 *
 * The MongoDB driver's `insertOne`/`findOneAndUpdate` can attach `_id`; the API
 * contract exposes only the application-level `id`, exactly as Postgres did.
 */
export function present(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest;
}

/** Presents a list of documents. */
export function presentAll(docs) {
  return docs.map(present);
}

/** Coerces a value to a Date, or null when absent/invalid. */
export function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Removes `undefined` values from an object.
 *
 * The driver ignores undefined fields, but `null` is a real value in Mongo and
 * is meaningful here: it is how the API represents "no such field", matching
 * Postgres NULL.
 */
export function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}