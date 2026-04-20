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

-- Timezone
SET timezone = 'Asia/Bangkok';
