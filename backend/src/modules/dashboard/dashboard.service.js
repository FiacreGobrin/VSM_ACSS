/**
 * Aggregated operational counters for the Security Operations Console landing page.
 * Resolved in a single round-trip so the dashboard does not fan out into N queries
 * on every poll.
 */
export function makeDashboardService({ db }) {
  return {
    async getSummary() {
      const result = await db.query(`
        SELECT
          -- Visitor / pass occupancy
          (SELECT count(*)::int FROM visits WHERE on_site = true)                          AS visitors_on_site,
          (SELECT count(*)::int FROM visits
             WHERE status = 'scheduled'
               AND expected_arrival::date = now()::date)                                  AS expected_today,
          (SELECT count(*)::int FROM visits WHERE status = 'checked_in')                   AS checked_in_total,
          (SELECT count(*)::int FROM visitors)                                             AS visitors_total,
          (SELECT count(*)::int FROM visitors WHERE status = 'blacklisted')                AS visitors_blacklisted,
          (SELECT count(*)::int FROM visitors WHERE status = 'flagged')                    AS visitors_flagged,

          -- CCTV fleet availability
          (SELECT count(*)::int FROM cameras)                                              AS cameras_total,
          (SELECT count(*)::int FROM cameras WHERE status = 'online')                      AS cameras_online,
          (SELECT count(*)::int FROM cameras WHERE status = 'offline')                     AS cameras_offline,
          (SELECT count(*)::int FROM zones)                                                AS zones_total,

          -- Security posture
          (SELECT count(*)::int FROM security_alerts WHERE is_acknowledged = false)        AS alerts_active,
          (SELECT count(*)::int FROM security_alerts
             WHERE is_acknowledged = false AND severity = 'critical')                      AS alerts_critical,
          (SELECT count(*)::int FROM identifications
             WHERE detected_at > now() - interval '24 hours')                              AS detections_24h,

          -- Compliance
          (SELECT count(*)::int FROM audit_logs
             WHERE created_at > now() - interval '24 hours')                               AS audit_events_24h
      `)

      return result.rows[0]
    },
  }
}