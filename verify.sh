#!/usr/bin/env bash
# verify.sh
# Confirms that a lifecycle policy is attached to every repo in repos.txt.
# Prints a table showing which repos have a policy and which are missing one.
#
# Usage: ./verify.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOS_FILE="$SCRIPT_DIR/repos.txt"
REGION="${AWS_REGION:-ap-south-1}"

HAS_POLICY=()
NO_POLICY=()

while IFS= read -r repo || [[ -n "$repo" ]]; do
  [[ -z "$repo" || "$repo" == \#* ]] && continue

  if aws ecr get-lifecycle-policy \
    --repository-name "$repo" \
    --region "$REGION" \
    --output text > /dev/null 2>&1; then
    HAS_POLICY+=("$repo")
  else
    NO_POLICY+=("$repo")
  fi

done < "$REPOS_FILE"

echo ""
echo "======================================"
echo "REPOS WITH LIFECYCLE POLICY: ${#HAS_POLICY[@]}"
echo "======================================"
for r in "${HAS_POLICY[@]}"; do
  echo "  [OK] $r"
done

echo ""
echo "======================================"
echo "REPOS MISSING LIFECYCLE POLICY: ${#NO_POLICY[@]}"
echo "======================================"
for r in "${NO_POLICY[@]}"; do
  echo "  [MISSING] $r"
done

if [[ ${#NO_POLICY[@]} -gt 0 ]]; then
  exit 1
fi
