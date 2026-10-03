import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { BadRequestError, UnauthorizedError, ConflictError, NotFoundError } from '../../shared/errors.js'

const USER_PROFILE_COLUMNS = `
  id, username, email, role, full_name, status,
  department, badge_number, clearance_level, mfa_enabled, last_login_at,
  created_at, updated_at
`

export function makeAuthService({ db, config }) {
  return {
    async register({ username, email, password, role = 'guard', fullName, department = '', badgeNumber = null, clearanceLevel = 'STANDARD' }) {
      if (!username || !email || !password || !fullName) {
        throw new BadRequestError('Username, email, password, and fullName are required')
      }

      const validRoles = ['admin', 'operator', 'guard', 'auditor']
      if (!validRoles.includes(role)) {
        throw new BadRequestError(`Invalid role. Valid roles are: ${validRoles.join(', ')}`)
      }

      const validClearance = ['TOP_SECRET', 'RESTRICTED', 'STANDARD', 'VISITOR']
      if (!validClearance.includes(clearanceLevel)) {
        throw new BadRequestError(`Invalid clearanceLevel. Valid levels are: ${validClearance.join(', ')}`)
      }

      // Check if username or email already exists
      const existing = await db.query(
        'SELECT id, username, email FROM users WHERE username = $1 OR email = $2',
        [username.toLowerCase().trim(), email.toLowerCase().trim()]
      )
      if (existing.rows.length > 0) {
        throw new ConflictError('A user with this username or email already exists')
      }

      const saltRounds = 10
      const passwordHash = await bcrypt.hash(password, saltRounds)

      const result = await db.query(
        `INSERT INTO users (username, email, password_hash, role, full_name, department, badge_number, clearance_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${USER_PROFILE_COLUMNS}`,
        [
          username.toLowerCase().trim(),
          email.toLowerCase().trim(),
          passwordHash,
          role,
          fullName.trim(),
          department.trim(),
          badgeNumber ? badgeNumber.trim() : null,
          clearanceLevel,
        ]
      )

      await this.recordAudit(result.rows[0].id, 'CREATE_USER', result.rows[0].id, {
        username: result.rows[0].username,
        role,
        clearanceLevel,
      })

      return result.rows[0]
    },

    async login({ username, password }) {
      if (!username || !password) {
        throw new BadRequestError('Username and password are required')
      }

      const result = await db.query(
        `SELECT ${USER_PROFILE_COLUMNS}, password_hash FROM users WHERE username = $1 OR email = $1`,
        [username.toLowerCase().trim()]
      )

      if (result.rows.length === 0) {
        throw new UnauthorizedError('Invalid username or password')
      }

      const user = result.rows[0]
      if (user.status !== 'active') {
        throw new UnauthorizedError(`Account is ${user.status}. Please contact an administrator.`)
      }

      const isMatch = await bcrypt.compare(password, user.password_hash)
      if (!isMatch) {
        throw new UnauthorizedError('Invalid username or password')
      }

      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      )

      // Record successful authentication for the console's "last login" display.
      await db.query(
        'UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1',
        [user.id]
      )

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          fullName: user.full_name,
          status: user.status,
          department: user.department,
          badgeNumber: user.badge_number,
          clearanceLevel: user.clearance_level,
          mfaVerified: user.mfa_enabled,
          lastLoginAt: user.last_login_at || new Date().toISOString(),
        },
      }
    },

    async getMe(userId) {
      const result = await db.query(`SELECT ${USER_PROFILE_COLUMNS} FROM users WHERE id = $1`, [userId])

      if (result.rows.length === 0) {
        throw new NotFoundError('User not found')
      }
      return result.rows[0]
    },

    /**
     * Lists the operator/role registry rendered by the Administration console.
     * Supports optional filtering by role and free-text search.
     */
    async listUsers({ role = '', q = '' } = {}) {
      const conditions = []
      const params = []

      if (role) {
        params.push(role)
        conditions.push(`role = $${params.length}`)
      }

      if (q) {
        params.push(`%${q}%`)
        conditions.push(`(username ILIKE $${params.length} OR full_name ILIKE $${params.length} OR email ILIKE $${params.length})`)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const result = await db.query(
        `SELECT ${USER_PROFILE_COLUMNS}
         FROM users
         ${whereClause}
         ORDER BY role ASC, full_name ASC`,
        params
      )

      return result.rows
    },

    async recordAudit(userId, action, entityId, details) {
      try {
        await db.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, action, 'user', entityId, JSON.stringify(details || {})]
        )
      } catch (err) {
        // Auditing must never block the primary operation.
        console.warn('[Audit] Failed to record user audit event:', err.message)
      }
    },
  }
}
