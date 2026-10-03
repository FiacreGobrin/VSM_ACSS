import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import jwt from 'jsonwebtoken'
import { makeApp } from '../app.js'
import { makeRecordingsModule } from '../modules/recordings/recordings.module.js'
import { makeLogger } from '../shared/logger.js'
import { makeAuthMiddleware } from '../shared/middleware/auth.js'

/**
 * End-to-end coverage of the evidence-upload path.
 *
 * Exercises the real Express app, the real multer middleware, the real
 * filesystem adapter and the real error envelope, with only Postgres stubbed.
 * That combination is what catches the failure modes unit tests miss - a
 * multipart body the parser rejects, a storage write that never happens, a
 * range response the video player cannot seek in.
 */

const JWT_SECRET = 'test_secret_recordings'

function makeConfig(uploadDir) {
  return {
    env: 'test',
    mongo: { uri: '', dbName: 'test', isAtlas: false, supportsTransactions: false },
    cors: { origin: '*' },
    jwt: { secret: JWT_SECRET, expiresIn: '1h' },
    uploads: {
      dir: uploadDir,
      maxVideoBytes: 5 * 1024 * 1024,
      maxImageBytes: 1024 * 1024,
      maxFiles: 10,
      allowedVideoTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
      allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
    },
  }
}

/**
 * In-memory stand-in for a `Db` handle.
 *
 * Implements just the collection methods the recordings service and controller
 * use, with the same method signatures and return shapes as the real driver.
 * `$lookup` is not emulated, so `getRecordingById` is served from a flat
 * fixture - enough to exercise the HTTP surface without a live database.
 */
function makeFakeDb({ recordingRows = [], cameras = [] } = {}) {
  const calls = []

  const collection = (name) => ({
    async findOne(filter = {}) {
      calls.push({ op: 'findOne', name, filter })
      if (name === 'cameras') {
        const hit = cameras.find((id) => id === filter.id)
        return hit ? { id: hit } : null
      }
      return recordingRows.find((r) => r.id === filter.id) || null
    },

    async insertOne(doc) {
      calls.push({ op: 'insertOne', name, doc })
      return { acknowledged: true, insertedId: doc.id }
    },

    async deleteOne(filter) {
      calls.push({ op: 'deleteOne', name, filter })
      const idx = recordingRows.findIndex((r) => r.id === filter.id)
      if (idx !== -1) recordingRows.splice(idx, 1)
      return { deletedCount: idx === -1 ? 0 : 1 }
    },

    async updateOne(filter, update) {
      calls.push({ op: 'updateOne', name, filter, update })
      return { matchedCount: 1, modifiedCount: 1 }
    },

    async countDocuments(filter = {}) {
      calls.push({ op: 'countDocuments', name, filter })
      return name === 'cameras' ? cameras.length : recordingRows.length
    },

    aggregate() {
      // Return a cursor-like object; the recordings list path is not exercised
      // by these assertions beyond pagination metadata.
      const rows = name === 'cameras' ? cameras.map((id) => ({ id })) : recordingRows
      return {
        sort() { return this },
        skip() { return this },
        limit() { return this },
        async toArray() { return rows },
      }
    },
  })

  return {
    calls,
    collection,
  }
}

/** Starts the API on an ephemeral port and returns a base URL plus cleanup. */
async function startServer({ uploadDir, db, config }) {
  const logger = makeLogger({ env: 'test' })
  // Real middleware, so the 401/403 assertions below exercise the same JWT
  // verification and role gate the appliance uses.
  const authMiddleware = makeAuthMiddleware(config.jwt.secret)
  const modules = [makeRecordingsModule({ db, config, logger, authMiddleware })]

  const app = makeApp({ logger, modules, config })
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s))
  })

  const { port } = server.address()
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

function mp4Bytes() {
  const header = Buffer.alloc(16)
  header.writeUInt32BE(4096, 0)
  header.write('ftyp', 4, 'latin1')
  header.write('isom', 8, 'latin1')
  return Buffer.concat([header, Buffer.alloc(4080)])
}

function authHeader(role = 'admin') {
  return {
    Authorization: `Bearer ${jwt.sign({ id: 'user-1', role }, JWT_SECRET, { expiresIn: '1h' })}`,
  }
}

/** Builds a multipart body the way a browser would. */
function uploadForm({
  filename = 'gate-cam-clip.mp4',
  bytes = mp4Bytes(),
  type = 'video/mp4',
  fields = {},
}) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) form.append(key, String(value))
  }
  // The Blob reuses the sniffed bytes but claims a chosen Content-Type, which is
  // exactly the mismatch an attacker relies on.
  form.append('file', new Blob([bytes], { type }), filename)
  return form
}

function withTempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vms-api-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  return dir
}

/** Seeds a stored clip on disk and returns a registry row pointing at it. */
function seedStoredClip(uploadDir, overrides = {}) {
  const bytes = mp4Bytes()
  const storageDir = path.join(uploadDir, 'recordings', '2026', '03')
  fs.mkdirSync(storageDir, { recursive: true })
  const absolute = path.join(storageDir, 'clip.mp4')
  fs.writeFileSync(absolute, bytes)

  return {
    absolute,
    row: {
      id: 'rec-1',
      title: 'Server Room',
      content_type: 'video/mp4',
      size_bytes: bytes.length,
      original_filename: 'server room.mp4',
      storage_path: 'recordings/2026/03/clip.mp4',
      ...overrides,
    },
  }
}
test('upload endpoint stores an MP4 and returns 201 with the registry row', async (t) => {
  const uploadDir = withTempDir(t)
  const db = makeFakeDb({ cameras: ['cam-1'] })
  const config = makeConfig(uploadDir)
  const server = await startServer({ uploadDir, db, config })
  t.after(server.close)

  const res = await fetch(`${server.baseUrl}/api/v1/recordings`, {
    method: 'POST',
    headers: authHeader('admin'),
    body: uploadForm({
      fields: { title: 'Main Gate tailgating', cameraId: 'cam-1', retentionDays: '30' },
    }),
  })

  assert.equal(res.status, 201)
  const payload = await res.json()
  assert.equal(payload.success, true)
  assert.equal(payload.data.media_kind, 'video')
  // The id is generated by the service (a UUID string) rather than the
  // database, so the JSON contract matches the previous Postgres schema.
  assert.match(
    payload.data.id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    'recording id should be a UUID'
  )

  // The object must actually be on disk under the upload root.
  const stored = fs
    .readdirSync(path.join(uploadDir, 'recordings'), { recursive: true })
    .filter((entry) => entry.endsWith('.mp4'))
  assert.equal(stored.length, 1, 'expected exactly one stored clip')

  // And the upload must be audited.
  const auditCall = db.calls.find(
    (c) => c.op === 'insertOne' && c.name === 'audit_logs' && c.doc.action === 'UPLOAD_RECORDING'
  )
  assert.ok(auditCall, 'expected an audit_logs entry')
  const details = auditCall.doc.details
  assert.equal(details.detectedType, 'video/mp4')
  assert.equal(details.cameraId, 'cam-1')
})

test('upload endpoint rejects an executable with a spoofed video Content-Type', async (t) => {
  const uploadDir = withTempDir(t)
  const server = await startServer({ uploadDir, db: makeFakeDb(), config: makeConfig(uploadDir) })
  t.after(server.close)

  // A Windows PE renamed to .mp4. The declared type says video; the bytes disagree.
  const pe = Buffer.concat([Buffer.from('MZ', 'latin1'), Buffer.alloc(2048)])

  const res = await fetch(`${server.baseUrl}/api/v1/recordings`, {
    method: 'POST',
    headers: authHeader('admin'),
    body: uploadForm({ filename: 'payload.mp4', bytes: pe, fields: { title: 'Totally a video' } }),
  })

  assert.equal(res.status, 415)
  const payload = await res.json()
  assert.equal(payload.error.code, 'unsupported_media_type')

  // Nothing may reach the filesystem.
  assert.equal(fs.existsSync(path.join(uploadDir, 'recordings')), false)
})

test('upload endpoint rejects a request with no file part', async (t) => {
  const uploadDir = withTempDir(t)
  const server = await startServer({ uploadDir, db: makeFakeDb(), config: makeConfig(uploadDir) })
  t.after(server.close)

  const form = new FormData()
  form.append('title', 'No file attached')

  const res = await fetch(`${server.baseUrl}/api/v1/recordings`, {
    method: 'POST',
    headers: authHeader('admin'),
    body: form,
  })

  assert.equal(res.status, 400)
  const payload = await res.json()
  assert.equal(payload.error.code, 'missing_file')
})

test('upload endpoint requires authentication', async (t) => {
  const uploadDir = withTempDir(t)
  const server = await startServer({ uploadDir, db: makeFakeDb(), config: makeConfig(uploadDir) })
  t.after(server.close)

  const res = await fetch(`${server.baseUrl}/api/v1/recordings`, {
    method: 'POST',
    body: uploadForm({ fields: { title: 'Anonymous' } }),
  })

  assert.equal(res.status, 401)
})

test('upload endpoint forbids a guard from ingesting evidence', async (t) => {
  const uploadDir = withTempDir(t)
  const server = await startServer({ uploadDir, db: makeFakeDb(), config: makeConfig(uploadDir) })
  t.after(server.close)

  // A guard may operate cameras and check visitors in, but must not be able to
  // write evidence into the retained library.
  const res = await fetch(`${server.baseUrl}/api/v1/recordings`, {
    method: 'POST',
    headers: authHeader('guard'),
    body: uploadForm({ fields: { title: 'Guard upload' } }),
  })

  assert.equal(res.status, 403)
})
test('stream endpoint honours a Range header so playback can seek', async (t) => {
  const uploadDir = withTempDir(t)
  const { row } = seedStoredClip(uploadDir)
  const db = makeFakeDb({ recordingRows: [row] })

  const server = await startServer({ uploadDir, db, config: makeConfig(uploadDir) })
  t.after(server.close)

  const ranged = await fetch(`${server.baseUrl}/api/v1/recordings/rec-1/stream`, {
    headers: { ...authHeader(), Range: 'bytes=0-99' },
  })

  assert.equal(ranged.status, 206)
  assert.equal(ranged.headers.get('content-range'), `bytes 0-99/${row.size_bytes}`)
  assert.equal(ranged.headers.get('content-type'), 'video/mp4')
  assert.equal(ranged.headers.get('accept-ranges'), 'bytes')
  assert.equal(ranged.headers.get('x-content-type-options'), 'nosniff')

  const slice = Buffer.from(await ranged.arrayBuffer())
  assert.equal(slice.length, 100)
  assert.equal(slice.toString('latin1', 4, 8), 'ftyp')

  // A full request still works and reports the whole length.
  const full = await fetch(`${server.baseUrl}/api/v1/recordings/rec-1/stream`, {
    headers: authHeader(),
  })
  assert.equal(full.status, 200)
  assert.equal(full.headers.get('content-length'), String(row.size_bytes))
})

test('stream endpoint rejects an unsatisfiable range with 416', async (t) => {
  const uploadDir = withTempDir(t)
  const { row } = seedStoredClip(uploadDir)
  const server = await startServer({
    uploadDir,
    db: makeFakeDb({ recordingRows: [row] }),
    config: makeConfig(uploadDir),
  })
  t.after(server.close)

  const res = await fetch(`${server.baseUrl}/api/v1/recordings/rec-1/stream`, {
    headers: { ...authHeader(), Range: `bytes=${row.size_bytes + 5000}-` },
  })

  assert.equal(res.status, 416)
  assert.equal(res.headers.get('content-range'), `bytes */${row.size_bytes}`)
})

test('stream endpoint reports 410 when the row outlives its object', async (t) => {
  const uploadDir = withTempDir(t)
  const { row } = seedStoredClip(uploadDir)
  // The retention sweeper removed the file but not the registry row.
  fs.rmSync(path.join(uploadDir, row.storage_path.replace(/\//g, path.sep)))

  const server = await startServer({
    uploadDir,
    db: makeFakeDb({ recordingRows: [row] }),
    config: makeConfig(uploadDir),
  })
  t.after(server.close)

  const res = await fetch(`${server.baseUrl}/api/v1/recordings/rec-1/stream`, {
    headers: authHeader(),
  })

  assert.equal(res.status, 410)
  const payload = await res.json()
  assert.equal(payload.error.code, 'media_unavailable')
})

test('delete endpoint removes both the registry row and the stored object', async (t) => {
  const uploadDir = withTempDir(t)
  const { absolute, row } = seedStoredClip(uploadDir)
  const db = makeFakeDb({ recordingRows: [row] })

  const server = await startServer({ uploadDir, db, config: makeConfig(uploadDir) })
  t.after(server.close)

  const res = await fetch(`${server.baseUrl}/api/v1/recordings/rec-1`, {
    method: 'DELETE',
    headers: authHeader('admin'),
  })

  assert.equal(res.status, 200)
  const payload = await res.json()
  assert.equal(payload.data.deleted, true)
  assert.equal(payload.data.fileRemoved, true)
  assert.equal(fs.existsSync(absolute), false, 'stored object should be unlinked')

  const auditCall = db.calls.find(
    (c) => c.op === 'insertOne' && c.name === 'audit_logs' && c.doc.action === 'DELETE_RECORDING'
  )
  assert.ok(auditCall, 'deletion must be audited')
})

test('list endpoint returns rows with pagination metadata', async (t) => {
  const uploadDir = withTempDir(t)
  const db = makeFakeDb({
    recordingRows: [
      {
        id: 'rec-1',
        title: 'Main Gate',
        media_kind: 'video',
        content_type: 'video/mp4',
        size_bytes: 4096,
        camera_name: 'Gate 01',
      },
    ],
  })

  const server = await startServer({ uploadDir, db, config: makeConfig(uploadDir) })
  t.after(server.close)

  const res = await fetch(`${server.baseUrl}/api/v1/recordings?mediaKind=video&limit=10&offset=0`, {
    headers: authHeader('operator'),
  })

  assert.equal(res.status, 200)
  const payload = await res.json()
  assert.equal(payload.data.length, 1)
  assert.equal(payload.meta.total, 1)
  assert.equal(payload.data[0].camera_name, 'Gate 01')
  // The internal storage path must never reach the browser.
  assert.equal(payload.data[0].storage_path, undefined)
})

test('list endpoint rejects an invalid mediaKind filter', async (t) => {
  const uploadDir = withTempDir(t)
  const server = await startServer({ uploadDir, db: makeFakeDb(), config: makeConfig(uploadDir) })
  t.after(server.close)

  const res = await fetch(`${server.baseUrl}/api/v1/recordings?mediaKind=executable`, {
    headers: authHeader(),
  })

  assert.equal(res.status, 400)
})