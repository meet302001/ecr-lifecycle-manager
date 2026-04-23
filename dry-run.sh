#!/usr/bin/env bash
# dry-run.sh
# Previews which images WOULD be expired by the lifecycle policy, without deleting anything.
# Run this on a single repo first to validate the policy before bulk apply.
#
# Usage: ./dry-run.sh <repository-name>
# Example: ./dry-run.sh tradergpt-backend-nestjs

set -euo pipefail

REPO="${1:?Usage: $0 <repository-name>}"
POLICY_FILE="lifecycle-policy.json"
REGION="${AWS_REGION:-ap-south-1}"

echo "==> Starting lifecycle policy preview for: $REPO"
aws ecr start-lifecycle-policy-preview \
  --repository-name "$REPO" \
  --lifecycle-policy-text file://"$POLICY_FILE" \
  --region "$REGION"

echo ""
echo "==> Waiting for preview to complete (this may take 30-60 seconds)..."
sleep 10

while true; do
  STATUS=$(aws ecr get-lifecycle-policy-preview \
    --repository-name "$REPO" \
    --region "$REGION" \
    --query 'status' \
    --output text)

  echo "    Status: $STATUS"

  if [[ "$STATUS" == "COMPLETE" ]]; then
    break
  elif [[ "$STATUS" == "FAILED" ]]; then
    echo "ERROR: Preview failed."
    exit 1
  fi

  sleep 5
done

echo ""
echo "==> Images that WOULD be expired:"
aws ecr get-lifecycle-policy-preview \
  --repository-name "$REPO" \
  --region "$REGION" \
  --query 'previewResults[?action.type==`EXPIRE`].[imageTags[0],imageDigest,imagePushedAt]' \
  --output table

echo ""
echo "==> Summary:"
aws ecr get-lifecycle-policy-preview \
  --repository-name "$REPO" \
  --region "$REGION" \
  --query 'summary' \
  --output table
