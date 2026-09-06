# HermesVision

Agentic video analysis for security and police CCTV footage, powered by **Gemini 3.7 Flash** with agentic video understanding.

Upload a 1–5 minute video clip, get a timestamped analysis, and continue the conversation without re-uploading the video. Click any detected scene to ask detailed questions about that moment.

## Features

- Drag-and-drop or click-to-upload video files
- Natural-language chat about the video
- Follow-up questions reuse the same Gemini `file.uri` — no re-upload, lower token cost
- Extracted scene timeline with clickable timestamps
- Chat history persisted in **Firestore**
- Runs on **Google Cloud Run** with Docker

## Supported formats

`video/mp4`, `video/mpeg`, `video/quicktime`, `video/avi`, `video/x-flv`, `video/mpg`, `video/webm`, `video/wmv`, `video/3gpp`

## Setup

```bash
npm install
```

Copy the environment template:

```bash
cp .env.example .env.local
```

Fill in:

```
GEMINI_API_KEY=your_google_ai_studio_api_key_here
FIREBASE_PROJECT_ID=your_gcloud_project_id_here
```

> Never commit your API key. `.env.local` is ignored by Git.

## Run locally

```bash
npm run dev
```

Open http://localhost:3000.

## Deploy to Google Cloud Run

### One-time setup

1. Install the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
2. Login and set your project:

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

3. Enable required APIs:

```bash
gcloud services enable run.googleapis.com firestore.googleapis.com cloudbuild.googleapis.com
```

4. Create a Firestore database (if you don't have one):

```bash
gcloud firestore databases create --region=us-central1 --type=firestore-native
```

### Deploy

```bash
export PROJECT_ID=your-project-id
export GEMINI_API_KEY=your-key
./deploy.sh
```

Or manually:

```bash
gcloud run deploy hermesvision \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --timeout 300 \
  --set-env-vars "GEMINI_API_KEY=$GEMINI_API_KEY" \
  --set-env-vars "FIREBASE_PROJECT_ID=$PROJECT_ID"
```

## Architecture

- `app/page.tsx` — main page
- `app/components/VideoChat.tsx` — chat UI with drag-drop and scene timeline
- `app/api/analyze/route.ts` — upload + analyze + follow-up questions
- `app/api/threads/route.ts` — list / fetch chat threads
- `lib/ai.ts` — Gemini client helpers
- `lib/db.ts` — Firestore thread storage
- `lib/firebase.ts` — Firebase Admin init
- `Dockerfile` + `deploy.sh` — Cloud Run deployment

## Notes

- Uploaded videos are written to `/tmp`, forwarded to the Gemini Files API, then deleted immediately.
- Gemini retains uploaded files per the Files API lifecycle. Files are not stored by this application.
- Cloud Run free tier: 2 million requests/month. Firestore free tier: ~50k reads/day, ~20k writes/day, ~1GB storage.
- Long requests up to 5 minutes are supported via `--timeout 300`.

## License

MIT
