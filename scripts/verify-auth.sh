#!/usr/bin/env bash
#
# Verifies the auth chain end to end against the running dev stack.
#
# Re-run it after any change to keycloak/realm-todo.json or to SecurityConfig: the
# properties below are the ones that stop holding silently, and the previous version of
# this app leaked every task in the database because an authorization check failed open
# and returned the entity anyway.
#
# Uses the password grant to fetch tokens without a browser, enabling it only for the
# duration of the run. That grant is deprecated in OAuth 2.1 and is dev-tooling only —
# the real clients use authorization code + PKCE.
#
set -euo pipefail

KC="${KC_URL:-http://localhost:8081}"
APP="${APP_URL:-http://localhost:8090}"
REALM="${REALM:-todo}"
USER="${DEV_USER:-fabian@example.com}"
PASS="${DEV_PASSWORD:-test}"

pass=0
fail=0
ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; pass=$((pass + 1)); }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; fail=$((fail + 1)); }
head() { printf '\n\033[1m%s\033[0m\n' "$1"; }

ADM=$(curl -sS --fail-with-body -X POST "$KC/realms/master/protocol/openid-connect/token" \
  -d client_id=admin-cli -d "username=${KC_ADMIN:-admin}" \
  -d "password=${KC_ADMIN_PASSWORD:-admin}" -d grant_type=password \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

client_uuid() {
  curl -sS -H "Authorization: Bearer $ADM" "$KC/admin/realms/$REALM/clients?clientId=$1" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)[0]["id"])'
}

set_password_grant() {
  for c in todo-web todo-mcp; do
    curl -sS -X PUT -H "Authorization: Bearer $ADM" -H "Content-Type: application/json" \
      "$KC/admin/realms/$REALM/clients/$(client_uuid "$c")" \
      -d "{\"clientId\":\"$c\",\"directAccessGrantsEnabled\":$1}" >/dev/null
  done
}

token() {
  curl -sS -X POST "$KC/realms/$REALM/protocol/openid-connect/token" \
    -d "client_id=$1" -d "username=$USER" -d "password=$PASS" \
    -d grant_type=password -d "scope=openid $2"
}

cleanup() { set_password_grant false; }
trap cleanup EXIT

set_password_grant true

head "1. neither client can obtain a token for the other's surface"
err=$(token todo-mcp todo:api | python3 -c 'import sys,json; print(json.load(sys.stdin).get("error",""))')
[ "$err" = "invalid_scope" ] \
  && ok "todo-mcp refused 'todo:api'" \
  || bad "todo-mcp got 'todo:api' (error=${err:-none}) — the surface boundary is GONE"
err=$(token todo-web todo:mcp | python3 -c 'import sys,json; print(json.load(sys.stdin).get("error",""))')
[ "$err" = "invalid_scope" ] \
  && ok "todo-web refused 'todo:mcp'" \
  || bad "todo-web got 'todo:mcp' (error=${err:-none}) — the surface boundary is GONE"

head "2. tokens carry this deployment as their audience"
API_TOKEN=$(token todo-web "todo:api" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("access_token",""))')
MCP_TOKEN=$(token todo-mcp "todo:mcp" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("access_token",""))')
aud=$(python3 -c "
import base64, json, sys
p = '$API_TOKEN'.split('.')[1]
print(json.loads(base64.urlsafe_b64decode(p + '=' * (-len(p) % 4))).get('aud'))
")
case "$aud" in *"$APP"*) ok "aud contains $APP" ;; *) bad "aud is $aud, expected to contain $APP" ;; esac

# Declaring clientScopes in a realm import REPLACES Keycloak's built-in set rather than
# adding to it. Drop `basic` and tokens silently lose their `sub` claim while every
# scope and audience check still passes — so assert the standard claims explicitly.
for claim in sub preferred_username; do
  present=$(python3 -c "
import base64, json
p = '$API_TOKEN'.split('.')[1]
c = json.loads(base64.urlsafe_b64decode(p + '=' * (-len(p) % 4)))
print('$claim' in c)
")
  [ "$present" = "True" ] \
    && ok "token carries '$claim'" \
    || bad "token has no '$claim' — a built-in client scope is missing from realm-todo.json"
done

head "3. the resource server enforces the boundary"
code=$(curl -sS -o /dev/null -w '%{http_code}' "$APP/api/tasklists")
[ "$code" = "401" ] && ok "unauthenticated -> 401" || bad "unauthenticated -> $code, expected 401"

code=$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $API_TOKEN" "$APP/api/tasklists")
[ "$code" = "200" ] && ok "API token lists tasklists -> 200" || bad "API token -> $code, expected 200"

code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $API_TOKEN" \
  -H 'Content-Type: application/json' -d '{"title":"captured by verify-auth"}' "$APP/api/tasks/capture")
[ "$code" = "201" ] && ok "API token can capture -> 201" || bad "capture -> $code, expected 201"

code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $API_TOKEN" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' "$APP/mcp")
[ "$code" = "403" ] && ok "API token cannot reach /mcp -> 403" || bad "API token on /mcp -> $code, expected 403"

code=$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $MCP_TOKEN" "$APP/api/tasklists")
body=$(curl -sS -H "Authorization: Bearer $MCP_TOKEN" "$APP/api/tasklists")
[ "$code" = "403" ] && ok "MCP token cannot read the API -> 403" || bad "MCP token on /api -> $code, expected 403"
# The property is "the refusal hands over no tasks", not "the body is empty" - a 503 for an
# unreachable IdP explains itself and is not a denial. Assert emptiness only for a real 403,
# so this cannot cry wolf and train someone to ignore it.
if [ "$code" = "403" ]; then
  [ -z "$body" ] && ok "denied response carries no data" || bad "DENIED RESPONSE LEAKED A BODY: $body"
else
  echo "$body" | grep -qiE '"(id|name|title)"' \
    && bad "REFUSAL LEAKED TASK DATA: $body" \
    || ok "refusal carries no task data (status $code)"
fi

head "4. a token for a different audience is rejected"
curl -sS -X POST -H "Authorization: Bearer $ADM" -H "Content-Type: application/json" \
  "$KC/admin/realms/$REALM/clients" \
  -d '{"clientId":"verify-impostor","enabled":true,"publicClient":true,"directAccessGrantsEnabled":true,"standardFlowEnabled":true}' >/dev/null 2>&1 || true
IMP=$(token verify-impostor "" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("access_token",""))')
code=$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $IMP" "$APP/api/tasklists")
[ "$code" = "401" ] && ok "wrong-audience token -> 401" || bad "wrong-audience token -> $code, expected 401"
code=$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $IMP" "$APP/mcp")
[ "$code" = "401" ] && ok "wrong-audience token -> 401 on /mcp" || bad "wrong-audience token -> $code on /mcp"
curl -sS -X DELETE -H "Authorization: Bearer $ADM" \
  "$KC/admin/realms/$REALM/clients/$(client_uuid verify-impostor)" >/dev/null 2>&1 || true

head "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
