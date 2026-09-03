#!/usr/bin/env bash
#
# Seeds a test user in the local dev realm.
#
# The realm itself is declarative — keycloak/realm-todo.json, imported on startup.
# Users deliberately live outside it: the realm file is shared with every other
# environment, and in those, people register themselves. This is dev convenience only.
#
set -euo pipefail

KC_URL="${KC_URL:-http://localhost:8081}"
REALM="${REALM:-todo}"
USERNAME="${DEV_USER:-fabian@example.com}"
PASSWORD="${DEV_PASSWORD:-test}"

TOKEN=$(curl -sS --fail-with-body -X POST \
  "${KC_URL}/realms/master/protocol/openid-connect/token" \
  -d "client_id=admin-cli" -d "username=${KC_ADMIN:-admin}" \
  -d "password=${KC_ADMIN_PASSWORD:-admin}" -d "grant_type=password" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

curl -sS -X POST "${KC_URL}/admin/realms/${REALM}/users" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
  -d "$(cat <<JSON
{
  "username": "${USERNAME}",
  "email": "${USERNAME}",
  "emailVerified": true,
  "firstName": "Dev",
  "lastName": "User",
  "enabled": true,
  "credentials": [{ "type": "password", "value": "${PASSWORD}", "temporary": false }]
}
JSON
)" >/dev/null

echo "dev user ready: ${USERNAME} / ${PASSWORD}"
