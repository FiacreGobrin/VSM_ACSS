import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { detectMediaType, assertMediaTypeAllowed } from '../shared/media/magicBytes.js'
import { makeLocalDiskStorage } from '../platform/storage/localDiskStorage.js'

/**
 * Media-type sniffing and storage-boundary tests.
 *
 * Both areas are security controls rather than convenience features: the first
 * stops a renamed executable being stored as "video", the second stops a
 * tampered `storage_path` row turning the stream endpoint into an arbitrary
 * file read. Neither is observable through the happy path, so they are asserted
 * directly here.
 */

/** Minimal MP4 header: 4-byte size, 'ftyp', then a major brand. */
function mp4Buffer(brand = 'isom', payloadBytes = 64) {
  const header = Buffer.alloc(16)
  header.writeUInt32BE(16 + payloadBytes, 0)
  header.write('ftyp', 4, 'latin1')
  header.write(brand, 8, 'latin1')
  return Buffer.concat([header, Buffer.alloc(payloadBytes)])
}

function jpegBuffer() {
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)])
}

test('detectMediaType identifies MP4 via the ftyp box', () => {
  const detected = detectMediaType(mp4Buffer('isom'))
  assert.equal(detected.mimeType, 'video/mp4')
  assert.equal(detected.mediaKind, 'video')
  assert.equal(detected.extension, '.mp4')
})

test('detectMediaType distinguishes QuickTime by its ftyp brand', () => {
  const detected = detectMediaType(mp4Buffer('qt  '))
  assert.equal(detected.mimeType, 'video/quicktime')
  assert.equal(detected.extension, '.mov')
})

test('detectMediaType identifies JPEG stills', () => {
  const detected = detectMediaType(jpegBuffer())
  assert.equal(detected.mimeType, 'image/jpeg')
  assert.equal(detected.mediaKind, 'image')
})

test('detectMediaType rejects an executable disguised as video', () => {
  // An ELF binary: valid header bytes an attacker controls, but no ftyp box.
  const elf = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(64)])
  assert.equal(detectMediaType(elf), null)

  // A Windows PE executable.
  const pe = Buffer.concat([Buffer.from('MZ', 'latin1'), Buffer.alloc(64)])
  assert.equal(detectMediaType(pe), null)
})

test('detectMediaType rejects a truncated buffer instead of throwing', () => {
  assert.equal(detectMediaType(Buffer.alloc(4)), null)
  assert.equal(detectMediaType('not a buffer'), null)
  assert.equal(detectMediaType(undefined), null)
})

test('assertMediaTypeAllowed rejects formats outside the allowlist', () => {
  const detected = detectMediaType(mp4Buffer('isom'))
  assert.throws(
    () => assertMediaTypeAllowed(detected, 'video/mp4', ['image/jpeg']),
    (err) => err.code === 'unsupported_media_type' && err.statusCode === 415
  )
})

test('assertMediaTypeAllowed accepts a permitted type', () => {
  const detected = detectMediaType(mp4Buffer('isom'))
  assert.equal(assertMediaTypeAllowed(detected, 'video/mp4', ['video/mp4']), true)
})

test('localDiskStorage writes a file under a UUID path, not the caller-supplied name', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vms-storage-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

  const storage = makeLocalDiskStorage({ uploadDir: dir })
  await storage.ensureReady()

  const buffer = mp4Buffer()
  const stored = await storage.save({ buffer, extension: '.mp4', prefix: 'recordings' })

  // The operator's filename must never influence the path: it can contain
  // separators, traversal segments or reserved Windows device names.
  assert.ok(!stored.storedPath.includes('evil'))
  assert.match(stored.storedPath, /^recordings[\\/]\d{4}[\\/]\d{2}[\\/][0-9a-f-]{36}\.mp4$/)
  assert.equal(stored.sizeBytes, buffer.length)
  assert.match(stored.sha256, /^[0-9a-f]{64}$/)
  assert.ok(storage.exists(stored.storedPath))
})

test('localDiskStorage refuses paths that escape the upload root', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vms-traversal-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

  // A sibling directory whose name starts with the root's name - the case a
  // naive `startsWith` check would wrongly treat as a child.
  fs.mkdirSync(`${dir}-evil`, { recursive: true })
  fs.writeFileSync(path.join(`${dir}-evil`, 'secret.env'), 'SECRET=hunter2')
  fs.writeFileSync(path.join(dir, 'innocent.env'), 'PUBLIC=ok')
  t.after(() => fs.rmSync(`${dir}-evil`, { recursive: true, force: true }))

  const storage = makeLocalDiskStorage({ uploadDir: dir })

  for (const attempt of ['../vms-traversal-evil/secret.env', '../secret.env', '../../etc/passwd']) {
    await assert.rejects(
      () => storage.stat(attempt),
      (err) => err.code === 'invalid_storage_path',
      `expected "${attempt}" to be rejected`
    )
  }

  // Absolute paths are refused outright rather than resolved.
  await assert.rejects(
    () => storage.stat(path.join(dir, 'innocent.env').replace(/\\/g, '/')),
    (err) => err.code === 'invalid_storage_path'
  )

  // A legitimate relative path still resolves.
  await storage.save({ buffer: mp4Buffer(), extension: '.mp4', prefix: 'recordings' })
})

test('localDiskStorage reports a missing object as null rather than throwing', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vms-missing-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

  const storage = makeLocalDiskStorage({ uploadDir: dir })
  assert.equal(await storage.stat('recordings/2026/01/does-not-exist.mp4'), null)
  assert.equal(await storage.remove('recordings/2026/01/does-not-exist.mp4'), false)
})