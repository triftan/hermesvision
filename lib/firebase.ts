import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let app: App;
let db: Firestore;

function initFirebase(): { app: App; db: Firestore } {
  if (getApps().length > 0) {
    app = getApps()[0]!;
    db = getFirestore(app);
    return { app, db };
  }

  // Cloud Run sets GOOGLE_APPLICATION_CREDENTIALS automatically when using a service account.
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) {
    throw new Error("FIREBASE_PROJECT_ID or GOOGLE_CLOUD_PROJECT env var is required");
  }

  app = initializeApp({ projectId });
  db = getFirestore(app);
  return { app, db };
}

export function getDb(): Firestore {
  if (!db) initFirebase();
  return db;
}
