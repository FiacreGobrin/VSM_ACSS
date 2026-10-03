-- =============================================================================
-- Migration: 0001_initial_schema.up.sql
-- Description: Core schema for Visitor Management, Authorization, CCTV Cameras,
--              Identification Events, Security Alerts, and Audit Logging.
-- Target Database: Neon Serverless PostgreSQL
-- =============================================================================

-- Enable pgcrypto / uuid-ossp for gen_random_uuid if on older Postgres
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. USERS & OPERATORS (Authorization & RBAC)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT UNIQUE NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'guard', 'auditor')),
    full_name     TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- -----------------------------------------------------------------------------
-- 2. SECURITY ZONES (Monitored Locations & Access Levels)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS zones (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT UNIQUE NOT NULL,
    description    TEXT DEFAULT '',
    security_level INT NOT NULL DEFAULT 1 CHECK (security_level BETWEEN 1 AND 5),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 3. VISITORS (Visitor Registry & Identity Profile)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS visitors (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name           TEXT NOT NULL,
    id_type             TEXT NOT NULL CHECK (id_type IN ('national_id', 'passport', 'drivers_license', 'other')),
    id_number           TEXT NOT NULL,
    company             TEXT NOT NULL DEFAULT '',
    email               TEXT,
    phone               TEXT,
    photo_url           TEXT,
    face_feature_vector JSONB,
    status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blacklisted', 'flagged')),
    notes               TEXT DEFAULT '',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id_type, id_number)
);

CREATE INDEX IF NOT EXISTS idx_visitors_id_number ON visitors (id_number);
CREATE INDEX IF NOT EXISTS idx_visitors_full_name ON visitors (full_name);
CREATE INDEX IF NOT EXISTS idx_visitors_status ON visitors (status);

-- -----------------------------------------------------------------------------
-- 4. VISITS (Scheduled Visits & Check-in / Check-out Passes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS visits (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id        UUID NOT NULL REFERENCES visitors(id) ON DELETE RESTRICT,
    host_name         TEXT NOT NULL,
    host_email        TEXT,
    purpose           TEXT NOT NULL,
    badge_number      TEXT,
    status            TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'checked_in', 'checked_out', 'cancelled', 'denied')),
    check_in_at       TIMESTAMPTZ,
    check_out_at      TIMESTAMPTZ,
    expected_arrival  TIMESTAMPTZ NOT NULL DEFAULT now(),
    authorized_zones  JSONB DEFAULT '[]',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visits_visitor_id ON visits (visitor_id);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits (status);
CREATE INDEX IF NOT EXISTS idx_visits_check_in ON visits (check_in_at);

-- -----------------------------------------------------------------------------
-- 5. CCTV CAMERAS (Surveillance Infrastructure Registry)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cameras (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 TEXT NOT NULL,
    zone_id              UUID REFERENCES zones(id) ON DELETE SET NULL,
    ip_address           TEXT,
    stream_url           TEXT NOT NULL,
    model                TEXT DEFAULT '',
    status               TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'offline', 'maintenance')),
    ai_features_enabled  BOOLEAN NOT NULL DEFAULT true,
    last_heartbeat_at    TIMESTAMPTZ DEFAULT now(),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cameras_zone_id ON cameras (zone_id);
CREATE INDEX IF NOT EXISTS idx_cameras_status ON cameras (status);

-- -----------------------------------------------------------------------------
-- 6. CCTV IDENTIFICATIONS (Facial Recognition & Detection Feeds)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS identifications (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    camera_id              UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    visitor_id             UUID REFERENCES visitors(id) ON DELETE SET NULL,
    event_type             TEXT NOT NULL CHECK (event_type IN ('recognized_visitor', 'unrecognized_person', 'unauthorized_zone_breach', 'blacklisted_person_alert', 'tailgating')),
    confidence_score       NUMERIC(5, 4),
    captured_frame_url     TEXT,
    detected_bounding_box  JSONB,
    notes                  TEXT DEFAULT '',
    detected_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_identifications_camera_id ON identifications (camera_id);
CREATE INDEX IF NOT EXISTS idx_identifications_visitor_id ON identifications (visitor_id);
CREATE INDEX IF NOT EXISTS idx_identifications_detected_at ON identifications (detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_identifications_event_type ON identifications (event_type);

-- -----------------------------------------------------------------------------
-- 7. SECURITY ALERTS (High-Priority Threat & Incident Notifications)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS security_alerts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identification_id   UUID REFERENCES identifications(id) ON DELETE CASCADE,
    camera_id           UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    severity            TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title               TEXT NOT NULL,
    description         TEXT NOT NULL,
    is_acknowledged     BOOLEAN NOT NULL DEFAULT false,
    acknowledged_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at     TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_severity ON security_alerts (severity);
CREATE INDEX IF NOT EXISTS idx_alerts_is_ack ON security_alerts (is_acknowledged);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON security_alerts (created_at DESC);

-- -----------------------------------------------------------------------------
-- 8. AUDIT LOGS (Compliance & Security Action History)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    action      TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id   TEXT,
    ip_address  TEXT,
    details     JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
