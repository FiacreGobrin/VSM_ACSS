import { BadRequestError, NotFoundError } from '../../shared/errors.js'

export function makeIdentificationService({ db }) {
  return {
    /**
     * Ingests a CCTV camera identification/detection event from camera AI stream.
     * Evaluates security rules and automatically triggers security alerts if necessary.
     */
    async recordDetection(data, actorId = null) {
      const {
        cameraId,
        visitorId = null,
        eventType = 'recognized_visitor',
        confidenceScore = null,
        capturedFrameUrl = null,
        detectedBoundingBox = null,
        notes = '',
        detectedAt = new Date().toISOString(),
      } = data

      if (!cameraId) {
        throw new BadRequestError('cameraId is required')
      }

      const validEvents = [
        'recognized_visitor',
        'unrecognized_person',
        'unauthorized_zone_breach',
        'blacklisted_person_alert',
        'tailgating',
      ]
      if (!validEvents.includes(eventType)) {
        throw new BadRequestError(`Invalid eventType. Valid types are: ${validEvents.join(', ')}`)
      }

      // 1. Verify camera exists and get its zone
      const cameraRes = await db.query(
        `SELECT c.*, z.name as zone_name, z.security_level as zone_security_level
         FROM cameras c
         LEFT JOIN zones z ON c.zone_id = z.id
         WHERE c.id = $1`,
        [cameraId]
      )

      if (cameraRes.rows.length === 0) {
        throw new NotFoundError(`Camera with ID ${cameraId} not found`)
      }
      const camera = cameraRes.rows[0]

      // 2. Fetch visitor if visitorId provided
      let visitor = null
      if (visitorId) {
        const visRes = await db.query('SELECT * FROM visitors WHERE id = $1', [visitorId])
        if (visRes.rows.length > 0) {
          visitor = visRes.rows[0]
        }
      }

      // 3. Insert identification record
      const idRes = await db.query(
        `INSERT INTO identifications (
          camera_id, visitor_id, event_type, confidence_score, captured_frame_url,
          detected_bounding_box, notes, detected_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          cameraId,
          visitor ? visitor.id : null,
          eventType,
          confidenceScore,
          capturedFrameUrl,
          detectedBoundingBox ? JSON.stringify(detectedBoundingBox) : null,
          notes,
          detectedAt,
        ]
      )
      const identification = idRes.rows[0]

      // 4. Autonomous Security Alert Engine
      let generatedAlert = null

      // Rule A: Blacklisted person detected
      if (visitor && visitor.status === 'blacklisted') {
        generatedAlert = await this.triggerAlert({
          identificationId: identification.id,
          cameraId,
          severity: 'critical',
          title: `CRITICAL: Blacklisted Individual Detected`,
          description: `Blacklisted visitor "${visitor.full_name}" (ID: ${visitor.id_number}) was identified by CCTV "${camera.name}" in zone "${camera.zone_name || 'Unassigned'}".`,
        })
      }
      // Rule B: Unrecognized person in high-security zone (security_level >= 2)
      else if (eventType === 'unrecognized_person' && (camera.zone_security_level || 1) >= 2) {
        generatedAlert = await this.triggerAlert({
          identificationId: identification.id,
          cameraId,
          severity: 'high',
          title: `ALERT: Unrecognized Person in Secured Zone`,
          description: `An unidentified individual was detected by CCTV "${camera.name}" in restricted zone "${camera.zone_name}" (Security Level ${camera.zone_security_level}).`,
        })
      }
      // Rule C: Tailgating detected
      else if (eventType === 'tailgating') {
        generatedAlert = await this.triggerAlert({
          identificationId: identification.id,
          cameraId,
          severity: 'high',
          title: `ALERT: Tailgating Detected`,
          description: `Multiple persons detected passing through single-badge checkpoint on camera "${camera.name}".`,
        })
      }
      // Rule D: Recognized visitor without active pass or outside authorized zones
      else if (visitor && eventType === 'recognized_visitor') {
        const activeVisitRes = await db.query(
          `SELECT * FROM visits
           WHERE visitor_id = $1 AND status = 'checked_in'
           ORDER BY check_in_at DESC LIMIT 1`,
          [visitor.id]
        )

        if (activeVisitRes.rows.length === 0) {
          // Visitor is on premises without check-in
          generatedAlert = await this.triggerAlert({
            identificationId: identification.id,
            cameraId,
            severity: 'medium',
            title: `WARNING: Unchecked Visitor on Premises`,
            description: `Visitor "${visitor.full_name}" detected by camera "${camera.name}" without an active checked-in visit pass.`,
          })
        } else {
          const visit = activeVisitRes.rows[0]
          const authorizedZones = Array.isArray(visit.authorized_zones) ? visit.authorized_zones : []
          if (camera.zone_id && authorizedZones.length > 0 && !authorizedZones.includes(camera.zone_id)) {
            generatedAlert = await this.triggerAlert({
              identificationId: identification.id,
              cameraId,
              severity: 'high',
              title: `ALERT: Unauthorized Zone Breach`,
              description: `Visitor "${visitor.full_name}" entered zone "${camera.zone_name}", which is not listed in their authorized visit pass.`,
            })
          }
        }
      }

      return {
        identification,
        alert: generatedAlert,
      }
    },

    async triggerAlert({ identificationId, cameraId, severity, title, description }) {
      const result = await db.query(
        `INSERT INTO security_alerts (identification_id, camera_id, severity, title, description)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [identificationId, cameraId, severity, title, description]
      )
      return result.rows[0]
    },

    async listDetections({ cameraId = '', visitorId = '', eventType = '', limit = 50, offset = 0 } = {}) {
      const conditions = []
      const params = []

      if (cameraId) {
        params.push(cameraId)
        conditions.push(`i.camera_id = $${params.length}`)
      }
      if (visitorId) {
        params.push(visitorId)
        conditions.push(`i.visitor_id = $${params.length}`)
      }
      if (eventType) {
        params.push(eventType)
        conditions.push(`i.event_type = $${params.length}`)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const countRes = await db.query(`SELECT count(*)::int as total FROM identifications i ${whereClause}`, params)
      const total = countRes.rows[0].total

      params.push(limit)
      const limitIdx = params.length
      params.push(offset)
      const offsetIdx = params.length

      const dataSql = `
        SELECT
          i.*,
          c.name as camera_name,
          z.name as zone_name,
          v.full_name as visitor_name,
          v.id_number as visitor_id_number,
          v.company as visitor_company,
          v.status as visitor_status,
          a.id as alert_id,
          a.severity as alert_severity,
          a.title as alert_title
        FROM identifications i
        JOIN cameras c ON i.camera_id = c.id
        LEFT JOIN zones z ON c.zone_id = z.id
        LEFT JOIN visitors v ON i.visitor_id = v.id
        LEFT JOIN security_alerts a ON a.identification_id = i.id
        ${whereClause}
        ORDER BY i.detected_at DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `
      const dataRes = await db.query(dataSql, params)

      return {
        items: dataRes.rows,
        pagination: { total, limit, offset },
      }
    },

    async listAlerts({ isAcknowledged = null, severity = '', limit = 50, offset = 0 } = {}) {
      const conditions = []
      const params = []

      if (isAcknowledged !== null) {
        params.push(isAcknowledged === 'true' || isAcknowledged === true)
        conditions.push(`a.is_acknowledged = $${params.length}`)
      }
      if (severity) {
        params.push(severity)
        conditions.push(`a.severity = $${params.length}`)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const countRes = await db.query(`SELECT count(*)::int as total FROM security_alerts a ${whereClause}`, params)
      const total = countRes.rows[0].total

      params.push(limit)
      const limitIdx = params.length
      params.push(offset)
      const offsetIdx = params.length

      const dataSql = `
        SELECT
          a.*,
          c.name as camera_name,
          z.name as zone_name,
          u.full_name as acknowledged_by_name
        FROM security_alerts a
        JOIN cameras c ON a.camera_id = c.id
        LEFT JOIN zones z ON c.zone_id = z.id
        LEFT JOIN users u ON a.acknowledged_by = u.id
        ${whereClause}
        ORDER BY a.created_at DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `
      const dataRes = await db.query(dataSql, params)

      return {
        items: dataRes.rows,
        pagination: { total, limit, offset },
      }
    },

    async acknowledgeAlert(alertId, actorId) {
      const res = await db.query(
        `UPDATE security_alerts
         SET is_acknowledged = true, acknowledged_by = $1, acknowledged_at = now()
         WHERE id = $2
         RETURNING *`,
        [actorId, alertId]
      )

      if (res.rows.length === 0) {
        throw new NotFoundError(`Alert ${alertId} not found`)
      }

      await db.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES ($1, 'ACKNOWLEDGE_ALERT', 'alert', $2, '{}')`,
        [actorId, alertId]
      )

      return res.rows[0]
    },
  }
}
