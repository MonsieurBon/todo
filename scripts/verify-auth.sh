#!/usr/bin/env bash
#
# Verifies the auth chain end to end against the running dev stack.
#
# This is the Phase 0 exit criterion made repeatable. Re-run it after any change to
# keycloak/realm-todo.json or to SecurityConfig, because the properties it checks are
# the ones that silently stop holding:
#
#   1. The IdP refuses to mint a scope a client was never granted.
#   2. Tokens carry this deployment's canonical URI as their audience.
#   3. A token minted for a different audience is rejected.
#   4. An insufficient scope is refused WITH NO DATA IN THE BODY. The previous version
#      of this app leaked every task in the database precisely because its authorization
#      check failed open and returned the entity anyway.
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
  for c in todo-claude-code todo-claude-app; do
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

head "1. the IdP refuses scopes a client was never granted"
for scope in todo:write todo:admin; do
  err=$(token todo-claude-app "$scope" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("error",""))')
  [ "$err" = "invalid_scope" ] \
    && ok "todo-claude-app refused '$scope'" \
    || bad "todo-claude-app got '$scope' (error=${err:-none}) — the access boundary is GONE"
done
granted=$(token todo-claude-app todo:capture | python3 -c 'import sys,json; print("access_token" in json.load(sys.stdin))')
[ "$granted" = "True" ] && ok "todo-claude-app granted 'todo:capture'" || bad "todo-claude-app cannot capture"

head "2. tokens carry this deployment as their audience"
CODE_TOKEN=$(token todo-claude-code "todo:read todo:write" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("access_token",""))')
APP_TOKEN=$(token todo-claude-app "todo:capture" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("access_token",""))')
aud=$(python3 -c "
import base64, json, sys
p = '$CODE_TOKEN'.split('.')[1]
print(json.loads(base64.urlsafe_b64decode(p + '=' * (-len(p) % 4))).get('aud'))
")
case "$aud" in *"$APP"*) ok "aud contains $APP" ;; *) bad "aud is $aud, expected to contain $APP" ;; esac

# Declaring clientScopes in a realm import REPLACES Keycloak's built-in set rather than
# adding to it. Drop `basic` and tokens silently lose their `sub` claim while every
# scope and audience check still passes — so assert the standard claims explicitly.
for claim in sub preferred_username; do
  present=$(python3 -c "
import base64, json
p = '$CODE_TOKEN'.split('.')[1]
c = json.loads(base64.urlsafe_b64decode(p + '=' * (-len(p) % 4)))
print('$claim' in c)
")
  [ "$present" = "True" ] \
    && ok "token carries '$claim'" \
    || bad "token has no '$claim' — a built-in client scope is missing from realm-todo.json"
done

head "3. the resource server enforces the boundary"
code=$(curl -sS -o /dev/null -w '%{http_code}' "$APP/api/spike/whoami")
[ "$code" = "401" ] && ok "unauthenticated -> 401" || bad "unauthenticated -> $code, expected 401"

code=$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $CODE_TOKEN" "$APP/api/spike/needs-write")
[ "$code" = "200" ] && ok "todo:write token -> 200" || bad "todo:write token -> $code, expected 200"

code=$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $APP_TOKEN" "$APP/api/spike/needs-write")
body=$(curl -sS -H "Authorization: Bearer $APP_TOKEN" "$APP/api/spike/needs-write")
[ "$code" = "403" ] && ok "capture-only token -> 403" || bad "capture-only token -> $code, expected 403"
[ -z "$body" ] && ok "denied response carries no data" || bad "DENIED RESPONSE LEAKED A BODY: $body"

head "4. a token for a different audience is rejected"
curl -sS -X POST -H "Authorization: Bearer $ADM" -H "Content-Type: application/json" \
  "$KC/admin/realms/$REALM/clients" \
  -d '{"clientId":"verify-impostor","enabled":true,"publicClient":true,"directAccessGrantsEnabled":true,"standardFlowEnabled":true}' >/dev/null 2>&1 || true
IMP=$(token verify-impostor "" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("access_token",""))')
code=$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $IMP" "$APP/api/spike/whoami")
[ "$code" = "401" ] && ok "wrong-audience token -> 401" || bad "wrong-audience token -> $code, expected 401"
code=$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $IMP" "$APP/mcp")
[ "$code" = "401" ] && ok "wrong-audience token -> 401 on /mcp" || bad "wrong-audience token -> $code on /mcp"
curl -sS -X DELETE -H "Authorization: Bearer $ADM" \
  "$KC/admin/realms/$REALM/clients/$(client_uuid verify-impostor)" >/dev/null 2>&1 || true

head "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
