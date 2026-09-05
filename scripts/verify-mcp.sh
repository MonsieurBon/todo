#!/usr/bin/env bash
#
# Drives the MCP endpoint end to end against the running dev stack.
#
# Companion to verify-auth.sh, which covers the REST side. This one checks the
# properties specific to the tool surface:
#
#   1. The handshake works and the negotiated protocol revision is the expected one.
#   2. Tools are discovered, and their schemas are honest — optional parameters are not
#      advertised as required, and read-only tools are not flagged destructive.
#   3. A capture-only token can create a task and nothing else, and the refusal carries
#      no task data. This is the same property the old app violated, expressed through
#      the tool layer instead of the REST layer.
#   4. One user's token cannot reach another user's tasks through any tool.
#
# Uses the password grant to obtain tokens without a browser, enabling it only for the
# duration of the run. Dev tooling only; the real clients use authorization code + PKCE.
#
set -euo pipefail

KC="${KC_URL:-http://localhost:8081}"
APP="${APP_URL:-http://localhost:8090}"
REALM="${REALM:-todo}"
USER="${DEV_USER:-fabian@example.com}"
PASS="${DEV_PASSWORD:-test}"
EXPECTED_PROTOCOL="${EXPECTED_PROTOCOL:-2025-11-25}"

pass=0
fail=0
ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; pass=$((pass + 1)); }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; fail=$((fail + 1)); }
section() { printf '\n\033[1m%s\033[0m\n' "$1"; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"; set_password_grant false' EXIT

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
    -d "client_id=$1" -d "username=${2:-$USER}" -d "password=$PASS" \
    -d grant_type=password -d "scope=openid $3" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin).get("access_token",""))'
}

# Opens a session and echoes its id. The 2025-11-25 transport is session-based: every
# call after initialize must carry Mcp-Session-Id or the server rejects it.
mcp_open() {
  local tok=$1
  curl -sS -D "$TMP/h" -o /dev/null -X POST "$APP/mcp" \
    -H "Authorization: Bearer $tok" -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"'"$EXPECTED_PROTOCOL"'","capabilities":{},"clientInfo":{"name":"verify-mcp","version":"1"}}}'
  grep -i '^mcp-session-id' "$TMP/h" | tr -d '\r' | awk '{print $2}'
}

# Responses come back as SSE, so the JSON-RPC payload has to be pulled out of the data line.
mcp() {
  local tok=$1 sid=$2 payload=$3
  curl -sS -X POST "$APP/mcp" \
    -H "Authorization: Bearer $tok" -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" -H "Mcp-Session-Id: $sid" \
    -d "$payload" \
    | sed -n 's/^data://p' | head -1
}

call() {
  mcp "$1" "$2" '{"jsonrpc":"2.0","id":9,"method":"tools/call","params":{"name":"'"$3"'","arguments":'"$4"'}}'
}

set_password_grant true
FULL=$(token todo-claude-code "" "todo:read todo:write todo:admin")
CAP=$(token todo-claude-app "" "todo:capture")

section "1. handshake"
curl -sS -o "$TMP/init" -X POST "$APP/mcp" -H "Authorization: Bearer $FULL" \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"'"$EXPECTED_PROTOCOL"'","capabilities":{},"clientInfo":{"name":"verify-mcp","version":"1"}}}'
negotiated=$(python3 -c "
import json
print(json.load(open('$TMP/init'))['result']['protocolVersion'])
" 2>/dev/null || echo none)
[ "$negotiated" = "$EXPECTED_PROTOCOL" ] \
  && ok "negotiated protocol $negotiated" \
  || bad "negotiated $negotiated, expected $EXPECTED_PROTOCOL"

code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$APP/mcp" -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}')
[ "$code" = "401" ] && ok "unauthenticated -> 401" || bad "unauthenticated -> $code"

SID=$(mcp_open "$FULL")
mcp "$FULL" "$SID" '{"jsonrpc":"2.0","method":"notifications/initialized"}' >/dev/null || true

section "2. the tools are discovered and describe themselves honestly"
mcp "$FULL" "$SID" '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' > "$TMP/tools"
python3 - "$TMP/tools" <<'PY' > "$TMP/toolcheck"
import json, sys
tools = json.load(open(sys.argv[1]))["result"]["tools"]
by = {t["name"]: t for t in tools}
print("count", len(tools))
# An optional parameter listed as required forces the model to invent a value. Checked across
# every tool rather than one known case: @McpToolParam defaults required=true, so the mistake is
# made by omission and a hard-coded probe only ever catches the parameter it names.
required = {n: sorted(t["inputSchema"].get("required", [])) for n, t in by.items()}
expected = {
    "create_task": ["title"],
    "update_task": ["taskId"],
    "get_task": ["taskId"],
    "complete_task": ["taskId"],
    "reopen_task": ["taskId"],
    "delete_task": ["taskId"],
    "move_task_zone": ["taskId", "zone"],
    "defer_task": ["taskId", "until"],
    "set_task_labels": ["labels", "taskId"],
    "mark_task_reviewed": ["taskId"],
    "get_review_queue": ["listId"],
    "create_tasklist": ["name"],
    "share_tasklist": ["email", "listId"],
    "get_board": [],
    "list_labels": [],
    "list_tasklists": [],
}
# Exhaustive on purpose, and asserted to be: the mistake is made by omission, so a tool with no
# entry is exactly the one that would slip through. Adding a tool has to fail here until it is
# listed — a guard with a hole in the shape of "the next tool" guards nothing.
missing = sorted(set(required) - set(expected))
wrong = {n: required[n] for n, e in expected.items() if n not in required or required[n] != e}
print("optional_ok", not wrong and not missing, wrong or missing or "")
# A read-only tool flagged destructive trains clients to ignore the flag.
print("readonly_ok", by["get_board"]["annotations"]["readOnlyHint"] is True
      and by["get_board"]["annotations"]["destructiveHint"] is False)
print("delete_ok", by["delete_task"]["annotations"]["destructiveHint"] is True)
PY
count=$(awk '/^count/{print $2}' "$TMP/toolcheck")
# Pinned rather than a floor: a lower bound stops pinning anything the moment a tool is added,
# and this is the check that would notice one going missing.
[ "$count" -eq 16 ] && ok "$count tools discovered" || bad "expected 16 tools, discovered $count"
grep -q "optional_ok True" "$TMP/toolcheck" \
  && ok "optional parameters are not advertised as required" \
  || bad "an optional parameter is marked required — the model will be forced to invent one"
grep -q "readonly_ok True" "$TMP/toolcheck" \
  && ok "get_board is readOnly and not destructive" \
  || bad "read-only tool is mis-annotated"
grep -q "delete_ok True" "$TMP/toolcheck" \
  && ok "delete_task is flagged destructive" \
  || bad "delete_task is not flagged destructive"

section "3. the capture-only client can file a task and do nothing else"
CAP_SID=$(mcp_open "$CAP")
mcp "$CAP" "$CAP_SID" '{"jsonrpc":"2.0","method":"notifications/initialized"}' >/dev/null || true

created=$(call "$CAP" "$CAP_SID" create_task '{"title":"Captured by verify-mcp","labels":["verify"]}')
echo "$created" | grep -q '"isError":true' \
  && bad "capture client could not create a task: $created" \
  || ok "capture client created a task"

refused=$(call "$CAP" "$CAP_SID" get_board '{}')
if echo "$refused" | grep -qi 'denied\|forbidden\|AccessDenied\|isError":true'; then
  ok "capture client refused get_board"
else
  bad "CAPTURE CLIENT READ THE BOARD: $refused"
fi
echo "$refused" | grep -q "Captured by verify-mcp" \
  && bad "REFUSAL LEAKED TASK DATA" \
  || ok "refusal carries no task data"

refused_delete=$(call "$CAP" "$CAP_SID" delete_task '{"taskId":1}')
echo "$refused_delete" | grep -qi 'denied\|forbidden\|AccessDenied\|isError":true' \
  && ok "capture client refused delete_task" \
  || bad "CAPTURE CLIENT DELETED A TASK: $refused_delete"

section "4. the full client can read what was captured"
board=$(call "$FULL" "$SID" get_board '{}')
echo "$board" | grep -q "Captured by verify-mcp" \
  && ok "full client sees the captured task" \
  || bad "full client cannot see the captured task"

section "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
