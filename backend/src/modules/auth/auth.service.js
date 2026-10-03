import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { BadRequestError, UnauthorizedError, ConflictError, NotFoundError } from '../../shared/errors.js'
import { COLLECTIONS, newId, containsFilter, present } from '../../shared/mongo/helpers.js'

/**
 * Profile fields returned to the console.
 *
 * Replaces the `USER_PROFILE_COLUMNS` SELECT list. `password_hash` is excluded
 * so a bug can never leak it through a profile endpoint.
 */
const PROFILE_PROJECTION = {
  _id: 0,
  id: 1,
  username: 1,
  email: 1,
  role: 1,
  full_name: 1,
  status: 1,
  department: 1,
  badge_number: 1,
  clearance_level: 1,
  mfa_enabled: 1,
  last_login_at: 1,
  created_at: 1,
  updated_at: 1,
}

export function makeAuthService({ db, config }) {
  const users = db.collection(COLLECTIONS.users)
  const auditLogs = db.collection(COLLECTIONS.auditLogs)

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

      const normalisedUsername = username.toLowerCase().trim()
      const normalisedEmail = email.toLowerCase().trim()

      // Pre-check for a friendly message. The unique indexes are the real
      // guarantee: two concurrent registrations can both pass this check, and
      // only the index makes the second one fail.
      const existing = await users.findOne(
        { $or: [{ username: normalisedUsername }, { email: normalisedEmail }] },
        { projection: { _id: 0, id: 1, username: 1, email: 1 } }
      )
      if (existing) {
        throw new ConflictError('A user with this username or email already exists')
      }

      const now = new Date()
      const doc = {
        id: newId(),
        username: normalisedUsername,
        email: normalisedEmail,
        password_hash: await bcrypt.hash(password, 10),
        role,
        full_name: fullName.trim(),
        status: 'active',
        department: department.trim(),
        badge_number: badgeNumber ? badgeNumber.trim() : null,
        clearance_level: clearanceLevel,
        mfa_enabled: true,
        last_login_at: null,
        created_at: now,
        updated_at: now,
      }

      try {
        await users.insertOne(doc)
      } catch (err) {
        // Duplicate key (11000) is the unique index rejecting a race.
        if (err.code === 11000) {
          throw new ConflictError('A user with this username or email already exists')
        }
        throw err
      }

      await this.recordAudit(doc.id, 'CREATE_USER', doc.id, {
        username: doc.username,
        role,
        clearanceLevel,
      })

      // Never return the hash.
      return present({ ...doc, password_hash: undefined })
    },
async login({ username, password }) {
      if (!username || !password) {
        throw new BadRequestError('Username and password are required')
      }

      const normalised = username.toLowerCase().trim()
      const user = await users.findOne({ $or: [{ username: normalised }, { email: normalised }] })

      if (!user) {
        throw new UnauthorizedError('Invalid username or password')
      }

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
      const now = new Date()
      await users.updateOne({ id: user.id }, { $set: { last_login_at: now, updated_at: now } })

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
          lastLoginAt: now.toISOString(),
        },
      }
    },

    async getMe(userId) {
      const user = await users.findOne({ id: userId }, { projection: PROFILE_PROJECTION })
      if (!user) {
        throw new NotFoundError('User not found')
      }
      return present(user)
    },

    /**
     * Lists the operator/role registry rendered by the Administration console.
     * Supports optional filtering by role and free-text search.
     */
    async listUsers({ role = '', q = '' } = {}) {
      const filter = {}

      if (role) filter.role = role

      // `ILIKE '%term%'` across three columns -> an escaped, case-insensitive
      // `$or` of regexes (see `containsFilter`).
      if (q) Object.assign(filter, containsFilter(q, ['username', 'full_name', 'email']))

      const rows = await users
        .find(filter, { projection: PROFILE_PROJECTION })
        .sort({ role: 1, full_name: 1 })
        .toArray()

      return rows.map(present)
    },

    async recordAudit(userId, action, entityId, details) {
      try {
        await auditLogs.insertOne({
          id: newId(),
          user_id: userId,
          action,
          entity_type: 'user',
          entity_id: entityId,
          ip_address: null,
          details: details || {},
          created_at: new Date(),
        })
      } catch (err) {
        // Auditing must never block the primary operation.
        console.warn('[Audit] Failed to record user audit event:', err.message)
      }
    },
  }
}