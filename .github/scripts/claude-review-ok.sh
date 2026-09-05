#!/usr/bin/env bash
# Decide whether a Claude review pass succeeded, from its execution output.
#
# Usage: claude-review-ok.sh <execution-output-file>
# Exit 0 when the run produced a result frame with is_error == false;
# exit 1 otherwise (missing file, no result frame, or an errored run).
# On failure the result frame is printed so the cause is visible in the log.
set -euo pipefail

file="${1:-}"
if [ -z "$file" ] || [ ! -f "$file" ]; then
  echo "No execution output at '${file:-<empty>}'."
  exit 1
fi

result=$(jq -c '[.[] | select(.type == "result")] | last' "$file")
if [ -z "$result" ] || [ "$result" = "null" ]; then
  echo "Execution output has no result frame."
  exit 1
fi

is_error=$(printf '%s' "$result" | jq -r '.is_error')
if [ "$is_error" != "false" ]; then
  echo "Review run ended in an error (is_error=$is_error):"
  printf '%s\n' "$result" | jq .
  exit 1
fi

echo "Review run completed successfully."
