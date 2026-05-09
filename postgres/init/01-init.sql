CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'erp_readonly') THEN
    CREATE ROLE erp_readonly LOGIN PASSWORD 'readonly_pass';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE erp_db TO erp_readonly;
GRANT USAGE ON SCHEMA public TO erp_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO erp_readonly;

SET timezone = 'Asia/Bangkok';

-- ── Attendance logs (high-write table from fingerprint scanners) ──────────────
CREATE TABLE IF NOT EXISTS attendance_logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID        NOT NULL,
  scan_type   TEXT        NOT NULL CHECK (scan_type IN ('CHECK_IN','CHECK_OUT')),
  scanned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_id   TEXT,
  location    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_emp_date
  ON attendance_logs (employee_id, (scanned_at::date));

-- ── Payroll records ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_records (
  id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id      UUID           NOT NULL,
  year             INT            NOT NULL,
  month            INT            NOT NULL,
  base_salary      NUMERIC(12,2)  NOT NULL DEFAULT 0,
  ot_pay           NUMERIC(12,2)  NOT NULL DEFAULT 0,
  total_allowance  NUMERIC(12,2)  NOT NULL DEFAULT 0,
  gross_pay        NUMERIC(12,2)  NOT NULL DEFAULT 0,
  tax              NUMERIC(12,2)  NOT NULL DEFAULT 0,
  social_security  NUMERIC(12,2)  NOT NULL DEFAULT 0,
  provident_fund   NUMERIC(12,2)  NOT NULL DEFAULT 0,
  total_deduction  NUMERIC(12,2)  NOT NULL DEFAULT 0,
  net_pay          NUMERIC(12,2)  NOT NULL DEFAULT 0,
  status           TEXT           NOT NULL DEFAULT 'calculated',
  calculated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_payroll_emp_period
  ON payroll_records (employee_id, year, month);
