-- Infrastructure-only setup for the disposable loopback PostgreSQL container.
-- These known fixture passwords are public examples, never hosted credentials.
CREATE ROLE clientelo_native_runtime LOGIN PASSWORD 'local-runtime-only'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE clientelo_native_retention_test LOGIN PASSWORD 'local-retention-only'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO clientelo_native_runtime, clientelo_native_retention_test;
-- Native Strata migrations/fixtures create the application schema and table grants.
