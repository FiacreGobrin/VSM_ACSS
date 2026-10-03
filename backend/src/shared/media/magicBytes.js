/**
 * Content-type verification by magic-byte sniffing.
 *
 * A multipart upload arrives with a `Content-Type` chosen by the client, so
 * trusting `file.mimetype` would let any executable be stored as if it were an
 * MP4. Before a byte is written to disk the leading bytes are matched against
 * the known container signatures, and the authoritative type replaces the
 * claimed one for the rest of the pipeline.
 *
 * Deliberately dependency-free: pulling in a file-type database would add a
 * large transitive tree to an air-gapped appliance for six signatures.
 */
import { AppError } from '../errors.js'

const SIGNATURES = [
  {
    // ISO-BMFF: a `ftyp` box sits at offset 4 in every MP4/MOV file.
    mimeType: 'video/mp4',
    mediaKind: 'video',
    extension: '.mp4',
    test: (buf) => buf.toString('latin1', 4, 8) === 'ftyp' && buf.toString('latin1', 8, 12) !== 'qt  ',
  },
  {
    // QuickTime files carry the `qt  ` brand in the same `ftyp` box.
    mimeType: 'video/quicktime',
    mediaKind: 'video',
    extension: '.mov',
    test: (buf) => buf.toString('latin1', 4, 8) === 'ftyp' && buf.toString('latin1', 8, 12) === 'qt  ',
  },
  {
    // EBML header shared by WebM and Matroska.
    mimeType: 'video/webm',
    mediaKind: 'video',
    extension: '.webm',
    test: (buf) => buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3,
  },
  {
    mimeType: 'image/jpeg',
    mediaKind: 'image',
    extension: '.jpg',
    test: (buf) => buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  },
  {
    mimeType: 'image/png',
    mediaKind: 'image',
    extension: '.png',
    test: (buf) =>
      buf[0] === 0x89 &&
      buf.toString('latin1', 1, 4) === 'PNG' &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a,
  },
  {
    // WebP is a RIFF container with a WEBP form type in bytes 8-12.
    mimeType: 'image/webp',
    mediaKind: 'image',
    extension: '.webp',
    test: (buf) => buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP',
  },
]

/**
 * Identifies a media buffer by its magic bytes.
 *
 * @param {Buffer} buffer Leading bytes of the upload (the full file is hashed
 *   separately; only the first 16 bytes are needed to classify it).
 * @returns {{ mimeType: string, mediaKind: 'video'|'image', extension: string } | null}
 *   `null` when no known signature matches.
 */
export function detectMediaType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return null

  for (const signature of SIGNATURES) {
    try {
      if (signature.test(buffer)) {
        return {
          mimeType: signature.mimeType,
          mediaKind: signature.mediaKind,
          extension: signature.extension,
        }
      }
    } catch {
      // A truncated buffer throws inside toString bounds checks; treat it as
      // unrecognised rather than letting it abort the upload loop.
      return null
    }
  }

  return null
}

/**
 * Rejects uploads whose declared type is not permitted.
 *
 * The *sniffed* type is authoritative: the declared one is only used to give the
 * operator a precise error message when the two disagree.
 */
export function assertMediaTypeAllowed(detected, declaredType, allowedTypes) {
  if (!allowedTypes.includes(detected.mimeType)) {
    throw new AppError(
      `Unsupported media type: ${detected.mimeType}. Allowed types are: ${allowedTypes.join(', ')}.`,
      415,
      'unsupported_media_type',
      { detected: detected.mimeType, allowed: allowedTypes }
    )
  }

  if (declaredType && declaredType !== detected.mimeType) {
    // Not fatal on its own - browsers are inconsistent about QuickTime and
    // WebM subtypes - but it means the extension cannot be trusted either.
    return false
  }

  return true
}