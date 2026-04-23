#!/usr/bin/env bash
# apply-lifecycle-policy.sh
# Applies lifecycle-policy.json to every repository listed in repos.txt.
#
# Usage:
#   ./apply-lifecycle-policy.sh              # apply to all repos in repos.txt
#   ./apply-lifecycle-policy.sh --dry-run    # print what would be done without applying
#
# Prerequisites:
#   - AWS CLI configured (aws configure) with permissions: ecr:PutLifecyclePolicy
#   - lifecycle-policy.json present in the same directory
#   - repos.txt present in the same directory

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POLICY_FILE="$SCRIPT_DIR/lifecycle-policy.json"
REPOS_FILE="$SCRIPT_DIR/repos.txt"
REGION="${AWS_REGION:-ap-south-1}"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "==> DRY RUN MODE — no changes will be made"
fi

if [[ ! -f "$POLICY_FILE" ]]; then
  echo "ERROR: $POLICY_FILE not found"
  exit 1
fi

if [[ ! -f "$REPOS_FILE" ]]; then
  echo "ERROR: $REPOS_FILE not found"
  exit 1
fi

SUCCESS=()
FAILED=()
SKIPPED=()

total=$(grep -c '[^[:space:]]' "$REPOS_FILE")
count=0

while IFS= read -r repo || [[ -n "$repo" ]]; do
  # Skip blank lines and comments
  [[ -z "$repo" || "$repo" == \#* ]] && continue

  count=$((count + 1))
  echo ""
  echo "[$count/$total] Processing: $repo"

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  WOULD apply policy to: $repo"
    SKIPPED+=("$repo")
    continue
  fi

  if aws ecr put-lifecycle-policy \
    --repository-name "$repo" \
    --lifecycle-policy-text file://"$POLICY_FILE" \
    --region "$REGION" \
    --output text > /dev/null 2>&1; then
    echo "  OK"
    SUCCESS+=("$repo")
  else
    echo "  FAILED — check if repo exists or if you have ecr:PutLifecyclePolicy permission"
    FAILED+=("$repo")
  fi

done < "$REPOS_FILE"

echo ""
echo "======================================"
echo "SUMMARY"
echo "======================================"
echo "Total repos:  $total"
echo "Succeeded:    ${#SUCCESS[@]}"
echo "Failed:       ${#FAILED[@]}"

if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo ""
  echo "Failed repos:"
  for r in "${FAILED[@]}"; do
    echo "  - $r"
  done
  exit 1
fi
