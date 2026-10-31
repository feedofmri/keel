-- Model endpoints and API keys saved once per account (Settings → Model keys), encrypted at rest with
-- the same AES-256-GCM key as GitHub tokens. Setup copies them into each repository's Actions secrets.
create table if not exists user_model_keys (
  user_id bigint not null references users on delete cascade,
  name text not null,
  enc_value bytea not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, name)
);
