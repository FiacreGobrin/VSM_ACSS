/**
 * Helpers shared by the numbered MongoDB migrations.
 *
 * These mirror the guarantees the old `.sql` migrations relied on:
 * `CREATE TABLE IF NOT EXISTS` becomes an idempotent `createCollection`, and the
 * `CHECK (col IN (...))` constraints become `$jsonSchema` `enum` validators, so
 * the database still refuses invalid data rather than trusting the application.
 */

/**
 * Creates a collection if absent, otherwise updates its validator in place.
 *
 * `collMod` is required because re-running a migration must converge rather
 * than fail, and because later migrations legitimately tighten the schema.
 */
export async function defineCollection(db, name, { validator, options = {} }) {
  const existing = await db.listCollections({ name }, { nameOnly: true }).toArray();

  if (existing.length === 0) {
    await db.createCollection(name, {
      validator,
      validationLevel: 'moderate',
      validationAction: 'error',
      ...options,
    });
    return { created: true, updated: false };
  }

  await db.command({ collMod: name, validator, validationLevel: 'moderate', validationAction: 'error' });
  return { created: false, updated: true };
}

/**
 * Builds the `$jsonSchema` body for a collection.
 *
 * `required` mirrors NOT NULL columns; `enum` mirrors CHECK constraints; the
 * `properties` types mirror the column types. `additionalProperties` is left
 * open so a later migration can introduce columns without a drop/recreate.
 */
export function schema({ required = [], properties = {} }) {
  return { $jsonSchema: { bsonType: 'object', required, properties } };
}

/**
 * Index definition helper that mirrors `CREATE INDEX IF NOT EXISTS`.
 *
 * `createIndex` is already idempotent in MongoDB, so names only need to be
 * stable. Partial indexes use `partialFilterExpression`, the equivalent of the
 * old `WHERE ... IS NOT NULL` index predicates.
 */
export function index(db, collection, keys, options = {}) {
  return db.collection(collection).createIndex(keys, options);
}

/** Builds a `$lookup` stage, the aggregation-pipeline equivalent of a JOIN. */
export function lookup({ from, localField, foreignField, as, pipeline = [] }) {
  return {
    $lookup: {
      from,
      localField,
      foreignField,
      as,
      ...(pipeline.length ? { pipeline } : {}),
    },
  };
}

/** Unwinds a `$lookup` result, replacing the array with the first document. */
export function firstFrom(arrayField, as) {
  return { $addFields: { [as]: { $arrayElemAt: [`$${arrayField}`, 0] } } };
}