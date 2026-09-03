#!/usr/bin/env bash
#
# Provisions the local Keycloak realm for development and for the Phase 0 auth spike.
#
# Creates:
#   - realm `todo`
#   - client scopes todo:capture / todo:read / todo:write / todo:admin
#   - a `todo-audience` default scope carrying the audience mapper that stands in for
#     RFC 8707 resource indicators, which Keycloak does not support
#   - three clients with deliberately different scope grants:
#       todo-web          (the Angular app)      read write admin
#       todo-claude-code  (full MCP access)      read write admin
#       todo-claude-app   (capture-only MCP)     capture
#   - a test user
#
# Idempotent: deletes and recreates the realm.
#
set -euo pipefail

KC_URL="${KC_URL:-http://localhost:8081}"
KC_ADMIN="${KC_ADMIN:-admin}"
KC_ADMIN_PASSWORD="${KC_ADMIN_PASSWORD:-admin}"
REALM="${REALM:-todo}"
# The canonical URI of this MCP server. Tokens are minted with this as `aud`, and the
# resource server rejects anything else. This is the security boundary.
CANONICAL_URI="${TODO_CANONICAL_URI:-http://localhost:8080}"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

say "Authenticating against ${KC_URL}"
TOKEN=$(curl -sS --fail-with-body -X POST \
  "${KC_URL}/realms/master/protocol/openid-connect/token" \
  -d "client_id=admin-cli" \
  -d "username=${KC_ADMIN}" \
  -d "password=${KC_ADMIN_PASSWORD}" \
  -d "grant_type=password" | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

api() {
  local method=$1 path=$2
  shift 2
  curl -sS --fail-with-body -X "$method" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    "${KC_URL}/admin${path}" "$@"
}

# ---------------------------------------------------------------- realm

say "Recreating realm '${REALM}'"
curl -sS -o /dev/null -X DELETE -H "Authorization: Bearer ${TOKEN}" \
  "${KC_URL}/admin/realms/${REALM}" || true

api POST /realms -d "$(cat <<JSON
{
  "realm": "${REALM}",
  "enabled": true,
  "displayName": "One Minute To-Do List",
  "registrationAllowed": true,
  "registrationEmailAsUsername": true,
  "resetPasswordAllowed": true,
  "loginWithEmailAllowed": true,
  "verifyEmail": false,
  "accessTokenLifespan": 300
}
JSON
)"
echo "  realm created"

# ------------------------------------------------------- audience mapper

# Keycloak does not implement RFC 8707 resource indicators; it binds audience through
# scopes instead. This default scope is what puts the MCP server's canonical URI into
# `aud`, which is what the resource server validates.
say "Creating 'todo-audience' scope with the audience mapper"
api POST "/realms/${REALM}/client-scopes" -d "$(cat <<JSON
{
  "name": "todo-audience",
  "protocol": "openid-connect",
  "attributes": { "include.in.token.scope": "false", "display.on.consent.screen": "false" },
  "protocolMappers": [
    {
      "name": "todo-audience",
      "protocol": "openid-connect",
      "protocolMapper": "oidc-audience-mapper",
      "config": {
        "included.custom.audience": "${CANONICAL_URI}",
        "access.token.claim": "true",
        "id.token.claim": "false"
      }
    }
  ]
}
JSON
)"
echo "  todo-audience created (aud=${CANONICAL_URI})"

# ------------------------------------------------------------- scopes

scope_id() {
  api GET "/realms/${REALM}/client-scopes" \
    | python3 -c "import sys,json;print(next(s['id'] for s in json.load(sys.stdin) if s['name']=='$1'))"
}

for scope in todo:capture todo:read todo:write todo:admin; do
  api POST "/realms/${REALM}/client-scopes" -d "$(cat <<JSON
{
  "name": "${scope}",
  "protocol": "openid-connect",
  "description": "${scope}",
  "attributes": { "include.in.token.scope": "true", "display.on.consent.screen": "true" }
}
JSON
)"
  echo "  scope ${scope}"
done

AUDIENCE_SCOPE_ID=$(scope_id todo-audience)

# --------------------------------------------------------------- clients

client_id_of() {
  api GET "/realms/${REALM}/clients?clientId=$1" \
    | python3 -c "import sys,json;print(json.load(sys.stdin)[0]['id'])"
}

# $1 clientId, $2 name, $3... optional scopes
create_client() {
  local cid=$1 name=$2
  shift 2
  api POST "/realms/${REALM}/clients" -d "$(cat <<JSON
{
  "clientId": "${cid}",
  "name": "${name}",
  "enabled": true,
  "publicClient": true,
  "standardFlowEnabled": true,
  "directAccessGrantsEnabled": false,
  "serviceAccountsEnabled": false,
  "attributes": { "pkce.code.challenge.method": "S256" },
  "redirectUris": ["http://localhost:*", "http://127.0.0.1:*"],
  "webOrigins": ["+"]
}
JSON
)"
  local uuid
  uuid=$(client_id_of "${cid}")

  # Audience is always present: without it the resource server rejects every token.
  api PUT "/realms/${REALM}/clients/${uuid}/default-client-scopes/${AUDIENCE_SCOPE_ID}"

  # Permission scopes are OPTIONAL, so the client must ask for them explicitly and
  # Keycloak refuses any it was never granted. That refusal is the access-level boundary.
  for s in "$@"; do
    api PUT "/realms/${REALM}/clients/${uuid}/optional-client-scopes/$(scope_id "$s")"
  done
  echo "  client ${cid} -> [$*]"
}

say "Creating clients"
create_client todo-web             "Todo Web (Angular)"  todo:read todo:write todo:admin
create_client todo-claude-code     "Claude Code (full)"  todo:read todo:write todo:admin
create_client todo-claude-app      "Claude app (capture only)" todo:capture

# ----------------------------------------------------------------- user

say "Creating test user"
api POST "/realms/${REALM}/users" -d "$(cat <<'JSON'
{
  "username": "fabian@example.com",
  "email": "fabian@example.com",
  "emailVerified": true,
  "firstName": "Fabian",
  "lastName": "Test",
  "enabled": true,
  "credentials": [{ "type": "password", "value": "test", "temporary": false }]
}
JSON
)"
echo "  fabian@example.com / test"

say "Done."
echo "  issuer:    ${KC_URL}/realms/${REALM}"
echo "  audience:  ${CANONICAL_URI}"
echo "  admin UI:  ${KC_URL}/admin  (${KC_ADMIN}/${KC_ADMIN_PASSWORD})"
