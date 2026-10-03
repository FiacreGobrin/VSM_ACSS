import fs from 'node:fs'
import path from 'node:path'

/**
 * Lightweight, zero-dependency .env loader.
 * Reads lines, strips comments and whitespace, and sets process.env variables if not already set.
 */
export function loadDotEnv(filepath) {
  const target = filepath || path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(target)) return

  try {
    const raw = fs.readFileSync(target, 'utf-8')
    const lines = raw.split(/\r?\n/)

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) continue

      const key = trimmed.slice(0, eqIndex).trim()
      let value = trimmed.slice(eqIndex + 1).trim()

      // Handle quoted values
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      // Populate process.env if not already set by system
      if (process.env[key] === undefined) {
        process.env[key] = value
      }
    }
  } catch (err) {
    console.warn(`[Config] Failed reading ${target}:`, err.message)
  }
}
