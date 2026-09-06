import { getDb } from "./firebase";
import { FieldValue } from "firebase-admin/firestore";
import type { Thread, Message, Scene } from "./types";

const COLLECTION = "threads";

export async function createThread(
  data: Omit<Thread, "id" | "createdAt" | "updatedAt">
): Promise<Thread> {
  const db = getDb();
  const now = new Date().toISOString();
  const docRef = db.collection(COLLECTION).doc();
  const thread: Thread = {
    ...data,
    id: docRef.id,
    createdAt: now,
    updatedAt: now,
  };
  await docRef.set(thread);
  return thread;
}

export async function getThread(id: string): Promise<Thread | null> {
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as Omit<Thread, "id">) };
}

export async function addMessage(id: string, message: Message): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db
    .collection(COLLECTION)
    .doc(id)
    .update({
      messages: FieldValue.arrayUnion(message),
      updatedAt: now,
    });
}

export async function setScenes(id: string, scenes: Scene[]): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTION).doc(id).update({ scenes });
}

export async function listThreads(limit = 50): Promise<Thread[]> {
  const db = getDb();
  const snap = await db
    .collection(COLLECTION)
    .orderBy("updatedAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Thread, "id">),
  }));
}

export async function updateThreadTitle(
  id: string,
  title: string
): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTION).doc(id).update({ title });
}
