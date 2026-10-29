-- Which repositories each user can see (refreshed from GitHub), per-user defaults, and audit FKs
-- that survive account deletion.
create table if not exists user_repos (
  user_id bigint not null references users on delete cascade,
  repo_id bigint not null references repos on delete cascade,
  can_manage boolean not null default false,
  primary key (user_id, repo_id)
);
create index if not exists user_repos_repo on user_repos (repo_id);
alter table users add column if not exists repos_synced_at timestamptz;

create table if not exists user_settings (
  user_id bigint primary key references users on delete cascade,
  default_alpha numeric(4, 3) not null default 0.100,
  default_method text not null default 'crc' check (default_method in ('crc', 'ltt')),
  default_auto_merge boolean not null default false,
  default_models text[] not null default '{muse-spark,muse-spark-open}',
  updated_at timestamptz not null default now()
);

alter table audit_log drop constraint if exists audit_log_user_id_fkey;
alter table audit_log add constraint audit_log_user_id_fkey foreign key (user_id) references users on delete set null;
alter table repos drop constraint if exists repos_created_by_fkey;
alter table repos add constraint repos_created_by_fkey foreign key (created_by) references users on delete set null;
create index if not exists audit_log_repo_time on audit_log (repo_id, at desc);
create index if not exists runs_time on runs (created_at desc);
