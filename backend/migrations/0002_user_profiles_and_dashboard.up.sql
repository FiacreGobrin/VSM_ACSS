-- =============================================================================
-- Migration: 0002_user_profiles_and_dashboard.up.sql
-- Description: Extends the users table with the operator profile fields the
--              VMS-ACS console renders (department, badge, clearance tier,
--              MFA enrolment, last login) and adds supporting indexes.
--              Adds a read model for the SOC dashboard aggregate queries.
-- Target Database: Neon Serverless PostgreSQL
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. OPERATOR PROFILE ATTRIBUTES
-- The original schema only stored the minimum needed for authentication.
-- The console displays a clearance matrix, so these columns are required.
-- -----------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS department      TEXT        NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS badge_number    TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS clearance_level TEXT        NOT NULL DEFAULT 'STANDARD'
    CHECK (clearance_level IN ('TOP_SECRET', 'RESTRICTED', 'STANDARD', 'VISITOR'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled     BOOLEAN     NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at   TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_badge_number
    ON users (badge_number)
    WHERE badge_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_clearance_level ON users (clearance_level);

-- -----------------------------------------------------------------------------
-- 2. SOC DASHBOARD COUNTERS
-- The console landing page shows visitors on-site, expected arrivals, camera
-- fleet availability and unacknowledged alert counts. These are maintained as
-- counters on `visits` so the aggregate query stays a single index scan rather
-- than counting the full access log on every dashboard poll.
-- -----------------------------------------------------------------------------
ALTER TABLE visits ADD COLUMN IF NOT EXISTS on_site BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_visits_on_site ON visits (on_site) WHERE on_site = true;
CREATE INDEX IF NOT EXISTS idx_visits_expected_arrival ON visits (expected_arrival);

-- -----------------------------------------------------------------------------
-- 3. BACKFILL existing rows so pre-migration data stays consistent
-- -----------------------------------------------------------------------------
UPDATE visits
   SET on_site = (status = 'checked_in')
 WHERE on_site IS DISTINCT FROM (status = 'checked_in');

-- The single existing seed account is the facility's top authority.
UPDATE users
   SET department      = 'Directorate of Infrastructure & Defense',
       badge_number    = COALESCE(badge_number, 'SA-9001-ALPHA'),
       clearance_level = 'TOP_SECRET',
       mfa_enabled     = true
 WHERE role = 'admin';