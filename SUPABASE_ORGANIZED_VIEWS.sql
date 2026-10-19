-- Optional read-only organizational views for BGS cloud records.
-- Run once in Supabase SQL Editor after the existing public.records table is created.
-- Do NOT replace/drop public.records. The desktop sync continues to write to it.
-- These views use the permissions of their caller (PostgreSQL 15+).
create or replace view public.bgs_students with (security_invoker = true) as
select key, data, updated_at from public.records where collection = 'students';
create or replace view public.bgs_staff with (security_invoker = true) as
select key, data, updated_at from public.records where collection = 'staff';
create or replace view public.bgs_school_fees with (security_invoker = true) as
select key, data, updated_at from public.records where collection = 'bills';
create or replace view public.bgs_salary_dues with (security_invoker = true) as
select key, data, updated_at from public.records where collection = 'salaryBills';
create or replace view public.bgs_admission_payments with (security_invoker = true) as
select key, data, updated_at from public.records where collection = 'payments' and data->>'kind' = 'admission';
create or replace view public.bgs_fee_payments with (security_invoker = true) as
select key, data, updated_at from public.records where collection = 'payments' and data->>'kind' = 'fees';
create or replace view public.bgs_salary_payments with (security_invoker = true) as
select key, data, updated_at from public.records where collection = 'payments' and data->>'kind' = 'salary';
create or replace view public.bgs_marks with (security_invoker = true) as
select key, data, updated_at from public.records where collection = 'marks';
create or replace view public.bgs_report_comments with (security_invoker = true) as
select key, data, updated_at from public.records where collection = 'comments';
create or replace view public.bgs_discipline with (security_invoker = true) as
select key, data, updated_at from public.records where collection = 'discipline';
create or replace view public.bgs_promotions with (security_invoker = true) as
select key, data, updated_at from public.records where collection = 'promotions';
create or replace view public.bgs_school_settings with (security_invoker = true) as
select key, data, updated_at from public.records where collection = 'meta';
create or replace view public.bgs_audit_history with (security_invoker = true) as
select key, data, updated_at from public.records where collection = 'audit';
-- Apply appropriate RLS policies to public.records before granting table or view
-- access to anon/authenticated roles. The app's service_role key stays on HM PC only.
