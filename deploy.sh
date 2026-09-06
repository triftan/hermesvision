#!/usr/bin/env bash
set -euo pipefail

# Deploy HermesVision to Google Cloud Run
# Usage: PROJECT_ID=your-project-id GEMINI_API_KEY=your-key ./deploy.sh

PROJECT_ID="${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}"
SERVICE_NAME="${SERVICE_NAME:-hermesvision}"
REGION="${REGION:-us-central1}"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: PROJECT_ID or GOOGLE_CLOUD_PROJECT must be set."
  exit 1
fi

if [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "Error: GEMINI_API_KEY must be set."
  exit 1
fi

echo "Deploying $SERVICE_NAME to project $PROJECT_ID in $REGION..."

gcloud config set project "$PROJECT_ID"

gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars "GEMINI_API_KEY=$GEMINI_API_KEY" \
  --set-env-vars "FIREBASE_PROJECT_ID=$PROJECT_ID" \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID"

echo "Done."
