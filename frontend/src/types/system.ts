export type TunnelState = 'CLOSED' | 'OPENING' | 'VERIFYING';

export interface OutboundTunnelStatus {
  id: string;
  name: string;
  targetRegistry: 'National ID DB' | 'Passport Global System' | 'Vehicle License DB';
  state: TunnelState;
  lastVerifiedAt?: string;
  direction: 'OUTBOUND_ONLY';
  activeRequests: number;
  uptimeSeconds: number;
}

export type VlanCategory = 10 | 20 | 30 | 40;

export interface VlanStatus {
  vlan: VlanCategory;
  name: string;
  subnet: string;
  description: string;
  deviceCount: number;
  onlineCount: number;
  bandwidthMbps: number;
  packetLossPercent: number;
}

export interface SystemConnectionStatus {
  backendOnline: boolean;
  backendLatencyMs: number;
  wsConnected: boolean;
  wsReconnecting: boolean;
  lastHeartbeat: string;
  isStaleData: boolean;
  activeVlan: string;
  encryptionMode: 'TLS_1_3_AIRGAP_LAN';
}

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

/* -------------------------------------------------------------------------- */
/* Visitor, pass & surveillance domain types (mirrors the Postgres schema)     */
/* -------------------------------------------------------------------------- */

export type VisitorStatus = 'active' | 'blacklisted' | 'flagged';
export type VisitorIdType = 'national_id' | 'passport' | 'drivers_license' | 'other';
export type VisitStatus = 'scheduled' | 'checked_in' | 'checked_out' | 'cancelled' | 'denied';
export type CameraStatus = 'online' | 'offline' | 'maintenance';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type DetectionEventType =
  | 'recognized_visitor'
  | 'unrecognized_person'
  | 'unauthorized_zone_breach'
  | 'blacklisted_person_alert'
  | 'tailgating';

export interface Visitor {
  id: string;
  full_name: string;
  id_type: VisitorIdType;
  id_number: string;
  company: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  status: VisitorStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SecurityZone {
  id: string;
  name: string;
  description: string;
  security_level: number;
  cameras_count: number;
  created_at: string;
  updated_at: string;
}

export interface Visit {
  id: string;
  visitor_id: string;
  host_name: string;
  host_email: string | null;
  purpose: string;
  badge_number: string | null;
  status: VisitStatus;
  check_in_at: string | null;
  check_out_at: string | null;
  expected_arrival: string;
  authorized_zones: string[];
  on_site: boolean;
  created_at: string;
  updated_at: string;
  // Denormalised visitor columns joined in by the API for the visitor desk table.
  visitor_name: string;
  id_type: VisitorIdType;
  id_number: string;
  company: string;
  photo_url: string | null;
}

export interface Camera {
  id: string;
  name: string;
  zone_id: string | null;
  ip_address: string | null;
  stream_url: string;
  model: string;
  status: CameraStatus;
  ai_features_enabled: boolean;
  last_heartbeat_at: string | null;
  /** Newest uploaded evidence clip attributed to this camera, if any. */
  last_recording_id: string | null;
  zone_name: string | null;
  zone_security_level: number | null;
  created_at: string;
  updated_at: string;
}

/** Video clips versus reference stills. Derived server-side from magic bytes. */
export type RecordingMediaKind = 'video' | 'image';

export type RecordingContentType =
  | 'video/mp4'
  | 'video/webm'
  | 'video/quicktime'
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp';

export interface Recording {
  id: string;
  camera_id: string | null;
  zone_id: string | null;
  identification_id: string | null;
  uploaded_by: string | null;
  title: string;
  description: string;
  media_kind: RecordingMediaKind;
  content_type: RecordingContentType;
  size_bytes: number;
  original_filename: string;
  recorded_at: string;
  retention_until: string | null;
  created_at: string;
  updated_at: string;
  // Joined in by the API for display.
  camera_name: string | null;
  zone_name: string | null;
  uploaded_by_username: string | null;
}

export interface Detection {
  id: string;
  camera_id: string;
  visitor_id: string | null;
  event_type: DetectionEventType;
  confidence_score: number | null;
  captured_frame_url: string | null;
  notes: string;
  detected_at: string;
  camera_name: string;
  zone_name: string | null;
  visitor_name: string | null;
  visitor_id_number: string | null;
  visitor_company: string | null;
  visitor_status: VisitorStatus | null;
  alert_id: string | null;
  alert_severity: AlertSeverity | null;
  alert_title: string | null;
}

export interface SecurityAlert {
  id: string;
  identification_id: string | null;
  camera_id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  is_acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
  camera_name: string;
  zone_name: string | null;
  acknowledged_by_name: string | null;
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  ip_address: string | null;
  details: Record<string, unknown>;
  created_at: string;
  user_username: string | null;
  user_full_name: string | null;
}

export interface DashboardSummary {
  visitors_on_site: number;
  expected_today: number;
  checked_in_total: number;
  visitors_total: number;
  visitors_blacklisted: number;
  visitors_flagged: number;
  cameras_total: number;
  cameras_online: number;
  cameras_offline: number;
  zones_total: number;
  alerts_active: number;
  alerts_critical: number;
  detections_24h: number;
  audit_events_24h: number;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  timestamp: string;
  database: {
    status: string;
    latency: string | null;
    database?: string;
    provider?: string;
  };
}
