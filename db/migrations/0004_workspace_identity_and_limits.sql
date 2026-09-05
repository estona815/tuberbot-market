-- Additive only. No live payment or payout table is activated by this migration.
CREATE TABLE external_identities (
  provider text NOT NULL CHECK (provider = 'GOOGLE'),
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 255),
  user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, subject), UNIQUE (provider, user_id)
);
CREATE INDEX external_identities_user_idx ON external_identities(user_id);
CREATE TABLE oauth_login_flows (
  state_digest text PRIMARY KEY CHECK (state_digest ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX oauth_login_flows_expiry_idx ON oauth_login_flows(expires_at);
CREATE TABLE service_rate_limits (
  key_digest text PRIMARY KEY CHECK (key_digest ~ '^[a-f0-9]{64}$'),
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count >= 1),
  expires_at timestamptz NOT NULL
);
CREATE INDEX service_rate_limits_expiry_idx ON service_rate_limits(expires_at);
CREATE TABLE workspace_projects (
  id uuid PRIMARY KEY,
  advertiser_id uuid NOT NULL REFERENCES users(id),
  creator_id uuid NOT NULL REFERENCES users(id),
  revision integer NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 200),
  document jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_different_parties CHECK (advertiser_id <> creator_id),
  CONSTRAINT workspace_sandbox_only CHECK (document->'seed'->>'mode' = 'SERVER_SANDBOX'),
  CONSTRAINT workspace_id_binding CHECK (document->'seed'->>'id' = id::text),
  CONSTRAINT workspace_revision_binding CHECK (jsonb_typeof(document->'commands') = 'array' AND jsonb_array_length(document->'commands') = revision)
);
CREATE INDEX workspace_projects_advertiser_idx ON workspace_projects(advertiser_id, updated_at DESC, id);
CREATE INDEX workspace_projects_creator_idx ON workspace_projects(creator_id, updated_at DESC, id);
CREATE TABLE workspace_command_events (
  project_id uuid NOT NULL REFERENCES workspace_projects(id),
  sequence integer NOT NULL CHECK (sequence BETWEEN 1 AND 200),
  request_key uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  command jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, sequence), UNIQUE (project_id, request_key)
);
CREATE INDEX workspace_command_actor_idx ON workspace_command_events(actor_id, created_at DESC);
CREATE TABLE workspace_contract_records (
  project_id uuid PRIMARY KEY REFERENCES workspace_projects(id),
  version integer NOT NULL CHECK (version BETWEEN 1 AND 30),
  snapshot jsonb NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION workspace_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'workspace evidence is append-only'; END;
$$;
CREATE TRIGGER workspace_events_immutable BEFORE UPDATE OR DELETE ON workspace_command_events FOR EACH ROW EXECUTE FUNCTION workspace_immutable();
CREATE TRIGGER workspace_contract_immutable BEFORE UPDATE OR DELETE ON workspace_contract_records FOR EACH ROW EXECUTE FUNCTION workspace_immutable();
CREATE FUNCTION workspace_update_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.advertiser_id IS DISTINCT FROM OLD.advertiser_id
    OR NEW.creator_id IS DISTINCT FROM OLD.creator_id OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.document->'seed' IS DISTINCT FROM OLD.document->'seed'
    OR NEW.revision <> OLD.revision + 1
    OR (NEW.document->'commands' - OLD.revision) IS DISTINCT FROM OLD.document->'commands'
  THEN RAISE EXCEPTION 'workspace lineage or immutable seed violation'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER workspace_project_lineage BEFORE UPDATE ON workspace_projects FOR EACH ROW EXECUTE FUNCTION workspace_update_guard();
-- These are backend-only tables. No anonymous direct database access is granted.
ALTER TABLE external_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_login_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_command_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_contract_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON external_identities, oauth_login_flows, service_rate_limits, workspace_projects, workspace_command_events, workspace_contract_records FROM PUBLIC;
