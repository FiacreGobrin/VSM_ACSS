import { BadRequestError, NotFoundError } from '../../shared/errors.js'
import {
  COLLECTIONS,
  newId,
  paging,
  safeLimit,
  present,
  toDate,
} from '../../shared/mongo/helpers.js'

/**
 * CCTV identification events and the autonomous security-alert engine.
 */
export function makeIdentificationService({ db }) {
  const identifications = db.collection(COLLECTIONS.identifications)
  const cameras = db.collection(COLLECTIONS.cameras)
  const visitors = db.collection(COLLECTIONS.visitors)
  const alerts = db.collection(COLLECTIONS.securityAlerts)
  const auditLogs = db.collection(COLLECTIONS.auditLogs)

  return {
    /**
     * Ingests a CCTV camera identification/detection event from a camera AI stream.
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

      // 1. Verify camera exists and get its zone.
      // `cameras.camera_id` was NOT NULL REFERENCES cameras(id) - enforced here.
      const cameraRows = await cameras
        .aggregate([
          { $match: { id: cameraId } },
          {
            $lookup: {
              from: COLLECTIONS.zones,
              localField: 'zone_id',
              foreignField: 'id',
              as: '_zone',
            },
          },
          {
            $addFields: {
              // `$_zone` holds the joined documents; projecting `.name` off each
              // element yields the string, not the document.
              zone_name: { $arrayElemAt: ['$_zone.name', 0] },
              zone_security_level: {
                $ifNull: [
                  { $getField: { field: 'security_level', input: { $arrayElemAt: ['$_zone', 0] } } },
                  null,
                ],
              },
            },
          },
          { $project: { _zone: 0 } },
        ])
        .toArray()

      if (cameraRows.length === 0) {
        throw new NotFoundError(`Camera with ID ${cameraId} not found`)
      }
      const camera = cameraRows[0]

      // 2. Fetch visitor if visitorId provided.
      let visitor = null
      if (visitorId) {
        visitor = await visitors.findOne({ id: visitorId })
      }

      // 3. Insert identification record.
      const now = new Date()
      const doc = {
        id: newId(),
        camera_id: cameraId,
        visitor_id: visitor ? visitor.id : null,
        event_type: eventType,
        confidence_score: confidenceScore === null ? null : Number(confidenceScore),
        captured_frame_url: capturedFrameUrl,
        // The JSONB column becomes a native embedded document - no stringify.
        detected_bounding_box: detectedBoundingBox || null,
        notes,
        detected_at: toDate(detectedAt) || now,
        created_at: now,
      }
      await identifications.insertOne(doc)

      // 4. Autonomous Security Alert Engine.
      let generatedAlert = null;

      // Rule A: Blacklisted person detected.
      if (visitor && visitor.status === 'blacklisted') {
        generatedAlert = await this.triggerAlert({
          identificationId: doc.id,
          cameraId,
          severity: 'critical',
          title: 'CRITICAL: Blacklisted Individual Detected',
          description:
            `Blacklisted visitor "${visitor.full_name}" (ID: ${visitor.id_number}) was identified ` +
            `by CCTV "${camera.name}" in zone "${camera.zone_name || 'Unassigned'}".`,
        });
      }
      // Rule B: Unrecognized person in a high-security zone (security_level >= 2).
      else if (eventType === 'unrecognized_person' && (camera.zone_security_level || 1) >= 2) {
        generatedAlert = await this.triggerAlert({
          identificationId: doc.id,
          cameraId,
          severity: 'high',
          title: 'ALERT: Unrecognized Person in Secured Zone',
          description:
            `An unidentified individual was detected by CCTV "${camera.name}" in restricted ` +
            `zone "${camera.zone_name}" (Security Level ${camera.zone_security_level}).`,
        });
      }

      return present({
        ...doc,
        camera_name: camera.name,
        zone_name: camera.zone_name,
        alert: generatedAlert,
      });
    },

    /**
     * Creates a security alert for a detection.
     * Separated from `recordDetection` so the rules stay readable.
     */
    async triggerAlert({ identificationId, cameraId, severity, title, description }) {
      const now = new Date()
      const alert = {
        id: newId(),
        identification_id: identificationId,
        camera_id: cameraId,
        severity,
        title,
        description,
        is_acknowledged: false,
        acknowledged_by: null,
        acknowledged_at: null,
        created_at: now,
      }

      await alerts.insertOne(alert)

      return present(alert)
    },
async listDetections({ cameraId = '', eventType = '', limit = 50, offset = 0 } = {}) {
      const filter = {}
      if (cameraId) filter.camera_id = cameraId
      if (eventType) filter.event_type = eventType

      const total = await identifications.countDocuments(filter)

      const { skip, limit: take } = paging(safeLimit(limit), offset)

      // The original joined cameras -> zones -> visitors -> security_alerts in
      // one statement. Each hop becomes a `$lookup` in the same pipeline, so the
      // response shape is unchanged and still costs a single round-trip.
      const rows = await identifications
        .aggregate([
          { $match: filter },
          {
            $lookup: {
              from: COLLECTIONS.cameras,
              localField: 'camera_id',
              foreignField: 'id',
              as: '_camera',
            },
          },
          {
            $lookup: {
              from: COLLECTIONS.zones,
              localField: '_camera.zone_id',
              foreignField: 'id',
              as: '_zone',
            },
          },
          {
            $lookup: {
              from: COLLECTIONS.visitors,
              localField: 'visitor_id',
              foreignField: 'id',
              as: '_visitor',
            },
          },
          {
            $lookup: {
              from: COLLECTIONS.securityAlerts,
              localField: 'id',
              foreignField: 'identification_id',
              as: '_alert',
            },
          },
          {
            $addFields: {
              camera_name: { $arrayElemAt: ['$_camera.name', 0] },
              zone_name: { $arrayElemAt: ['$_zone.name', 0] },
              visitor_name: { $arrayElemAt: ['$_visitor.full_name', 0] },
              visitor_id_number: { $arrayElemAt: ['$_visitor.id_number', 0] },
              visitor_company: { $arrayElemAt: ['$_visitor.company', 0] },
              visitor_status: { $arrayElemAt: ['$_visitor.status', 0] },
              alert_id: { $arrayElemAt: ['$_alert.id', 0] },
              alert_severity: { $arrayElemAt: ['$_alert.severity', 0] },
              alert_title: { $arrayElemAt: ['$_alert.title', 0] },
            },
          },
          { $project: { _camera: 0, _zone: 0, _visitor: 0, _alert: 0 } },
          { $sort: { detected_at: -1 } },
          { $skip: skip },
          { $limit: take },
        ])
        .toArray()

      return {
        items: rows.map(present),
        pagination: { total, limit: take, offset: skip },
      }
    },

    async listAlerts({ isAcknowledged = null, severity = '', limit = 50, offset = 0 } = {}) {
      const filter = {}

      if (isAcknowledged !== null) {
        filter.is_acknowledged = isAcknowledged === 'true' || isAcknowledged === true
      }
      if (severity) filter.severity = severity

      const total = await alerts.countDocuments(filter)

      const { skip, limit: take } = paging(safeLimit(limit), offset)

      const rows = await alerts
        .aggregate([
          { $match: filter },
          {
            $lookup: {
              from: COLLECTIONS.cameras,
              localField: 'camera_id',
              foreignField: 'id',
              as: '_camera',
            },
          },
          {
            // The alert's zone comes through the camera, so this lookup runs on
            // the joined camera's zone_id rather than on the alert document.
            $lookup: {
              from: COLLECTIONS.zones,
              localField: '_camera.zone_id',
              foreignField: 'id',
              as: '_zone',
            },
          },
          {
            $lookup: {
              from: COLLECTIONS.users,
              localField: 'acknowledged_by',
              foreignField: 'id',
              as: '_user',
            },
          },
          {
            $addFields: {
              camera_name: { $arrayElemAt: ['$_camera.name', 0] },
              zone_name: { $arrayElemAt: ['$_zone.name', 0] },
              acknowledged_by_name: { $arrayElemAt: ['$_user.full_name', 0] },
            },
          },
          { $project: { _camera: 0, _zone: 0, _user: 0 } },
          { $sort: { created_at: -1 } },
          { $skip: skip },
          { $limit: take },
        ])
        .toArray()

      return {
        items: rows.map(present),
        pagination: { total, limit: take, offset: skip },
      }
    },

    async acknowledgeAlert(alertId, actorId) {
      const now = new Date()
      const alert = await alerts.findOneAndUpdate(
        { id: alertId },
        { $set: { is_acknowledged: true, acknowledged_by: actorId, acknowledged_at: now } },
        { returnDocument: 'after' }
      )

      if (!alert) {
        throw new NotFoundError(`Alert ${alertId} not found`)
      }

      try {
        await auditLogs.insertOne({
          id: newId(),
          user_id: actorId,
          action: 'ACKNOWLEDGE_ALERT',
          entity_type: 'alert',
          entity_id: alertId,
          ip_address: null,
          details: {},
          created_at: now,
        })
      } catch (err) {
        console.warn('[Audit] Failed to record alert acknowledgement:', err.message)
      }

      return present(alert)
    },
  }
}