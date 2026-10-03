import { COLLECTIONS } from '../../shared/mongo/helpers.js'

/**
 * Aggregated operational counters for the Security Operations Console landing page.
 *
 * The PostgreSQL version resolved all of these in a single round-trip using a
 * query with twelve correlated subqueries. MongoDB has no equivalent construct,
 * so the counters are issued concurrently with `Promise.all` - they overlap on
 * the wire rather than fanning out sequentially, which keeps the wall-clock cost
 * close to one round-trip while each count uses a proper index.
 */
export function makeDashboardService({ db }) {
  const visits = db.collection(COLLECTIONS.visits)
  const visitors = db.collection(COLLECTIONS.visitors)
  const cameras = db.collection(COLLECTIONS.cameras)
  const zones = db.collection(COLLECTIONS.zones)
  const alerts = db.collection(COLLECTIONS.securityAlerts)
  const identifications = db.collection(COLLECTIONS.identifications)
  const auditLogs = db.collection(COLLECTIONS.auditLogs)

  // `now()::date` truncated to midnight, matching Postgres date semantics for
  // the "expected today" window.
  const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

  return {
    async getSummary() {
      const [
        visitorsOnSite,
        expectedToday,
        checkedInTotal,
        visitorsTotal,
        visitorsBlacklisted,
        visitorsFlagged,
        camerasTotal,
        camerasOnline,
        camerasOffline,
        zonesTotal,
        alertsActive,
        alertsCritical,
        detections24h,
        auditEvents24h,
      ] = await Promise.all([
        visits.countDocuments({ on_site: true }),
        visits.countDocuments({ status: 'scheduled', expected_arrival: { $gte: startOfToday() } }),
        visits.countDocuments({ status: 'checked_in' }),
        visitors.countDocuments({}),
        visitors.countDocuments({ status: 'blacklisted' }),
        visitors.countDocuments({ status: 'flagged' }),
        cameras.countDocuments({}),
        cameras.countDocuments({ status: 'online' }),
        cameras.countDocuments({ status: 'offline' }),
        zones.countDocuments({}),
        alerts.countDocuments({ is_acknowledged: false }),
        alerts.countDocuments({ is_acknowledged: false, severity: 'critical' }),
        identifications.countDocuments({ detected_at: { $gte: daysAgo(1) } }),
        auditLogs.countDocuments({ created_at: { $gte: daysAgo(1) } }),
      ]);

      return {
        visitors_on_site: visitorsOnSite,
        expected_today: expectedToday,
        checked_in_total: checkedInTotal,
        visitors_total: visitorsTotal,
        visitors_blacklisted: visitorsBlacklisted,
        visitors_flagged: visitorsFlagged,
        cameras_total: camerasTotal,
        cameras_online: camerasOnline,
        cameras_offline: camerasOffline,
        zones_total: zonesTotal,
        alerts_active: alertsActive,
        alerts_critical: alertsCritical,
        detections_24h: detections24h,
        audit_events_24h: auditEvents24h,
      };
    },
  }
}