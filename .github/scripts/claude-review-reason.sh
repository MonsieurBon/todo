#!/usr/bin/env bash
# Print a short, human-readable reason a Claude review pass failed, from its
# execution output, as markdown bullet lines. Best-effort: the precise upstream
# error is not always in the file, so the summary always includes the
# result-frame fields (subtype / is_error / turns / cost), which on their own
# distinguish common cases (e.g. a usage limit shows as ~0 turns and $0 cost).
#
# Usage: claude-review-reason.sh <execution-output-file>
set -euo pipefail

file="${1:-}"
if [ -z "$file" ] || [ ! -f "$file" ]; then
  echo "- No execution output was produced (the run crashed before writing its log)."
  exit 0
fi

result=$(jq -c '[.[] | select(.type == "result")] | last' "$file")
if [ -z "$result" ] || [ "$result" = "null" ]; then
  echo "- The run produced no result frame (it errored before completing a turn)."
  exit 0
fi

printf '%s' "$result" | jq -r '
  "- subtype: `\(.subtype // "?")`",
  "- is_error: `\(.is_error)`",
  "- turns: `\(.num_turns // "?")`",
  "- cost: `$\(.total_cost_usd // 0)`"
  + (if ((.result // .error // "") | tostring) != "" then "\n- message: \((.result // .error) | tostring)" else "" end)
'
