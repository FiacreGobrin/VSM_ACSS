-- =============================================================================
-- Migration Rollback: 0002_user_profiles_and_dashboard.up.sql
-- Reverses the operator profile and dashboard counter additions.
-- =============================================================================

DROP INDEX IF EXISTS idx_users_clearance_level;
DROP INDEX IF EXISTS idx_users_badge_number;
DROP INDEX IF EXISTS idx_visits_on_site;
DROP INDEX IF EXISTS idx_visits_expected_arrival;

ALTER TABLE visits DROP COLUMN IF EXISTS on_site;

ALTER TABLE users DROP COLUMN IF EXISTS last_login_at;
ALTER TABLE users DROP COLUMN IF EXISTS mfa_enabled;
ALTER TABLE users DROP COLUMN IF EXISTS clearance_level;
ALTER TABLE users DROP COLUMN IF EXISTS badge_number;
ALTER TABLE users DROP COLUMN IF EXISTS department;