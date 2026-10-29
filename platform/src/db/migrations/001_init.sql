-- Keel platform schema. Compatible with PostgreSQL 12+.
create table if not exists users (
  id bigserial primary key,
  github_id bigint unique not null,
  login text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id text primary key,
  user_id bigint not null references users on delete cascade,
  enc_github_token bytea not null,
  token_expires_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user on sessions (user_id);

create table if not exists installations (
  id bigserial primary key,
  github_installation_id bigint unique not null,
  account_login text not null,
  account_type text not null default 'User',
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists repos (
  id bigserial primary key,
  installation_id bigint not null references installations on delete cascade,
  github_repo_id bigint unique not null,
  full_name text not null,
  default_branch text not null default 'main',
  status text not null default 'new' check (status in ('new', 'setup_pr_open', 'active', 'paused', 'error')),
  alpha numeric(4, 3) not null default 0.100,
  method text not null default 'crc' check (method in ('crc', 'ltt')),
  auto_merge boolean not null default false,
  models text[] not null default '{muse-spark,muse-spark-open}',
  test_command text,
  ci_workflow text,
  setup_pr_number int,
  calibration_ref text not null default 'shared-v1',
  created_by bigint references users,
  created_at timestamptz not null default now(),
  activated_at timestamptz
);
create index if not exists repos_full_name on repos (lower(full_name));

create table if not exists runs (
  id bigserial primary key,
  repo_id bigint not null references repos on delete cascade,
  github_run_id bigint,
  trigger text not null,
  commit_sha text not null,
  started_at timestamptz,
  finished_at timestamptz,
  n_candidates int,
  selected_score double precision,
  threshold double precision,
  decision text check (decision in ('AUTO-MERGE', 'NEEDS REVIEW')),
  pr_number int,
  cost_usd numeric(10, 4),
  report jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (repo_id, github_run_id)
);
create index if not exists runs_repo_time on runs (repo_id, created_at desc);

create table if not exists outcomes (
  run_id bigint primary key references runs on delete cascade,
  merged_at timestamptz,
  reverted_at timestamptz,
  followup_ci_failed boolean,
  labelled_wrong boolean
);

create table if not exists audit_log (
  id bigserial primary key,
  user_id bigint references users,
  repo_id bigint references repos on delete cascade,
  action text not null,
  detail jsonb,
  at timestamptz not null default now()
);
