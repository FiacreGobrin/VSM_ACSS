import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { AppError } from '../../shared/errors.js'

/**
 * Filesystem-backed blob storage for uploaded CCTV footage.
 *
 * Air-gapped appliances have no sanctioned egress, so object storage is not an
 * option: clips must land on a local volume. This adapter keeps the module
 * decoupled from that decision - swapping in S3 later only requires an
 * implementation with the same four methods, because nothing outside this file
 * touches the filesystem.
 *
 * Paths are stored relative to the upload root so the deployment directory
 * stays movable between appliances.
 */
export function makeLocalDiskStorage({ uploadDir, logger }) {
  const root = path.resolve(uploadDir)

  /**
   * Resolves a stored relative path to an absolute one, refusing anything that
   * escapes the upload root.
   *
   * This is the single guard against path traversal: `storage_path` reaches
   * this function from a database row, and a corrupted or tampered row such as
   * `../../.env` would otherwise turn the media endpoint into an arbitrary file
   * read. The resolved path is compared against the root prefix after
   * normalisation, and `path.relative` is used rather than `startsWith` so that
   * a sibling directory sharing the root's name prefix (e.g. `uploads-evil`)
   * cannot masquerade as a child.
   */
  function resolveStoredPath(storedPath) {
    if (!storedPath || typeof storedPath !== 'string') {
      throw new AppError('Missing storage path', 400, 'invalid_storage_path')
    }

    if (path.isAbsolute(storedPath)) {
      throw new AppError('Storage path must be relative', 400, 'invalid_storage_path')
    }

    const absolute = path.resolve(root, storedPath)
    const relative = path.relative(root, absolute)

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new AppError('Storage path escapes the upload root', 400, 'invalid_storage_path')
    }

    return absolute
  }

  /**
   * Builds the on-disk location for a new object.
   *
   * The stored name is a random UUID with the sniffed extension - never the
   * operator-supplied filename. Operator input can carry path separators, NUL
   * bytes or reserved Windows device names, so it is retained for display only
   * and never used to build a path.
   */
  function buildStoragePath({ extension, prefix = 'recordings' }) {
    const now = new Date()
    const year = String(now.getUTCFullYear())
    const month = String(now.getUTCMonth() + 1).padStart(2, '0')
    const id = crypto.randomUUID()
    return path.posix.join(prefix, year, month, `${id}${extension}`)
  }

  return {
    root,

    /** Creates the upload root if it does not yet exist. */
    async ensureReady() {
      await fs.promises.mkdir(root, { recursive: true })
      return root
    },

    /**
     * Writes a validated media buffer and returns its registry metadata.
     * The directory is created on demand so the first upload works on a fresh
     * checkout without a manual `mkdir`.
     */
    async save({ buffer, extension, prefix }) {
      const storedPath = buildStoragePath({ extension, prefix })
      const absolute = resolveStoredPath(storedPath)

      await fs.promises.mkdir(path.dirname(absolute), { recursive: true })
      await fs.promises.writeFile(absolute, buffer, { flag: 'wx' })

      if (logger) {
        logger.debug('Stored media object', { storedPath, bytes: buffer.length })
      }

      return {
        storedPath,
        sizeBytes: buffer.length,
        sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
      }
    },

    /** Removes an object. A missing file is not an error - the row is gone anyway. */
    async remove(storedPath) {
      const absolute = resolveStoredPath(storedPath)
      try {
        await fs.promises.unlink(absolute)
        return true
      } catch (err) {
        if (err.code === 'ENOENT') return false
        throw err
      }
    },

    /**
     * Returns the file size and modification time, or `null` when the object is
     * gone (e.g. pruned by the retention sweep before the row was collected).
     */
    async stat(storedPath) {
      const absolute = resolveStoredPath(storedPath)
      try {
        const stats = await fs.promises.stat(absolute)
        return { sizeBytes: stats.size, modifiedAt: stats.mtime }
      } catch (err) {
        if (err.code === 'ENOENT') return null
        throw err
      }
    },

    /**
     * Opens a read stream, optionally bounded for HTTP range requests.
     *
     * Streaming rather than buffering matters here: a 500 MB clip must not be
     * pulled into memory to serve a byte range the video player asks for while
     * seeking.
     */
    createReadStream(storedPath, options = {}) {
      const absolute = resolveStoredPath(storedPath)
      return fs.createReadStream(absolute, {
        start: options.start,
        end: options.end,
      })
    },

    exists(storedPath) {
      return fs.promises
        .access(resolveStoredPath(storedPath))
        .then(() => true)
        .catch(() => false)
    },
  }
}