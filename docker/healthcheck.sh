#!/usr/bin/env bash
#
# Container healthcheck. The base image has no curl, wget or nc - only bash - so this
# speaks HTTP over bash's own /dev/tcp rather than adding an apt layer to the image.
# That also keeps one network dependency out of the release build.
#
# Checks the body, not just the status line: the endpoint answers 503 with a JSON body
# when a component is down, and a check that only looked at connectivity would call a
# container with an unreachable database healthy.
set -uo pipefail

PORT="${SERVER_PORT:-8080}"

exec 3<>"/dev/tcp/127.0.0.1/${PORT}" || exit 1
printf 'GET /actuator/health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n' >&3 || exit 1
grep -q '"status":"UP"' <&3
