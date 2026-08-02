-- Opaque session tokens are never persisted. Only domain-separated HMAC
-- digests are stored; rotation creates a new row and revokes the predecessor.
CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  token_digest text NOT NULL,
  csrf_token_digest text NOT NULL,
  auth_method text NOT NULL,
  demo_role user_role,
  rotated_from_session_id uuid REFERENCES user_sessions(id) ON DELETE RESTRICT,
  rotation_generation integer DEFAULT 0 NOT NULL,
  expires_at timestamptz NOT NULL,
  idle_expires_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  mfa_verified_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT user_sessions_token_digest_unique UNIQUE (token_digest),
  CONSTRAINT user_sessions_token_digest_check CHECK (token_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT user_sessions_csrf_digest_check CHECK (csrf_token_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT user_sessions_auth_method_check CHECK (auth_method IN ('EXTERNAL_PROVIDER', 'LOCAL_DEMO')),
  CONSTRAINT user_sessions_demo_role_check CHECK (
    (auth_method = 'LOCAL_DEMO' AND demo_role IN ('ADVERTISER', 'CREATOR'))
    OR (auth_method = 'EXTERNAL_PROVIDER' AND demo_role IS NULL)
  ),
  CONSTRAINT user_sessions_rotation_check CHECK (
    (rotation_generation = 0 AND rotated_from_session_id IS NULL)
    OR (rotation_generation > 0 AND rotated_from_session_id IS NOT NULL)
  ),
  CONSTRAINT user_sessions_rotation_generation_check CHECK (rotation_generation >= 0),
  CONSTRAINT user_sessions_expiration_check CHECK (
    expires_at > created_at
    AND expires_at <= absolute_expires_at
    AND idle_expires_at > created_at
    AND idle_expires_at <= absolute_expires_at
  ),
  CONSTRAINT user_sessions_last_seen_check CHECK (last_seen_at >= created_at),
  CONSTRAINT user_sessions_revocation_check CHECK (
    (revoked_at IS NULL AND revoke_reason IS NULL)
    OR (
      revoked_at IS NOT NULL
      AND revoke_reason IN (
        'USER_LOGOUT',
        'ROTATED',
        'ADMIN_REVOKE',
        'PASSWORD_CHANGED',
        'PRIVILEGE_CHANGED',
        'EXPIRED',
        'USER_DISABLED',
        'SECURITY_EVENT'
      )
    )
  )
);

CREATE UNIQUE INDEX user_sessions_rotated_from_uidx
  ON user_sessions (rotated_from_session_id)
  WHERE rotated_from_session_id IS NOT NULL;

CREATE INDEX user_sessions_user_active_idx
  ON user_sessions (user_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX user_sessions_expiry_idx
  ON user_sessions (absolute_expires_at, idle_expires_at);

COMMENT ON COLUMN user_sessions.token_digest IS
  'Domain-separated HMAC-SHA-256 digest only. Raw session tokens are forbidden.';

COMMENT ON COLUMN user_sessions.csrf_token_digest IS
  'Domain-separated HMAC-SHA-256 digest only. Raw CSRF tokens are forbidden.';
